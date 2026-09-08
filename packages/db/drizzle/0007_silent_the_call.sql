ALTER TABLE "finance"."statement_import_batches" ADD COLUMN "source_namespace" varchar(64) DEFAULT 'generic_csv' NOT NULL;--> statement-breakpoint
ALTER TABLE "finance"."statement_import_batches" ADD COLUMN "source_account_id" varchar(128);--> statement-breakpoint
ALTER TABLE "finance"."statement_import_rows" ADD COLUMN "source_namespace" varchar(64) DEFAULT 'generic_csv' NOT NULL;--> statement-breakpoint
ALTER TABLE "finance"."statement_import_rows" ADD COLUMN "source_account_id" varchar(128);--> statement-breakpoint
ALTER TABLE "finance"."statement_import_rows" ADD COLUMN "authoritative_id" varchar(255);--> statement-breakpoint
ALTER TABLE "finance"."statement_import_rows" ADD COLUMN "fallback_identifier" varchar(255);--> statement-breakpoint
ALTER TABLE "finance"."statement_import_rows" ADD COLUMN "fallback_evidence" jsonb;--> statement-breakpoint
ALTER TABLE "finance"."statement_import_rows" ADD COLUMN "occurrence_index" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "finance"."statement_import_rows" ADD COLUMN "identity_type" varchar(32) DEFAULT 'fallback' NOT NULL;--> statement-breakpoint
ALTER TABLE "finance"."statement_import_rows" ADD COLUMN "ambiguity_state" varchar(32) DEFAULT 'unambiguous' NOT NULL;--> statement-breakpoint
ALTER TABLE "finance"."statement_import_rows" ADD COLUMN "canonical_transaction_id" uuid;--> statement-breakpoint
ALTER TABLE "finance"."statement_import_rows" ADD COLUMN "matched_import_row_id" uuid;--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD COLUMN "source_namespace" varchar(64) DEFAULT 'generic_csv' NOT NULL;--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD COLUMN "source_account_id" varchar(128) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD COLUMN "authoritative_id" varchar(255);--> statement-breakpoint
ALTER TABLE "finance"."statement_import_rows" ADD CONSTRAINT "statement_import_rows_canonical_transaction_id_transactions_id_fk" FOREIGN KEY ("canonical_transaction_id") REFERENCES "finance"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."statement_import_rows" ADD CONSTRAINT "statement_import_rows_matched_row_fk" FOREIGN KEY ("matched_import_row_id") REFERENCES "finance"."statement_import_rows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "statement_import_rows_account_auth_imported_idx" ON "finance"."statement_import_rows" USING btree ("household_id","account_id","source_namespace",coalesce("source_account_id", "account_id"::text),"authoritative_id") WHERE "finance"."statement_import_rows"."status" = 'imported' and "finance"."statement_import_rows"."authoritative_id" is not null;--> statement-breakpoint
CREATE INDEX "statement_import_rows_canonical_tx_id_idx" ON "finance"."statement_import_rows" USING btree ("canonical_transaction_id");--> statement-breakpoint
CREATE INDEX "statement_import_rows_matched_row_id_idx" ON "finance"."statement_import_rows" USING btree ("matched_import_row_id");--> statement-breakpoint
CREATE INDEX "statement_import_rows_fallback_idx" ON "finance"."statement_import_rows" USING btree ("household_id","account_id","fallback_identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_household_account_authoritative_idx" ON "finance"."transactions" USING btree ("household_id","account_id","source_namespace",coalesce("source_account_id", "account_id"::text),"authoritative_id") WHERE "finance"."transactions"."authoritative_id" is not null;