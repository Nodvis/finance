ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_household_id_id_unique" UNIQUE("household_id","id");--> statement-breakpoint
CREATE TABLE "finance"."transaction_split_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	CONSTRAINT "split_amount_positive" CHECK ("finance"."transaction_split_allocations"."amount_minor" > 0),
	CONSTRAINT "split_currency_format" CHECK ("finance"."transaction_split_allocations"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "finance"."transaction_split_allocations" ADD CONSTRAINT "transaction_split_allocations_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "finance"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."transaction_split_allocations" ADD CONSTRAINT "split_household_transaction_fk" FOREIGN KEY ("household_id","transaction_id") REFERENCES "finance"."transactions"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."transaction_split_allocations" ADD CONSTRAINT "split_household_category_fk" FOREIGN KEY ("household_id","category_id") REFERENCES "finance"."categories"("household_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "split_household_transaction_idx" ON "finance"."transaction_split_allocations" USING btree ("household_id","transaction_id");--> statement-breakpoint
CREATE INDEX "split_household_category_idx" ON "finance"."transaction_split_allocations" USING btree ("household_id","category_id");