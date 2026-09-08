CREATE TYPE "finance"."transaction_audit_operation" AS ENUM('create', 'correction', 'void');--> statement-breakpoint
CREATE TYPE "finance"."transaction_audit_source" AS ENUM('manual', 'system', 'import');--> statement-breakpoint
CREATE TABLE "finance"."transaction_audit_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"operation" "finance"."transaction_audit_operation" NOT NULL,
	"source" "finance"."transaction_audit_source" DEFAULT 'manual' NOT NULL,
	"auth_user_id" uuid,
	"person_id" uuid,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"before_state" jsonb,
	"after_state" jsonb NOT NULL,
	"void_reason" varchar(280),
	CONSTRAINT "transaction_audit_revision_positive" CHECK ("finance"."transaction_audit_entries"."revision" >= 1)
);
--> statement-breakpoint
ALTER TABLE "finance"."transaction_audit_entries" ADD CONSTRAINT "transaction_audit_entries_auth_user_id_auth_users_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "finance"."auth_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."transaction_audit_entries" ADD CONSTRAINT "transaction_audit_entries_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "finance"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."transaction_audit_entries" ADD CONSTRAINT "transaction_audit_household_fk" FOREIGN KEY ("household_id") REFERENCES "finance"."households"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."transaction_audit_entries" ADD CONSTRAINT "transaction_audit_transaction_fk" FOREIGN KEY ("transaction_id") REFERENCES "finance"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_audit_tx_revision_unique" ON "finance"."transaction_audit_entries" USING btree ("transaction_id","revision");--> statement-breakpoint
CREATE INDEX "transaction_audit_tx_id_idx" ON "finance"."transaction_audit_entries" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "transaction_audit_household_id_idx" ON "finance"."transaction_audit_entries" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "transaction_audit_recorded_at_idx" ON "finance"."transaction_audit_entries" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "transaction_audit_household_recorded_at_idx" ON "finance"."transaction_audit_entries" USING btree ("household_id","recorded_at");--> statement-breakpoint
CREATE OR REPLACE FUNCTION finance.prevent_transaction_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Transaction audit entries are immutable and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER transaction_audit_entries_immutable_trigger
BEFORE UPDATE OR DELETE ON "finance"."transaction_audit_entries"
FOR EACH ROW
EXECUTE FUNCTION finance.prevent_transaction_audit_modification();