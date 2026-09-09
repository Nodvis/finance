CREATE TYPE "finance"."credit_facility_kind" AS ENUM('overdraft', 'revolving', 'credit_card', 'bnpl');--> statement-breakpoint
CREATE TABLE "finance"."credit_facilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"account_id" uuid,
	"kind" "finance"."credit_facility_kind" NOT NULL,
	"name" varchar(160) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"approved_limit_minor" bigint,
	"observed_used_minor" bigint,
	"observed_available_minor" bigint,
	"observed_at" timestamp with time zone,
	"effective_from" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_facilities_household_account_kind_unique" UNIQUE("household_id","account_id","kind"),
	CONSTRAINT "credit_facilities_name_not_blank" CHECK (length(btrim("finance"."credit_facilities"."name")) > 0),
	CONSTRAINT "credit_facilities_currency_format" CHECK ("finance"."credit_facilities"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "credit_facilities_limit_non_negative" CHECK ("finance"."credit_facilities"."approved_limit_minor" is null or "finance"."credit_facilities"."approved_limit_minor" >= 0),
	CONSTRAINT "credit_facilities_used_non_negative" CHECK ("finance"."credit_facilities"."observed_used_minor" is null or "finance"."credit_facilities"."observed_used_minor" >= 0),
	CONSTRAINT "credit_facilities_available_non_negative" CHECK ("finance"."credit_facilities"."observed_available_minor" is null or "finance"."credit_facilities"."observed_available_minor" >= 0),
	CONSTRAINT "credit_facilities_observation_complete" CHECK (("finance"."credit_facilities"."observed_at" is null) = ("finance"."credit_facilities"."observed_used_minor" is null and "finance"."credit_facilities"."observed_available_minor" is null)),
	CONSTRAINT "credit_facilities_overdraft_has_account" CHECK ("finance"."credit_facilities"."kind" <> 'overdraft' or "finance"."credit_facilities"."account_id" is not null),
	CONSTRAINT "credit_facilities_dates_ordered" CHECK ("finance"."credit_facilities"."expires_at" is null or "finance"."credit_facilities"."effective_from" is null or "finance"."credit_facilities"."expires_at" >= "finance"."credit_facilities"."effective_from"),
	CONSTRAINT "credit_facilities_version_positive" CHECK ("finance"."credit_facilities"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "finance"."credit_facilities" ADD CONSTRAINT "credit_facilities_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "finance"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."credit_facilities" ADD CONSTRAINT "credit_facilities_household_account_fk" FOREIGN KEY ("household_id","account_id") REFERENCES "finance"."accounts"("household_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_facilities_household_id_idx" ON "finance"."credit_facilities" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "credit_facilities_account_id_idx" ON "finance"."credit_facilities" USING btree ("account_id");