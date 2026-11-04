"use node";
// Kalorax Coach: the model call. Streams the reply into the chat as it's written, looks up foods and
// recipes with tools, and turns "log this" / "plan that" into one-tap suggestions for the member.
// Needs ANTHROPIC_API_KEY in the Convex environment.
import Anthropic from "@anthropic-ai/sdk";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { runTool, SYSTEM, TOOLS, type Action, type Ctx } from "./coachTools";

const MODEL = "claude-opus-5-5";
// Claude Opus 5.5 prices per million tokens: input, output, cache read, cache write (5 min).
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };
const MAX_ROUNDS = 4;

export const respond = internalAction({
  args: { userId: v.id("users"), replyId: v.id("coachMessages") },
  handler: async (ctx, { userId, replyId }): Promise<null> => {
    let text = "";
    const actions: Action[] = [];
    const usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
    const finish = async (status: "done" | "error", finalText: string): Promise<null> => {
      await ctx.runMutation(internal.coach.finishReply, { replyId, text: finalText, status, actions, usage });
      return null;
    };

    const c: Ctx | null = await ctx.runQuery(internal.coach.context, { userId, replyId });
    if (!c) return finish("error", "Please finish setting up your profile first.");

    // Earlier turns as plain text, starting with the member (consecutive turns of one role are fine).
    const history = c.history.slice(c.history.findIndex((m) => m.role === "user"));
    const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({ role: m.role, content: m.text }));
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
          tools: TOOLS,
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
