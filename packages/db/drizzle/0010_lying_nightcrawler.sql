CREATE TYPE "finance"."liability_kind" AS ENUM('loan', 'mortgage', 'installment', 'credit_line', 'other');--> statement-breakpoint
CREATE TABLE "finance"."liabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"kind" "finance"."liability_kind" DEFAULT 'loan' NOT NULL,
	"currency" varchar(3) NOT NULL,
	"observed_outstanding_minor" bigint,
	"observed_outstanding_at" timestamp with time zone,
	"responsible_person_id" uuid,
	"lender" varchar(160),
	"destination_account_id" uuid,
	"notes" varchar(280),
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "liabilities_household_id_id_unique" UNIQUE("household_id","id"),
	CONSTRAINT "liabilities_name_not_blank" CHECK (length(btrim("finance"."liabilities"."name")) > 0),
	CONSTRAINT "liabilities_currency_format" CHECK ("finance"."liabilities"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "liabilities_observed_outstanding_complete" CHECK (("finance"."liabilities"."observed_outstanding_minor" is null) = ("finance"."liabilities"."observed_outstanding_at" is null)),
	CONSTRAINT "liabilities_observed_outstanding_non_negative" CHECK ("finance"."liabilities"."observed_outstanding_minor" is null or "finance"."liabilities"."observed_outstanding_minor" >= 0),
	CONSTRAINT "liabilities_version_positive" CHECK ("finance"."liabilities"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "finance"."liability_repayments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"liability_id" uuid NOT NULL,
	"transaction_id" uuid,
	"paid_at" timestamp with time zone NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"principal_minor" bigint,
	"interest_minor" bigint,
	"fee_minor" bigint,
	"notes" varchar(280),
	"version" integer DEFAULT 1 NOT NULL,
	"voided_at" timestamp with time zone,
	"void_reason" varchar(280),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "liability_repayments_amount_positive" CHECK ("finance"."liability_repayments"."amount_minor" > 0),
	CONSTRAINT "liability_repayments_currency_format" CHECK ("finance"."liability_repayments"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "liability_repayments_principal_non_negative" CHECK ("finance"."liability_repayments"."principal_minor" is null or "finance"."liability_repayments"."principal_minor" >= 0),
	CONSTRAINT "liability_repayments_interest_non_negative" CHECK ("finance"."liability_repayments"."interest_minor" is null or "finance"."liability_repayments"."interest_minor" >= 0),
	CONSTRAINT "liability_repayments_fee_non_negative" CHECK ("finance"."liability_repayments"."fee_minor" is null or "finance"."liability_repayments"."fee_minor" >= 0),
	CONSTRAINT "liability_repayments_allocation_sum" CHECK (coalesce("finance"."liability_repayments"."principal_minor", 0) + coalesce("finance"."liability_repayments"."interest_minor", 0) + coalesce("finance"."liability_repayments"."fee_minor", 0) <= "finance"."liability_repayments"."amount_minor"),
	CONSTRAINT "liability_repayments_version_positive" CHECK ("finance"."liability_repayments"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "finance"."liabilities" ADD CONSTRAINT "liabilities_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "finance"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."liabilities" ADD CONSTRAINT "liabilities_household_responsible_person_fk" FOREIGN KEY ("household_id","responsible_person_id") REFERENCES "finance"."household_memberships"("household_id","person_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."liabilities" ADD CONSTRAINT "liabilities_household_dest_account_fk" FOREIGN KEY ("household_id","destination_account_id") REFERENCES "finance"."accounts"("household_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."liability_repayments" ADD CONSTRAINT "liability_repayments_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "finance"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."liability_repayments" ADD CONSTRAINT "liability_repayments_household_liability_fk" FOREIGN KEY ("household_id","liability_id") REFERENCES "finance"."liabilities"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."liability_repayments" ADD CONSTRAINT "liability_repayments_tx_fk" FOREIGN KEY ("transaction_id") REFERENCES "finance"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "liabilities_household_id_idx" ON "finance"."liabilities" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "liabilities_responsible_person_id_idx" ON "finance"."liabilities" USING btree ("responsible_person_id");--> statement-breakpoint
CREATE INDEX "liabilities_destination_account_id_idx" ON "finance"."liabilities" USING btree ("destination_account_id");--> statement-breakpoint
CREATE INDEX "liability_repayments_household_id_idx" ON "finance"."liability_repayments" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "liability_repayments_liability_id_idx" ON "finance"."liability_repayments" USING btree ("liability_id");--> statement-breakpoint
CREATE INDEX "liability_repayments_transaction_id_idx" ON "finance"."liability_repayments" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "liability_repayments_paid_at_idx" ON "finance"."liability_repayments" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "liability_repayments_household_paid_at_idx" ON "finance"."liability_repayments" USING btree ("household_id","paid_at");