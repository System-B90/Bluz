ALTER TABLE "e" ADD COLUMN "group_id" text;--> statement-breakpoint
CREATE INDEX "e_group_id_idx" ON "e" USING btree ("group_id");