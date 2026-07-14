UPDATE "w" SET "comment" = '' WHERE "comment" IS NULL;--> statement-breakpoint
ALTER TABLE "w" ALTER COLUMN "comment" SET NOT NULL;