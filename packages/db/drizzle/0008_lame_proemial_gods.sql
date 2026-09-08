CREATE TYPE "finance"."account_identifier_type" AS ENUM('iban', 'domestic_nrb');--> statement-breakpoint
CREATE TABLE "finance"."account_identifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"identifier_type" "finance"."account_identifier_type" DEFAULT 'iban' NOT NULL,
	"raw_identifier" varchar(128) NOT NULL,
	"normalized_identifier" varchar(64) NOT NULL,
	"label" varchar(160),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."transfer_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"transfer_transaction_id" uuid NOT NULL,
	"matched_transaction_id" uuid NOT NULL,
	"matched_identifier" varchar(64),
	"match_confidence" varchar(32) DEFAULT 'automatic' NOT NULL,
	"notes" varchar(280),
	"matched_by_auth_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finance"."account_identifiers" ADD CONSTRAINT "account_identifiers_household_account_fk" FOREIGN KEY ("household_id","account_id") REFERENCES "finance"."accounts"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."account_identifiers" ADD CONSTRAINT "account_identifiers_household_fk" FOREIGN KEY ("household_id") REFERENCES "finance"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."transfer_matches" ADD CONSTRAINT "transfer_matches_matched_by_auth_user_id_auth_users_id_fk" FOREIGN KEY ("matched_by_auth_user_id") REFERENCES "finance"."auth_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."transfer_matches" ADD CONSTRAINT "transfer_matches_household_fk" FOREIGN KEY ("household_id") REFERENCES "finance"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."transfer_matches" ADD CONSTRAINT "transfer_matches_transfer_tx_fk" FOREIGN KEY ("transfer_transaction_id") REFERENCES "finance"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."transfer_matches" ADD CONSTRAINT "transfer_matches_matched_tx_fk" FOREIGN KEY ("matched_transaction_id") REFERENCES "finance"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_identifiers_household_id_idx" ON "finance"."account_identifiers" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "account_identifiers_account_id_idx" ON "finance"."account_identifiers" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_identifiers_household_normalized_idx" ON "finance"."account_identifiers" USING btree ("household_id","normalized_identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "transfer_matches_transfer_matched_idx" ON "finance"."transfer_matches" USING btree ("transfer_transaction_id","matched_transaction_id");--> statement-breakpoint
CREATE INDEX "transfer_matches_household_id_idx" ON "finance"."transfer_matches" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "transfer_matches_transfer_tx_idx" ON "finance"."transfer_matches" USING btree ("transfer_transaction_id");--> statement-breakpoint
CREATE INDEX "transfer_matches_matched_tx_idx" ON "finance"."transfer_matches" USING btree ("matched_transaction_id");