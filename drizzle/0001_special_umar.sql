ALTER TABLE "d" ALTER COLUMN "comment" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "d" ALTER COLUMN "comment" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "cMDA_curriculum_id_idx" ON "cMDA" USING btree ("curriculum_id");--> statement-breakpoint
CREATE INDEX "cMDA_day_id_idx" ON "cMDA" USING btree ("day_id");