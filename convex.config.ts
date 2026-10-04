import { cronJobs } from "convex/server";
import { internal } from "./src/convex/_generated/api";

const crons = cronJobs();

crons.weekly(
  "Finalize MOOVY weekly leaderboard and leagues",
  { dayOfWeek: "Sunday", hourUTC: 23, minuteUTC: 59 },
  internal.leaderboard.finalizeWeek,
  {},
);

export default crons;
