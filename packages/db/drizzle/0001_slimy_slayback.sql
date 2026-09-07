CREATE TYPE "finance"."transaction_kind" AS ENUM('expense', 'income', 'transfer');--> statement-breakpoint
CREATE TABLE "finance"."transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"kind" "finance"."transaction_kind" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"occurred_on" timestamp with time zone NOT NULL,
	"account_id" uuid,
	"payee" varchar(160),
	"paid_by_person_id" uuid,
	"source" varchar(160),
	"received_by_person_id" uuid,
	"from_account_id" uuid,
	"to_account_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_amount_positive" CHECK ("finance"."transactions"."amount_minor" > 0),
	CONSTRAINT "transactions_currency_format" CHECK ("finance"."transactions"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "transactions_transfer_distinct_accounts" CHECK ("finance"."transactions"."from_account_id" is null or "finance"."transactions"."to_account_id" is null or "finance"."transactions"."from_account_id" <> "finance"."transactions"."to_account_id"),
	CONSTRAINT "transactions_kind_structure" CHECK ((
        ("finance"."transactions"."kind" = 'expense' and "finance"."transactions"."account_id" is not null and "finance"."transactions"."payee" is not null and length(btrim("finance"."transactions"."payee")) > 0 and "finance"."transactions"."paid_by_person_id" is not null and "finance"."transactions"."source" is null and "finance"."transactions"."received_by_person_id" is null and "finance"."transactions"."from_account_id" is null and "finance"."transactions"."to_account_id" is null)
        or
        ("finance"."transactions"."kind" = 'income' and "finance"."transactions"."account_id" is not null and "finance"."transactions"."source" is not null and length(btrim("finance"."transactions"."source")) > 0 and "finance"."transactions"."received_by_person_id" is not null and "finance"."transactions"."payee" is null and "finance"."transactions"."paid_by_person_id" is null and "finance"."transactions"."from_account_id" is null and "finance"."transactions"."to_account_id" is null)
        or
        ("finance"."transactions"."kind" = 'transfer' and "finance"."transactions"."from_account_id" is not null and "finance"."transactions"."to_account_id" is not null and "finance"."transactions"."account_id" is null and "finance"."transactions"."payee" is null and "finance"."transactions"."paid_by_person_id" is null and "finance"."transactions"."source" is null and "finance"."transactions"."received_by_person_id" is null)
      ))
);
--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "finance"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_household_account_fk" FOREIGN KEY ("household_id","account_id") REFERENCES "finance"."accounts"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_household_from_account_fk" FOREIGN KEY ("household_id","from_account_id") REFERENCES "finance"."accounts"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_household_to_account_fk" FOREIGN KEY ("household_id","to_account_id") REFERENCES "finance"."accounts"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_household_paid_by_person_fk" FOREIGN KEY ("household_id","paid_by_person_id") REFERENCES "finance"."household_memberships"("household_id","person_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_household_received_by_person_fk" FOREIGN KEY ("household_id","received_by_person_id") REFERENCES "finance"."household_memberships"("household_id","person_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_household_id_idx" ON "finance"."transactions" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "transactions_account_id_idx" ON "finance"."transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "transactions_from_account_id_idx" ON "finance"."transactions" USING btree ("from_account_id");--> statement-breakpoint
CREATE INDEX "transactions_to_account_id_idx" ON "finance"."transactions" USING btree ("to_account_id");--> statement-breakpoint
CREATE INDEX "transactions_occurred_on_idx" ON "finance"."transactions" USING btree ("occurred_on");--> statement-breakpoint
CREATE INDEX "transactions_household_occurred_on_idx" ON "finance"."transactions" USING btree ("household_id","occurred_on");