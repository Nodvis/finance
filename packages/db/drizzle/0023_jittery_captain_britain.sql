DROP INDEX "finance"."obligations_recurring_definition_idx";--> statement-breakpoint
DROP INDEX "finance"."obligations_recurring_occurrence_unique";--> statement-breakpoint
ALTER TABLE "finance"."obligations" ADD COLUMN "recurring_scheduled_date" date;--> statement-breakpoint
UPDATE "finance"."obligations" SET "recurring_scheduled_date" = "due_date" WHERE "recurring_definition_id" is not null;--> statement-breakpoint
CREATE INDEX "obligations_recurring_definition_idx" ON "finance"."obligations" USING btree ("recurring_definition_id","recurring_scheduled_date");--> statement-breakpoint
CREATE UNIQUE INDEX "obligations_recurring_occurrence_unique" ON "finance"."obligations" USING btree ("recurring_definition_id","recurring_scheduled_date") WHERE "finance"."obligations"."recurring_definition_id" is not null and "finance"."obligations"."recurring_scheduled_date" is not null and "finance"."obligations"."cancelled_at" is null;