ALTER TABLE "d" RENAME COLUMN "w_id" TO "week_id";--> statement-breakpoint
ALTER TABLE "d" RENAME COLUMN "d" TO "day_index";--> statement-breakpoint
ALTER TABLE "d" RENAME COLUMN "tWH" TO "total_working_min";--> statement-breakpoint
ALTER TABLE "d" RENAME COLUMN "cmt" TO "comment";--> statement-breakpoint
ALTER TABLE "e" RENAME COLUMN "t" TO "title";--> statement-breakpoint
ALTER TABLE "e" RENAME COLUMN "ty" TO "type";--> statement-breakpoint
ALTER TABLE "e" RENAME COLUMN "m_d" TO "minimum_duration";--> statement-breakpoint
ALTER TABLE "cMDA" RENAME COLUMN "c_id" TO "curriculum_id";--> statement-breakpoint
ALTER TABLE "cMDA" RENAME COLUMN "m_id" TO "module_id";--> statement-breakpoint
ALTER TABLE "cMDA" RENAME COLUMN "w_id" TO "week_id";--> statement-breakpoint
ALTER TABLE "cMDA" RENAME COLUMN "d_id" TO "day_id";--> statement-breakpoint
ALTER TABLE "m" RENAME COLUMN "t" TO "title";--> statement-breakpoint
ALTER TABLE "m" RENAME COLUMN "d" TO "desc";--> statement-breakpoint
ALTER TABLE "m" RENAME COLUMN "h_ids" TO "hive_ids";--> statement-breakpoint
ALTER TABLE "s" RENAME COLUMN "t" TO "title";--> statement-breakpoint
ALTER TABLE "s" RENAME COLUMN "h_ids" TO "hive_ids";--> statement-breakpoint
ALTER TABLE "w" RENAME COLUMN "c_id" TO "curriculum_id";--> statement-breakpoint
ALTER TABLE "w" RENAME COLUMN "n" TO "number";--> statement-breakpoint
ALTER TABLE "w" RENAME COLUMN "cmt" TO "comment";--> statement-breakpoint
ALTER TABLE "w" RENAME COLUMN "cS" TO "weekend_duty";--> statement-breakpoint
ALTER TABLE "d" DROP CONSTRAINT "d_w_id_w_id_fk";
--> statement-breakpoint
ALTER TABLE "cMDA" DROP CONSTRAINT "cMDA_c_id_c_id_fk";
--> statement-breakpoint
ALTER TABLE "cMDA" DROP CONSTRAINT "cMDA_m_id_m_id_fk";
--> statement-breakpoint
ALTER TABLE "cMDA" DROP CONSTRAINT "cMDA_w_id_w_id_fk";
--> statement-breakpoint
ALTER TABLE "cMDA" DROP CONSTRAINT "cMDA_d_id_d_id_fk";
--> statement-breakpoint
ALTER TABLE "w" DROP CONSTRAINT "w_c_id_c_id_fk";
--> statement-breakpoint
ALTER TABLE "cMDA" DROP CONSTRAINT "cMDA_c_id_m_id_pk";--> statement-breakpoint
ALTER TABLE "cMDA" ADD CONSTRAINT "cMDA_curriculum_id_module_id_pk" PRIMARY KEY("curriculum_id","module_id");--> statement-breakpoint
ALTER TABLE "d" ADD CONSTRAINT "d_week_id_w_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."w"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cMDA" ADD CONSTRAINT "cMDA_curriculum_id_c_id_fk" FOREIGN KEY ("curriculum_id") REFERENCES "public"."c"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cMDA" ADD CONSTRAINT "cMDA_module_id_m_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."m"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cMDA" ADD CONSTRAINT "cMDA_week_id_w_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."w"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cMDA" ADD CONSTRAINT "cMDA_day_id_d_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."d"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "w" ADD CONSTRAINT "w_curriculum_id_c_id_fk" FOREIGN KEY ("curriculum_id") REFERENCES "public"."c"("id") ON DELETE cascade ON UPDATE no action;