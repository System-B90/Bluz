ALTER TABLE "cEC" DROP CONSTRAINT "cEC_module_id_m_id_fk";
--> statement-breakpoint
ALTER TABLE "cMDA" ADD COLUMN "module_id" text;--> statement-breakpoint
ALTER TABLE "cMDA" ADD CONSTRAINT "cMDA_module_id_m_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."m"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cEC" DROP COLUMN "module_id";