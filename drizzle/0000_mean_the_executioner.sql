CREATE TYPE "public"."module_event_type" AS ENUM('הרצאה', 'ע"ע', 'ל"ע', 'אחר');--> statement-breakpoint
CREATE TABLE "c2s" (
	"c_id" text NOT NULL,
	"s_id" text NOT NULL,
	CONSTRAINT "c2s_c_id_s_id_pk" PRIMARY KEY("c_id","s_id")
);
--> statement-breakpoint
CREATE TABLE "c2w" (
	"c_id" text NOT NULL,
	"w_id" text NOT NULL,
	CONSTRAINT "c2w_c_id_w_id_pk" PRIMARY KEY("c_id","w_id")
);
--> statement-breakpoint
CREATE TABLE "cEC" (
	"curriculum_id" text NOT NULL,
	"event_id" text NOT NULL,
	"allocated_duration" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cEC_curriculum_id_event_id_pk" PRIMARY KEY("curriculum_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "c" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"draft" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "d" (
	"id" text PRIMARY KEY NOT NULL,
	"w_id" text NOT NULL,
	"d" integer NOT NULL,
	"tWH" real DEFAULT 0 NOT NULL,
	"cmt" text,
	"ca" timestamp DEFAULT now() NOT NULL,
	"ua" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "m2e" (
	"module_id" text NOT NULL,
	"event_id" text NOT NULL,
	CONSTRAINT "m2e_module_id_event_id_pk" PRIMARY KEY("module_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "cMDA" (
	"c_id" text NOT NULL,
	"m_id" text NOT NULL,
	"w_id" text NOT NULL,
	"d_id" text NOT NULL,
	"s" real DEFAULT 0 NOT NULL,
	"ca" timestamp DEFAULT now() NOT NULL,
	"ua" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cMDA_c_id_m_id_pk" PRIMARY KEY("c_id","m_id")
);
--> statement-breakpoint
CREATE TABLE "m" (
	"id" text PRIMARY KEY NOT NULL,
	"t" text NOT NULL,
	"d" text DEFAULT '' NOT NULL,
	"h_ids" integer[] DEFAULT '{}' NOT NULL,
	"ca" timestamp DEFAULT now() NOT NULL,
	"ua" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "s2m" (
	"syllabus_id" text NOT NULL,
	"module_id" text NOT NULL,
	CONSTRAINT "s2m_syllabus_id_module_id_pk" PRIMARY KEY("syllabus_id","module_id")
);
--> statement-breakpoint
CREATE TABLE "s" (
	"id" text PRIMARY KEY NOT NULL,
	"t" text NOT NULL,
	"h_ids" integer[] DEFAULT '{}' NOT NULL,
	"ca" timestamp DEFAULT now() NOT NULL,
	"ua" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "w2d" (
	"w_id" text NOT NULL,
	"d_id" text NOT NULL,
	CONSTRAINT "w2d_w_id_d_id_pk" PRIMARY KEY("w_id","d_id")
);
--> statement-breakpoint
ALTER TABLE "c2s" ADD CONSTRAINT "c2s_c_id_c_id_fk" FOREIGN KEY ("c_id") REFERENCES "public"."c"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "c2s" ADD CONSTRAINT "c2s_s_id_s_id_fk" FOREIGN KEY ("s_id") REFERENCES "public"."s"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "c2w" ADD CONSTRAINT "c2w_c_id_c_id_fk" FOREIGN KEY ("c_id") REFERENCES "public"."c"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "c2w" ADD CONSTRAINT "c2w_w_id_w_id_fk" FOREIGN KEY ("w_id") REFERENCES "public"."w"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cEC" ADD CONSTRAINT "cEC_curriculum_id_c_id_fk" FOREIGN KEY ("curriculum_id") REFERENCES "public"."c"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cEC" ADD CONSTRAINT "cEC_event_id_e_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."e"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "d" ADD CONSTRAINT "d_w_id_w_id_fk" FOREIGN KEY ("w_id") REFERENCES "public"."w"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m2e" ADD CONSTRAINT "m2e_module_id_m_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."m"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m2e" ADD CONSTRAINT "m2e_event_id_e_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."e"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cMDA" ADD CONSTRAINT "cMDA_c_id_c_id_fk" FOREIGN KEY ("c_id") REFERENCES "public"."c"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cMDA" ADD CONSTRAINT "cMDA_m_id_m_id_fk" FOREIGN KEY ("m_id") REFERENCES "public"."m"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cMDA" ADD CONSTRAINT "cMDA_w_id_w_id_fk" FOREIGN KEY ("w_id") REFERENCES "public"."w"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cMDA" ADD CONSTRAINT "cMDA_d_id_d_id_fk" FOREIGN KEY ("d_id") REFERENCES "public"."d"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "s2m" ADD CONSTRAINT "s2m_syllabus_id_s_id_fk" FOREIGN KEY ("syllabus_id") REFERENCES "public"."s"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "s2m" ADD CONSTRAINT "s2m_module_id_m_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."m"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "w2d" ADD CONSTRAINT "w2d_w_id_w_id_fk" FOREIGN KEY ("w_id") REFERENCES "public"."w"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "w2d" ADD CONSTRAINT "w2d_d_id_d_id_fk" FOREIGN KEY ("d_id") REFERENCES "public"."d"("id") ON DELETE cascade ON UPDATE no action;