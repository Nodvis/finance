CREATE TABLE "finance"."recurring_obligation_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"title" varchar(160) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"frequency" varchar(7) NOT NULL,
	"first_due_date" date NOT NULL,
	"end_date" date,
	"notes" varchar(280),
	"version" integer DEFAULT 1 NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_definitions_title_not_blank" CHECK (length(btrim("finance"."recurring_obligation_definitions"."title")) > 0),
	CONSTRAINT "recurring_definitions_amount_positive" CHECK ("finance"."recurring_obligation_definitions"."amount_minor" > 0),
	CONSTRAINT "recurring_definitions_currency_format" CHECK ("finance"."recurring_obligation_definitions"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "recurring_definitions_frequency_valid" CHECK ("finance"."recurring_obligation_definitions"."frequency" in ('weekly', 'monthly', 'yearly')),
	CONSTRAINT "recurring_definitions_date_range_valid" CHECK ("finance"."recurring_obligation_definitions"."end_date" is null or "finance"."recurring_obligation_definitions"."end_date" >= "finance"."recurring_obligation_definitions"."first_due_date"),
	CONSTRAINT "recurring_definitions_version_positive" CHECK ("finance"."recurring_obligation_definitions"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "finance"."obligations" ADD COLUMN "recurring_definition_id" uuid;--> statement-breakpoint
ALTER TABLE "finance"."recurring_obligation_definitions" ADD CONSTRAINT "recurring_obligation_definitions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "finance"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_definitions_household_idx" ON "finance"."recurring_obligation_definitions" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "recurring_definitions_active_idx" ON "finance"."recurring_obligation_definitions" USING btree ("household_id","cancelled_at");--> statement-breakpoint
ALTER TABLE "finance"."obligations" ADD CONSTRAINT "obligations_recurring_definition_fk" FOREIGN KEY ("recurring_definition_id") REFERENCES "finance"."recurring_obligation_definitions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "obligations_recurring_definition_idx" ON "finance"."obligations" USING btree ("recurring_definition_id","due_date");