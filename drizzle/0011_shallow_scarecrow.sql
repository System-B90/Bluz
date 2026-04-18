ALTER TABLE "cMDA" DROP CONSTRAINT "cMDA_curriculum_id_event_id_day_id_pk";--> statement-breakpoint
ALTER TABLE "cMDA" ALTER COLUMN "event_id" SET DEFAULT 'null';--> statement-breakpoint
ALTER TABLE "cMDA" ALTER COLUMN "event_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cMDA" ADD CONSTRAINT "cMDA_curriculum_id_module_id_event_id_day_id_pk" PRIMARY KEY("curriculum_id","module_id","event_id","day_id");