CREATE TABLE "e" (
	"id" text PRIMARY KEY NOT NULL,
	"t" text NOT NULL,
	"ty" "module_event_type" NOT NULL,
	"m_d" integer DEFAULT 0 NOT NULL,
	"req" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ca" timestamp DEFAULT now() NOT NULL,
	"ua" timestamp DEFAULT now() NOT NULL
);
