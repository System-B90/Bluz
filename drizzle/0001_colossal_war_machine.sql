CREATE TABLE "cEC" (
	"curriculum_id" text NOT NULL,
	"event_id" text NOT NULL,
	"allocated_duration" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cEC_curriculum_id_event_id_pk" PRIMARY KEY("curriculum_id","event_id")
);
--> statement-breakpoint
ALTER TABLE "cEC" ADD CONSTRAINT "cEC_curriculum_id_c_id_fk" FOREIGN KEY ("curriculum_id") REFERENCES "public"."c"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cEC" ADD CONSTRAINT "cEC_event_id_e_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."e"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "e" DROP COLUMN "allocated_duration";