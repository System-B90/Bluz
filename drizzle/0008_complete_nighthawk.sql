CREATE TABLE "eRE" (
	"id" text PRIMARY KEY NOT NULL,
	"curriculum_id" text NOT NULL,
	"event_id" text NOT NULL,
	"day_id" text NOT NULL,
	"ca" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "eRE_curriculum_id_event_id_day_id_unique" UNIQUE("curriculum_id","event_id","day_id")
);
--> statement-breakpoint
ALTER TABLE "eRE" ADD CONSTRAINT "eRE_curriculum_id_c_id_fk" FOREIGN KEY ("curriculum_id") REFERENCES "public"."c"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eRE" ADD CONSTRAINT "eRE_event_id_e_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."e"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eRE" ADD CONSTRAINT "eRE_day_id_d_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."d"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "eRE_curriculum_id_idx" ON "eRE" USING btree ("curriculum_id");