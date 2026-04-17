CREATE TABLE "w" (
	"id" text PRIMARY KEY NOT NULL,
	"c_id" text NOT NULL,
	"n" integer NOT NULL,
	"cmt" text DEFAULT '',
	"cS" boolean DEFAULT false NOT NULL,
	"ca" timestamp DEFAULT now() NOT NULL,
	"ua" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "w" ADD CONSTRAINT "w_c_id_c_id_fk" FOREIGN KEY ("c_id") REFERENCES "public"."c"("id") ON DELETE cascade ON UPDATE no action;