CREATE TYPE "finance"."savings_goal_status" AS ENUM('active', 'completed', 'archived');--> statement-breakpoint
CREATE TABLE "finance"."savings_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"target_amount_minor" bigint NOT NULL,
	"current_amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"target_date" date,
	"account_id" uuid,
	"status" "finance"."savings_goal_status" DEFAULT 'active' NOT NULL,
	"notes" varchar(500),
	"completed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "savings_goals_household_id_id_unique" UNIQUE("household_id","id"),
	CONSTRAINT "savings_goals_name_not_blank" CHECK (length(btrim("finance"."savings_goals"."name")) > 0),
	CONSTRAINT "savings_goals_target_amount_positive" CHECK ("finance"."savings_goals"."target_amount_minor" > 0),
	CONSTRAINT "savings_goals_current_amount_non_negative" CHECK ("finance"."savings_goals"."current_amount_minor" >= 0),
	CONSTRAINT "savings_goals_currency_format" CHECK ("finance"."savings_goals"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "savings_goals_notes_length" CHECK ("finance"."savings_goals"."notes" is null or length("finance"."savings_goals"."notes") <= 500),
	CONSTRAINT "savings_goals_version_positive" CHECK ("finance"."savings_goals"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "finance"."savings_goals" ADD CONSTRAINT "savings_goals_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "finance"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."savings_goals" ADD CONSTRAINT "savings_goals_household_account_fk" FOREIGN KEY ("household_id","account_id") REFERENCES "finance"."accounts"("household_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "savings_goals_household_id_idx" ON "finance"."savings_goals" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "savings_goals_account_id_idx" ON "finance"."savings_goals" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "savings_goals_household_status_idx" ON "finance"."savings_goals" USING btree ("household_id","status");--> statement-breakpoint
CREATE INDEX "savings_goals_target_date_idx" ON "finance"."savings_goals" USING btree ("target_date");