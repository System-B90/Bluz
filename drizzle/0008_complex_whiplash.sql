ALTER TABLE "cMDA" DROP CONSTRAINT "cMDA_module_id_m_id_fk";
--> statement-breakpoint
ALTER TABLE "cMDA" DROP CONSTRAINT "cMDA_curriculum_id_module_id_day_id_pk";--> statement-breakpoint
ALTER TABLE "cEC" ALTER COLUMN "event_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cMDA" ADD CONSTRAINT "cMDA_curriculum_id_event_id_day_id_pk" PRIMARY KEY("curriculum_id","event_id","day_id");--> statement-breakpoint
ALTER TABLE "cEC" ADD COLUMN "module_id" text;--> statement-breakpoint
ALTER TABLE "cMDA" ADD COLUMN "event_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "cEC" ADD CONSTRAINT "cEC_module_id_m_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."m"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cMDA" ADD CONSTRAINT "cMDA_event_id_e_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."e"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cMDA" DROP COLUMN "module_id";