CREATE TYPE "public"."constraint_type" AS ENUM('RELATIONAL', 'TEMPORAL');--> statement-breakpoint
CREATE TYPE "public"."relation_type" AS ENUM('after', 'before');--> statement-breakpoint
CREATE TABLE "cntrs" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "constraint_type" NOT NULL,
	"owner_event_id" text,
	"owner_module_id" text,
	"relation" "relation_type",
	"target_event_id" text,
	"target_module_id" text,
	"min_delay_days" integer,
	"max_delay_days" integer,
	"allowed_days" integer[],
	"forbidden_days" integer[],
	"ca" timestamp DEFAULT now() NOT NULL,
	"ua" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cntrs" ADD CONSTRAINT "cntrs_owner_event_id_e_id_fk" FOREIGN KEY ("owner_event_id") REFERENCES "public"."e"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cntrs" ADD CONSTRAINT "cntrs_owner_module_id_m_id_fk" FOREIGN KEY ("owner_module_id") REFERENCES "public"."m"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cntrs" ADD CONSTRAINT "cntrs_target_event_id_e_id_fk" FOREIGN KEY ("target_event_id") REFERENCES "public"."e"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cntrs" ADD CONSTRAINT "cntrs_target_module_id_m_id_fk" FOREIGN KEY ("target_module_id") REFERENCES "public"."m"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "e" DROP COLUMN "req";