CREATE TYPE "finance"."categorization_rule_application_status" AS ENUM('applied', 'skipped_conflict');--> statement-breakpoint
CREATE TYPE "finance"."categorization_rule_match_field" AS ENUM('counterparty');--> statement-breakpoint
CREATE TYPE "finance"."categorization_rule_match_mode" AS ENUM('contains', 'exact', 'starts_with');--> statement-breakpoint
CREATE TABLE "finance"."categorization_rule_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"rule_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"before_category_id" uuid,
	"after_category_id" uuid,
	"status" "finance"."categorization_rule_application_status" NOT NULL,
	"explanation" varchar(280) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."categorization_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"match_field" "finance"."categorization_rule_match_field" NOT NULL,
	"match_mode" "finance"."categorization_rule_match_mode" NOT NULL,
	"match_text" varchar(160) NOT NULL,
	"applicability" varchar(16) NOT NULL,
	"category_id" uuid NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categorization_rules_name_not_blank" CHECK (length(btrim("finance"."categorization_rules"."name")) > 0),
	CONSTRAINT "categorization_rules_match_text_not_blank" CHECK (length(btrim("finance"."categorization_rules"."match_text")) > 0),
	CONSTRAINT "categorization_rules_priority_nonnegative" CHECK ("finance"."categorization_rules"."priority" >= 0),
	CONSTRAINT "categorization_rules_applicability_valid" CHECK ("finance"."categorization_rules"."applicability" in ('expense', 'income', 'both'))
);
--> statement-breakpoint
ALTER TABLE "finance"."categorization_rule_applications" ADD CONSTRAINT "categorization_rule_applications_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "finance"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."categorization_rule_applications" ADD CONSTRAINT "categorization_rule_applications_rule_id_categorization_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "finance"."categorization_rules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."categorization_rule_applications" ADD CONSTRAINT "categorization_rule_applications_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "finance"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."categorization_rules" ADD CONSTRAINT "categorization_rules_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "finance"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."categorization_rules" ADD CONSTRAINT "categorization_rules_household_category_fk" FOREIGN KEY ("household_id","category_id") REFERENCES "finance"."categories"("household_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categorization_rule_applications_household_idx" ON "finance"."categorization_rule_applications" USING btree ("household_id","created_at");--> statement-breakpoint
CREATE INDEX "categorization_rule_applications_transaction_idx" ON "finance"."categorization_rule_applications" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "categorization_rules_household_idx" ON "finance"."categorization_rules" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "categorization_rules_lookup_idx" ON "finance"."categorization_rules" USING btree ("household_id","enabled","priority");