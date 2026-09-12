CREATE TYPE "finance"."balance_observation_source" AS ENUM('manual', 'imported', 'reconciled', 'legacy');--> statement-breakpoint
CREATE TABLE "finance"."balance_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"account_id" uuid,
	"liability_id" uuid,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"source" "finance"."balance_observation_source" DEFAULT 'manual' NOT NULL,
	"note" varchar(280),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "balance_observations_exactly_one_subject" CHECK (("finance"."balance_observations"."account_id" is not null)::int + ("finance"."balance_observations"."liability_id" is not null)::int = 1),
	CONSTRAINT "balance_observations_currency_format" CHECK ("finance"."balance_observations"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "balance_observations_liability_amount_non_negative" CHECK ("finance"."balance_observations"."liability_id" is null or "finance"."balance_observations"."amount_minor" >= 0),
	CONSTRAINT "balance_observations_note_length" CHECK ("finance"."balance_observations"."note" is null or length("finance"."balance_observations"."note") <= 280)
);
--> statement-breakpoint
ALTER TABLE "finance"."balance_observations" ADD CONSTRAINT "balance_observations_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "finance"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."balance_observations" ADD CONSTRAINT "balance_observations_household_account_fk" FOREIGN KEY ("household_id","account_id") REFERENCES "finance"."accounts"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."balance_observations" ADD CONSTRAINT "balance_observations_household_liability_fk" FOREIGN KEY ("household_id","liability_id") REFERENCES "finance"."liabilities"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "balance_observations_household_observed_at_idx" ON "finance"."balance_observations" USING btree ("household_id","observed_at");--> statement-breakpoint
CREATE INDEX "balance_observations_account_observed_at_idx" ON "finance"."balance_observations" USING btree ("account_id","observed_at");--> statement-breakpoint
CREATE INDEX "balance_observations_liability_observed_at_idx" ON "finance"."balance_observations" USING btree ("liability_id","observed_at");--> statement-breakpoint
INSERT INTO "finance"."balance_observations" ("id", "household_id", "account_id", "amount_minor", "currency", "observed_at", "source", "note", "created_at")
SELECT gen_random_uuid(), "household_id", "id", "balance_snapshot_minor", "currency", "balance_snapshot_at", 'legacy', 'Migrated from released balance snapshot; original provenance is unknown.', now()
FROM "finance"."accounts"
WHERE "balance_snapshot_minor" IS NOT NULL AND "balance_snapshot_at" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "finance"."balance_observations" ("id", "household_id", "liability_id", "amount_minor", "currency", "observed_at", "source", "note", "created_at")
SELECT gen_random_uuid(), "household_id", "id", "observed_outstanding_minor", "currency", "observed_outstanding_at", 'legacy', 'Migrated from released balance snapshot; original provenance is unknown.', now()
FROM "finance"."liabilities"
WHERE "observed_outstanding_minor" IS NOT NULL AND "observed_outstanding_at" IS NOT NULL
ON CONFLICT DO NOTHING;