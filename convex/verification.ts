import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { checkText, getProfile, logAdminAction, requireAdmin, requireUser } from "./helpers";
import { take } from "./rateLimit";

/** Short-lived upload URL for a licence or student ID document. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    await take(ctx, "documentUploadPerUser", userId);
    return ctx.storage.generateUploadUrl();
  },
});

/** Submit (or resubmit) verification. Sets the profile to pending; only admins can approve. */
export const submit = mutation({
  args: { credential: v.string(), documentId: v.optional(v.id("_storage")) },
  handler: async (ctx, { credential, documentId }) => {
    const userId = await requireUser(ctx);
    const profile = await getProfile(ctx, userId);
    if (!profile) throw new ConvexError("Finish setting up your profile first.");
    if (profile.role === "consumer") throw new ConvexError("Only students and dietitians can be verified.");
    if (profile.verification === "verified") throw new ConvexError("You're already verified.");
    const trimmed = credential.trim();
    if (trimmed.length < 3) throw new ConvexError("Please enter your licence or matric number.");
    checkText(trimmed, 120, "Credential");
    if (documentId) {
      const meta = await ctx.db.system.get(documentId);
      if (!meta) throw new ConvexError("Upload not found.");
      if (meta.size > 8 * 1024 * 1024) throw new ConvexError("File too large (max 8 MB).");
    }
    await ctx.db.insert("verifications", { userId, role: profile.role, credential: trimmed, documentId, status: "pending", submittedAt: Date.now() });
    await ctx.db.patch(profile._id, { verification: "pending" });
  },
});

/** Admin review queue. */
export const listPending = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("verifications").withIndex("by_status", (q) => q.eq("status", "pending")).order("asc").collect();
    return Promise.all(
      rows.map(async (r) => {
        const user = await ctx.db.get(r.userId);
        const profile = await getProfile(ctx, r.userId);
        return {
          _id: r._id,
          role: r.role,
          credential: r.credential,
          submittedAt: r.submittedAt,
          email: user?.email ?? null,
          name: profile?.name ?? null,
          documentUrl: r.documentId ? await ctx.storage.getUrl(r.documentId) : null,
        };
      }),
    );
  },
});

export const review = mutation({
  args: { id: v.id("verifications"), decision: v.union(v.literal("verified"), v.literal("rejected")), note: v.optional(v.string()) },
  handler: async (ctx, { id, decision, note }) => {
    const adminId = await requireAdmin(ctx);
    const row = await ctx.db.get(id);
    if (!row || row.status !== "pending") throw new ConvexError("This request was already handled.");
    if (note) checkText(note, 300, "Note");
    await ctx.db.patch(id, { status: decision, reviewedAt: Date.now(), reviewerNote: note?.trim() || undefined });
    const profile = await getProfile(ctx, row.userId);
    if (profile) await ctx.db.patch(profile._id, { verification: decision });
    await logAdminAction(
      ctx, adminId, decision === "verified" ? "verification_approved" : "verification_rejected", row.userId,
      `${profile?.name ?? "A member"} as a ${row.role} (${row.credential})${note?.trim() ? ` · note: ${note.trim()}` : ""}`,
    );
  },
});
