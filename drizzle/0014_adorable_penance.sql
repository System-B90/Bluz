ALTER TABLE "cMDA" DROP CONSTRAINT "cMDA_curriculum_id_module_id_event_id_day_id_pk";--> statement-breakpoint
ALTER TABLE "cMDA" ADD COLUMN "id" text PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "cMDA" ADD CONSTRAINT "cMDA_curriculum_id_module_id_event_id_day_id_unique" UNIQUE("curriculum_id","module_id","event_id","day_id");