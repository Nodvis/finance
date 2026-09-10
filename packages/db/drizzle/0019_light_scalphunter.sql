CREATE TABLE "finance"."obligations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"title" varchar(160) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"due_date" date NOT NULL,
	"notes" varchar(280),
	"transaction_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "obligations_title_not_blank" CHECK (length(btrim("finance"."obligations"."title")) > 0),
	CONSTRAINT "obligations_amount_positive" CHECK ("finance"."obligations"."amount_minor" > 0),
	CONSTRAINT "obligations_currency_format" CHECK ("finance"."obligations"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "obligations_version_positive" CHECK ("finance"."obligations"."version" >= 1)
);
--> statement-breakpoint
DROP INDEX "finance"."liability_repayments_active_transaction_unique";--> statement-breakpoint
DROP INDEX "finance"."bnpl_purchases_active_transaction_unique";--> statement-breakpoint
ALTER TABLE "finance"."obligations" ADD CONSTRAINT "obligations_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "finance"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."obligations" ADD CONSTRAINT "obligations_transaction_fk" FOREIGN KEY ("transaction_id") REFERENCES "finance"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "obligations_household_id_idx" ON "finance"."obligations" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "obligations_due_date_idx" ON "finance"."obligations" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "obligations_household_due_date_idx" ON "finance"."obligations" USING btree ("household_id","due_date");--> statement-breakpoint
CREATE INDEX "obligations_transaction_id_idx" ON "finance"."obligations" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "obligations_household_cancelled_at_idx" ON "finance"."obligations" USING btree ("household_id","cancelled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "obligations_active_transaction_unique" ON "finance"."obligations" USING btree ("transaction_id") WHERE "finance"."obligations"."transaction_id" is not null and "finance"."obligations"."cancelled_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "liability_repayments_active_transaction_unique" ON "finance"."liability_repayments" USING btree ("transaction_id") WHERE "finance"."liability_repayments"."transaction_id" is not null and "finance"."liability_repayments"."voided_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "bnpl_purchases_active_transaction_unique" ON "finance"."bnpl_purchases" USING btree ("transaction_id") WHERE "finance"."bnpl_purchases"."transaction_id" is not null and "finance"."bnpl_purchases"."voided_at" is null;