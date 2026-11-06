"use node";
// Kalorax Coach: the model call. Streams the reply into the chat as it's written, looks up foods and
// recipes with tools, and turns "log this" / "plan that" into one-tap suggestions for the member.
// Needs ANTHROPIC_API_KEY in the Convex environment.
import Anthropic from "@anthropic-ai/sdk";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { PHOTO_TOOL, runTool, SYSTEM, TOOLS, type Action, type Ctx, type PhotoAnalysis } from "./coachTools";

const MODEL = "claude-opus-5-5";
// Claude Opus 5.5 prices per million tokens: input, output, cache read, cache write (5 min).
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };
const MAX_ROUNDS = 4;

export const respond = internalAction({
  args: { userId: v.id("users"), replyId: v.id("coachMessages") },
  handler: async (ctx, { userId, replyId }): Promise<null> => {
    let text = "";
    const actions: Action[] = [];
    let analysis: PhotoAnalysis | undefined;
    const usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
    const finish = async (status: "done" | "error", finalText: string): Promise<null> => {
      await ctx.runMutation(internal.coach.finishReply, { replyId, text: finalText, status, actions, analysis, usage });
      return null;
    };

    const c: Ctx | null = await ctx.runQuery(internal.coach.context, { userId, replyId });
    if (!c) return finish("error", "Please finish setting up your profile first.");

    // Earlier turns as plain text, starting with the member (consecutive turns of one role are fine).
    const history = c.history.slice(c.history.findIndex((m) => m.role === "user"));
    // The newest photo goes to the model as an image; older ones are just noted, to keep each reply quick and cheap.
    const lastPhoto = history.map((m, i) => (m.role === "user" && m.imageId ? i : -1)).filter((i) => i >= 0).at(-1) ?? -1;
    const hasPhoto = lastPhoto >= 0 && lastPhoto === history.length - 1;
    const image = lastPhoto >= 0 ? await photoBlock(ctx, history[lastPhoto].imageId!) : null;
    // Not a real image (e.g. a renamed file): say so instead of guessing. Doesn't count towards today's messages.
    if (hasPhoto && !image) return finish("error", "I couldn't open that photo. Please take it again, or send a JPG or PNG.");
    const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m, i): Anthropic.Beta.BetaMessageParam =>
      i === lastPhoto && image
        ? { role: "user", content: [image, { type: "text", text: m.text }] }
        : { role: m.role, content: m.imageId ? `[Sent a food photo] ${m.text}` : m.text },
    );
    if (messages.length === 0) return finish("error", "Please send your message again.");
    const { history: _h, ...facts } = c;

    const client = new Anthropic({ timeout: 90_000, maxRetries: 1 });
    let lastFlush = 0;
    const flush = async (force = false) => {
      if (!force && Date.now() - lastFlush < 250) return;
      lastFlush = Date.now();
      await ctx.runMutation(internal.coach.updateReply, { replyId, text });
    };

    try {
      for (let round = 0; round < MAX_ROUNDS; round++) {
        if (text && !/\s$/.test(text)) text += "\n\n";
        const stream = client.beta.messages.stream({
          model: MODEL,
          max_tokens: 8000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort: "low" },
          // Stable instructions first and cached; the member's live context after the breakpoint.
          system: [
            { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
            { type: "text", text: `<member_context>\n${JSON.stringify(facts)}\n</member_context>` },
          ],
          tools: hasPhoto ? [...TOOLS, PHOTO_TOOL] : TOOLS,
          messages,
        });
        stream.on("text", (delta) => {
          text += delta;
          void flush();
        });
        const message = await stream.finalMessage();
        const u = message.usage;
        usage.inputTokens += u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
        usage.outputTokens += u.output_tokens;
        usage.costUsd +=
          (u.input_tokens * PRICE.input + u.output_tokens * PRICE.output +
            (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead + (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite) / 1e6;

        if (message.stop_reason === "refusal") {
          return finish("done", "I can't help with that one. For health questions, a verified dietitian under Programmes can help you properly.");
        }
        const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
        if (message.stop_reason !== "tool_use" || toolUses.length === 0) break;

        messages.push({ role: "assistant", content: message.content });
        const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((t) => {
          const input = t.input && typeof t.input === "object" ? (t.input as Record<string, unknown>) : {};
          const r = runTool(t.name, input, c);
          if (r.analysis) {
            // One breakdown per photo: a second call replaces the first, with its button.
            const old = analysis ? actions.findIndex((a) => a.portionLabel === "1 serving (photo estimate)") : -1;
            if (old >= 0) actions.splice(old, 1);
            analysis = r.analysis;
          }
          if (r.action && actions.length < 6) actions.push({ ...r.action, id: `a${actions.length + 1}` } as Action);
          return { type: "tool_result", tool_use_id: t.id, content: r.result, ...(r.error ? { is_error: true } : {}) };
        });
        messages.push({ role: "user", content: results });
      }
      await flush(true);
      return finish("done", text.trim() || (actions.length ? "Here you go: tap to add it." : "Sorry, I didn't catch that. Could you say it another way?"));
    } catch (err) {
      console.error("coach reply failed", err instanceof Anthropic.APIError ? err.status : (err as Error).name);
      return finish("error", "Sorry, I couldn't reply just now. Please try again in a moment.");
    }
  },
});

type ImageType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

/** The image type from the file's first bytes (not the declared type, which can't be trusted). */
export function sniffImage(b: Uint8Array): ImageType | null {
  const at = (i: number, ...xs: number[]) => xs.every((x, j) => b[i + j] === x);
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  return null;
}

/** The stored photo as an image block for the model (base64), or null if it's gone or isn't a real image. */
async function photoBlock(ctx: { storage: { get: (id: Id<"_storage">) => Promise<Blob | null> } }, imageId: Id<"_storage">): Promise<Anthropic.Beta.BetaImageBlockParam | null> {
  const blob = await ctx.storage.get(imageId);
  if (!blob) return null;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) return null;
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { type: "image", source: { type: "base64", media_type: type, data: btoa(binary) } };
}
