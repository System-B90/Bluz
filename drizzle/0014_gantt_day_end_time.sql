-- Explicit end of a gantt day's working window ("HH:mm"), used by the cut
-- balancer as the day's capacity.
--
-- Left NULL on backfill on purpose: NULL means "derive as the day's start time
-- plus total_working_min", which reproduces exactly how every existing day
-- behaved before this column existed. The day start time lives in the MongoDB
-- schedule settings, so it cannot be resolved here — the planner derives it.
ALTER TABLE "d" ADD COLUMN "day_end_time" text;
