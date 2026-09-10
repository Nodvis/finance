ALTER TABLE "finance"."liability_repayments" ALTER COLUMN "owns_transaction" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "finance"."liability_repayments" ALTER COLUMN "owns_transaction" DROP NOT NULL;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "finance"."liability_repayments"
    WHERE "voided_at" IS NULL AND "transaction_id" IS NOT NULL
    GROUP BY "transaction_id"
    HAVING count(*) > 1
  ) OR EXISTS (
    SELECT 1
    FROM "finance"."bnpl_purchases"
    WHERE "voided_at" IS NULL AND "transaction_id" IS NOT NULL
    GROUP BY "transaction_id"
    HAVING count(*) > 1
  ) OR EXISTS (
    SELECT 1
    FROM "finance"."bnpl_purchases" AS b
    INNER JOIN "finance"."liability_repayments" AS r
      ON r."transaction_id" = b."transaction_id"
    WHERE b."voided_at" IS NULL
      AND r."voided_at" IS NULL
      AND b."transaction_id" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Cannot create active transaction uniqueness: duplicate or cross-linked active relationships exist';
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "liability_repayments_active_transaction_unique" ON "finance"."liability_repayments" USING btree ("transaction_id") WHERE "finance"."liability_repayments"."transaction_id" is not null and "finance"."liability_repayments"."voided_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "bnpl_purchases_active_transaction_unique" ON "finance"."bnpl_purchases" USING btree ("transaction_id") WHERE "finance"."bnpl_purchases"."transaction_id" is not null and "finance"."bnpl_purchases"."voided_at" is null;