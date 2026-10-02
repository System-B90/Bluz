ALTER TABLE "cMDA" ADD COLUMN "allotted_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Every placed event keeps the time it ran with until now: its whole duration.
UPDATE "cMDA" SET "allotted_minutes" = "e"."minimum_duration" FROM "e" WHERE "cMDA"."event_id" = "e"."id";
