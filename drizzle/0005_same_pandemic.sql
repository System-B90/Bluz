ALTER TABLE "c2s" RENAME COLUMN "c_id" TO "curriculum_id";--> statement-breakpoint
ALTER TABLE "c2s" RENAME COLUMN "s_id" TO "syllabus_id";--> statement-breakpoint
ALTER TABLE "c2s" DROP CONSTRAINT "c2s_c_id_c_id_fk";
--> statement-breakpoint
ALTER TABLE "c2s" DROP CONSTRAINT "c2s_s_id_s_id_fk";
--> statement-breakpoint
ALTER TABLE "c2s" DROP CONSTRAINT "c2s_c_id_s_id_pk";--> statement-breakpoint
ALTER TABLE "c2s" ADD CONSTRAINT "c2s_curriculum_id_syllabus_id_pk" PRIMARY KEY("curriculum_id","syllabus_id");--> statement-breakpoint
ALTER TABLE "c2s" ADD CONSTRAINT "c2s_curriculum_id_c_id_fk" FOREIGN KEY ("curriculum_id") REFERENCES "public"."c"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "c2s" ADD CONSTRAINT "c2s_syllabus_id_s_id_fk" FOREIGN KEY ("syllabus_id") REFERENCES "public"."s"("id") ON DELETE cascade ON UPDATE no action;