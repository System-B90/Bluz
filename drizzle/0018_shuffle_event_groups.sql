-- Shuffle grouping (#699): the same lesson given to different shuffles at
-- different times stays one row per shuffle -- so each keeps its own placement,
-- cut and Hive linkage -- with the siblings tied together by a shared group id.
-- Null ⇒ the event stands alone, which is every pre-existing row.
ALTER TABLE "e" ADD COLUMN "group_id" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "e_group_id_idx" ON "e" ("group_id");
