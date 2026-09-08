ALTER TABLE "finance"."transactions" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD COLUMN "void_reason" varchar(280);--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD COLUMN "submission_id" varchar(64);--> statement-breakpoint
CREATE INDEX "transactions_household_voided_at_idx" ON "finance"."transactions" USING btree ("household_id","voided_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_household_submission_id_idx" ON "finance"."transactions" USING btree ("household_id","submission_id");--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_version_positive" CHECK ("finance"."transactions"."version" >= 1);