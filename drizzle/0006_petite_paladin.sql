ALTER TABLE "d" DROP CONSTRAINT "d_week_id_w_id_fk";
--> statement-breakpoint
ALTER TABLE "d" ALTER COLUMN "total_working_min" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "d" DROP COLUMN "week_id";