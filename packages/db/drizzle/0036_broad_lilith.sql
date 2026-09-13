DO $$
BEGIN
  ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_household_id_id_unique" UNIQUE("household_id","id");
EXCEPTION
  WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;