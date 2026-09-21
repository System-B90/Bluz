ALTER TABLE "s" ADD COLUMN "course_ids" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "s" ADD COLUMN "lead_instructor_ids" integer[] DEFAULT '{}' NOT NULL;