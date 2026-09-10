-- The 0016 snapshot contained a redundant FK absent from its deployed SQL.
-- Keep the real household FK; there is no bnpl_purchases_household_fk to drop.
ALTER TABLE "finance"."liability_repayments" ADD COLUMN "owns_transaction" boolean;