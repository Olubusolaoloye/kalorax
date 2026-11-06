import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Reminders are checked every 5 minutes; each one is sent within 15 minutes of its time.
crons.interval("send reminders", { minutes: 5 }, internal.notify.tick);

// Real-user speed reports are kept for 30 days.
crons.daily("prune speed reports", { hourUTC: 2, minuteUTC: 17 }, internal.vitals.prune);

// Finished rate-limit windows and stray uploads (photos or documents never attached to anything).
crons.daily("prune rate limits", { hourUTC: 2, minuteUTC: 41 }, internal.rateLimit.prune);
crons.daily("delete unused uploads", { hourUTC: 3, minuteUTC: 7 }, internal.storageCleanup.run);

export default crons;
