CREATE TYPE "public"."module_event_type" AS ENUM('הרצאה', 'ע"ע', 'ל"ע', 'אחר');--> statement-breakpoint
CREATE TABLE "cS" (
	"curriculum_id" text NOT NULL,
	"syllabus_id" text NOT NULL,
	CONSTRAINT "cS_curriculum_id_syllabus_id_pk" PRIMARY KEY("curriculum_id","syllabus_id")
);
--> statement-breakpoint
CREATE TABLE "c" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"draft" boolean DEFAULT true NOT NULL,
	"weeks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "e" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"type" "module_event_type" NOT NULL,
	"minimum_duration" integer DEFAULT 0 NOT NULL,
	"allocated_duration" integer DEFAULT 0 NOT NULL,
	"requirements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mE" (
	"module_id" text NOT NULL,
	"event_id" text NOT NULL,
	CONSTRAINT "mE_module_id_event_id_pk" PRIMARY KEY("module_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "m" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"hive_ids" integer[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sM" (
	"syllabus_id" text NOT NULL,
	"module_id" text NOT NULL,
	CONSTRAINT "sM_syllabus_id_module_id_pk" PRIMARY KEY("syllabus_id","module_id")
);
--> statement-breakpoint
CREATE TABLE "s" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"hive_ids" integer[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cS" ADD CONSTRAINT "cS_curriculum_id_c_id_fk" FOREIGN KEY ("curriculum_id") REFERENCES "public"."c"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cS" ADD CONSTRAINT "cS_syllabus_id_s_id_fk" FOREIGN KEY ("syllabus_id") REFERENCES "public"."s"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mE" ADD CONSTRAINT "mE_module_id_m_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."m"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mE" ADD CONSTRAINT "mE_event_id_e_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."e"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sM" ADD CONSTRAINT "sM_syllabus_id_s_id_fk" FOREIGN KEY ("syllabus_id") REFERENCES "public"."s"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sM" ADD CONSTRAINT "sM_module_id_m_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."m"("id") ON DELETE cascade ON UPDATE no action;