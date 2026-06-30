CREATE TYPE "public"."recurrence" AS ENUM('none', 'daily', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."room_requirement" AS ENUM('בחדר מסווג', 'בחוץ', 'כמה כיתות', 'מחוץ לבסיס', 'באופן מקוון');--> statement-breakpoint
ALTER TABLE "e" ADD COLUMN "orchestrator_id" integer;--> statement-breakpoint
ALTER TABLE "e" ADD COLUMN "recommended_lecturer_ids" integer[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "e" ADD COLUMN "system_requirements" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "e" ADD COLUMN "room_requirement" "room_requirement" DEFAULT 'בחדר מסווג' NOT NULL;--> statement-breakpoint
ALTER TABLE "e" ADD COLUMN "recurrence" "recurrence" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "e" ADD COLUMN "is_critical" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "e" ADD COLUMN "is_pa_window" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "e" ADD COLUMN "comment" text;