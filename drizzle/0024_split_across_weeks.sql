ALTER TABLE "cMDA" ADD COLUMN "week_split_minutes" integer[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "e" ADD COLUMN "split_across_weeks" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Exercises (ע"ע) split across weeks by default; everything else opts in (#768).
UPDATE "e" SET "split_across_weeks" = true WHERE "type" = 'ע"ע';
