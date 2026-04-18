ALTER TABLE "cMDA" DROP CONSTRAINT "cMDA_week_id_w_id_fk";
--> statement-breakpoint
ALTER TABLE "cMDA" DROP CONSTRAINT "cMDA_curriculum_id_module_id_pk";--> statement-breakpoint
ALTER TABLE "cMDA" ADD CONSTRAINT "cMDA_curriculum_id_module_id_day_id_pk" PRIMARY KEY("curriculum_id","module_id","day_id");--> statement-breakpoint
ALTER TABLE "cMDA" DROP COLUMN "week_id";