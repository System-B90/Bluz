CREATE TABLE "cMDA" (
	"curriculum_id" text NOT NULL,
	"module_id" text NOT NULL,
	"week_index" integer NOT NULL,
	"day_index" integer NOT NULL,
	"sort_order" real DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cMDA_curriculum_id_week_index_day_index_module_id_pk" PRIMARY KEY("curriculum_id","week_index","day_index","module_id")
);
--> statement-breakpoint
ALTER TABLE "cMDA" ADD CONSTRAINT "cMDA_curriculum_id_c_id_fk" FOREIGN KEY ("curriculum_id") REFERENCES "public"."c"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cMDA" ADD CONSTRAINT "cMDA_module_id_m_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."m"("id") ON DELETE cascade ON UPDATE no action;