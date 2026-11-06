// Deletes uploads that were never attached to anything (a coach photo that wasn't sent, a verification
// document that wasn't submitted), so nobody can fill our storage with stray files. Runs daily (crons.ts).
import { internalMutation } from "./_generated/server";

/** Uploads younger than this are left alone: they may be about to be sent. */
const GRACE_MS = 24 * 3_600_000;
const BATCH = 500;

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Only uploads from 1-3 days ago: older ones were checked on earlier runs.
    const now = Date.now();
    const files = await ctx.db.system
      .query("_storage")
      .withIndex("by_creation_time", (q) => q.gt("_creationTime", now - GRACE_MS * 3).lt("_creationTime", now - GRACE_MS))
      .take(BATCH * 4);
    let deleted = 0;
    for (const f of files) {
      if (deleted >= BATCH) break;
      const [photo, document] = await Promise.all([
        ctx.db.query("coachMessages").withIndex("by_image", (q) => q.eq("imageId", f._id)).first(),
        ctx.db.query("verifications").withIndex("by_document", (q) => q.eq("documentId", f._id)).first(),
      ]);
      if (photo || document) continue;
      await ctx.storage.delete(f._id);
      deleted++;
    }
    return deleted;
  },
});
