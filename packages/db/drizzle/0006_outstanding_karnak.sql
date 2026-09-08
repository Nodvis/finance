CREATE TYPE "finance"."statement_import_batch_status" AS ENUM('preview', 'committed', 'failed');--> statement-breakpoint
CREATE TYPE "finance"."statement_import_row_kind" AS ENUM('expense', 'income');--> statement-breakpoint
CREATE TYPE "finance"."statement_import_row_status" AS ENUM('pending', 'imported', 'skipped', 'duplicate', 'error');--> statement-breakpoint
CREATE TABLE "finance"."statement_import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"source_filename" varchar(255) NOT NULL,
	"file_hash" varchar(64) NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"parser_version" varchar(32) DEFAULT '1.0.0' NOT NULL,
	"mapping_config" jsonb NOT NULL,
	"status" "finance"."statement_import_batch_status" DEFAULT 'preview' NOT NULL,
	"total_row_count" integer DEFAULT 0 NOT NULL,
	"valid_row_count" integer DEFAULT 0 NOT NULL,
	"invalid_row_count" integer DEFAULT 0 NOT NULL,
	"imported_row_count" integer DEFAULT 0 NOT NULL,
	"skipped_row_count" integer DEFAULT 0 NOT NULL,
	"created_by_auth_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"committed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "finance"."statement_import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"row_index" integer NOT NULL,
	"source_row_identity" varchar(255),
	"dedupe_hash" varchar(64) NOT NULL,
	"status" "finance"."statement_import_row_status" DEFAULT 'pending' NOT NULL,
	"error_code" varchar(64),
	"error_message" varchar(500),
	"raw_row_content" varchar(2000),
	"raw_values" jsonb,
	"normalized_occurred_on" timestamp with time zone,
	"normalized_kind" "finance"."statement_import_row_kind",
	"normalized_amount_minor" bigint,
	"normalized_currency" varchar(3),
	"normalized_payee" varchar(160),
	"normalized_source" varchar(160),
	"normalized_description" varchar(280),
	"committed_transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "statement_import_rows_currency_format" CHECK ("finance"."statement_import_rows"."normalized_currency" is null or "finance"."statement_import_rows"."normalized_currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "finance"."statement_import_batches" ADD CONSTRAINT "statement_import_batches_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "finance"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."statement_import_batches" ADD CONSTRAINT "statement_import_batches_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "finance"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."statement_import_batches" ADD CONSTRAINT "statement_import_batches_created_by_auth_user_id_auth_users_id_fk" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "finance"."auth_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."statement_import_batches" ADD CONSTRAINT "statement_import_batches_household_account_fk" FOREIGN KEY ("household_id","account_id") REFERENCES "finance"."accounts"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."statement_import_rows" ADD CONSTRAINT "statement_import_rows_batch_id_statement_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "finance"."statement_import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."statement_import_rows" ADD CONSTRAINT "statement_import_rows_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "finance"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."statement_import_rows" ADD CONSTRAINT "statement_import_rows_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "finance"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."statement_import_rows" ADD CONSTRAINT "statement_import_rows_committed_transaction_id_transactions_id_fk" FOREIGN KEY ("committed_transaction_id") REFERENCES "finance"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."statement_import_rows" ADD CONSTRAINT "statement_import_rows_household_account_fk" FOREIGN KEY ("household_id","account_id") REFERENCES "finance"."accounts"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "statement_import_batches_household_id_idx" ON "finance"."statement_import_batches" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "statement_import_batches_account_id_idx" ON "finance"."statement_import_batches" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "statement_import_batches_household_created_at_idx" ON "finance"."statement_import_batches" USING btree ("household_id","created_at");--> statement-breakpoint
CREATE INDEX "statement_import_batches_account_file_hash_idx" ON "finance"."statement_import_batches" USING btree ("account_id","file_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "statement_import_rows_batch_row_idx" ON "finance"."statement_import_rows" USING btree ("batch_id","row_index");--> statement-breakpoint
CREATE UNIQUE INDEX "statement_import_rows_account_dedupe_idx" ON "finance"."statement_import_rows" USING btree ("account_id","dedupe_hash") WHERE "finance"."statement_import_rows"."status" = 'imported';--> statement-breakpoint
CREATE INDEX "statement_import_rows_batch_id_idx" ON "finance"."statement_import_rows" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "statement_import_rows_household_id_idx" ON "finance"."statement_import_rows" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "statement_import_rows_account_id_idx" ON "finance"."statement_import_rows" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "statement_import_rows_committed_tx_id_idx" ON "finance"."statement_import_rows" USING btree ("committed_transaction_id");