CREATE TYPE "finance"."recurring_pattern_status" AS ENUM('suggested', 'confirmed', 'dismissed');--> statement-breakpoint
CREATE TABLE "finance"."recurring_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"pattern_key" varchar(320) NOT NULL,
	"kind" varchar(8) NOT NULL,
	"counterparty" varchar(160) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"frequency" varchar(8) NOT NULL,
	"typical_amount_minor" bigint NOT NULL,
	"min_amount_minor" bigint NOT NULL,
	"max_amount_minor" bigint NOT NULL,
	"first_observed_on" timestamp with time zone NOT NULL,
	"last_observed_on" timestamp with time zone NOT NULL,
	"next_expected_on" timestamp with time zone NOT NULL,
	"observation_count" integer NOT NULL,
	"status" "finance"."recurring_pattern_status" DEFAULT 'suggested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_patterns_household_key_unique" UNIQUE("household_id","pattern_key"),
	CONSTRAINT "recurring_patterns_kind_valid" CHECK ("finance"."recurring_patterns"."kind" in ('expense', 'income')),
	CONSTRAINT "recurring_patterns_frequency_valid" CHECK ("finance"."recurring_patterns"."frequency" in ('weekly', 'monthly'))
);
--> statement-breakpoint
ALTER TABLE "finance"."recurring_patterns" ADD CONSTRAINT "recurring_patterns_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "finance"."households"("id") ON DELETE cascade ON UPDATE no action;