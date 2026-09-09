ALTER TABLE "finance"."credit_facilities" ADD CONSTRAINT "credit_facilities_household_id_id_unique" UNIQUE("household_id","id");--> statement-breakpoint
CREATE TYPE "finance"."bnpl_payment_model" AS ENUM('pay_in_full', 'pay_in_30', 'installments', 'split_pay', 'revolving', 'other');--> statement-breakpoint
CREATE TYPE "finance"."bnpl_purchase_status" AS ENUM('pending', 'active', 'settled', 'overdue', 'cancelled', 'defaulted');--> statement-breakpoint
CREATE TABLE "finance"."bnpl_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"credit_facility_id" uuid NOT NULL,
	"provider" varchar(160) NOT NULL,
	"product" varchar(160) NOT NULL,
	"merchant" varchar(160) NOT NULL,
	"description" varchar(280),
	"purchase_date" timestamp with time zone NOT NULL,
	"financing_date" timestamp with time zone NOT NULL,
	"original_amount_minor" bigint NOT NULL,
	"financed_amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"observed_outstanding_minor" bigint,
	"observed_outstanding_at" timestamp with time zone,
	"payment_model" "finance"."bnpl_payment_model" DEFAULT 'pay_in_30' NOT NULL,
	"status" "finance"."bnpl_purchase_status" DEFAULT 'active' NOT NULL,
	"due_date" timestamp with time zone,
	"principal_minor" bigint,
	"interest_minor" bigint,
	"fee_minor" bigint,
	"transaction_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"voided_at" timestamp with time zone,
	"void_reason" varchar(280),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bnpl_purchases_household_id_id_unique" UNIQUE("household_id","id"),
	CONSTRAINT "bnpl_purchases_provider_not_blank" CHECK (length(btrim("finance"."bnpl_purchases"."provider")) > 0),
	CONSTRAINT "bnpl_purchases_product_not_blank" CHECK (length(btrim("finance"."bnpl_purchases"."product")) > 0),
	CONSTRAINT "bnpl_purchases_merchant_not_blank" CHECK (length(btrim("finance"."bnpl_purchases"."merchant")) > 0),
	CONSTRAINT "bnpl_purchases_currency_format" CHECK ("finance"."bnpl_purchases"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "bnpl_purchases_original_amount_positive" CHECK ("finance"."bnpl_purchases"."original_amount_minor" > 0),
	CONSTRAINT "bnpl_purchases_financed_amount_positive" CHECK ("finance"."bnpl_purchases"."financed_amount_minor" > 0),
	CONSTRAINT "bnpl_purchases_observed_outstanding_complete" CHECK (("finance"."bnpl_purchases"."observed_outstanding_minor" is null) = ("finance"."bnpl_purchases"."observed_outstanding_at" is null)),
	CONSTRAINT "bnpl_purchases_observed_outstanding_non_negative" CHECK ("finance"."bnpl_purchases"."observed_outstanding_minor" is null or "finance"."bnpl_purchases"."observed_outstanding_minor" >= 0),
	CONSTRAINT "bnpl_purchases_principal_non_negative" CHECK ("finance"."bnpl_purchases"."principal_minor" is null or "finance"."bnpl_purchases"."principal_minor" >= 0),
	CONSTRAINT "bnpl_purchases_interest_non_negative" CHECK ("finance"."bnpl_purchases"."interest_minor" is null or "finance"."bnpl_purchases"."interest_minor" >= 0),
	CONSTRAINT "bnpl_purchases_fee_non_negative" CHECK ("finance"."bnpl_purchases"."fee_minor" is null or "finance"."bnpl_purchases"."fee_minor" >= 0),
	CONSTRAINT "bnpl_purchases_version_positive" CHECK ("finance"."bnpl_purchases"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "finance"."bnpl_purchases" ADD CONSTRAINT "bnpl_purchases_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "finance"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."bnpl_purchases" ADD CONSTRAINT "bnpl_purchases_household_credit_facility_fk" FOREIGN KEY ("household_id","credit_facility_id") REFERENCES "finance"."credit_facilities"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "finance"."bnpl_purchases" ADD CONSTRAINT "bnpl_purchases_transaction_fk" FOREIGN KEY ("transaction_id") REFERENCES "finance"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bnpl_purchases_household_id_idx" ON "finance"."bnpl_purchases" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "bnpl_purchases_credit_facility_id_idx" ON "finance"."bnpl_purchases" USING btree ("credit_facility_id");--> statement-breakpoint
CREATE INDEX "bnpl_purchases_transaction_id_idx" ON "finance"."bnpl_purchases" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "bnpl_purchases_purchase_date_idx" ON "finance"."bnpl_purchases" USING btree ("purchase_date");--> statement-breakpoint
CREATE INDEX "bnpl_purchases_due_date_idx" ON "finance"."bnpl_purchases" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "bnpl_purchases_household_status_idx" ON "finance"."bnpl_purchases" USING btree ("household_id","status");--> statement-breakpoint