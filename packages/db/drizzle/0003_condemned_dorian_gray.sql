CREATE TYPE "finance"."category_applicability" AS ENUM('expense', 'income', 'both');--> statement-breakpoint
CREATE TABLE "finance"."categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"applicability" "finance"."category_applicability" NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_household_id_id_unique" UNIQUE("household_id","id"),
	CONSTRAINT "categories_name_not_blank" CHECK (length(btrim("finance"."categories"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "finance"."transactions" DROP CONSTRAINT "transactions_kind_structure";--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "finance"."categories" ADD CONSTRAINT "categories_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "finance"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_household_id_idx" ON "finance"."categories" USING btree ("household_id");--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_household_category_fk" FOREIGN KEY ("household_id","category_id") REFERENCES "finance"."categories"("household_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_category_id_idx" ON "finance"."transactions" USING btree ("category_id");--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_kind_structure" CHECK ((
        ("finance"."transactions"."kind" = 'expense' and "finance"."transactions"."account_id" is not null and "finance"."transactions"."payee" is not null and length(btrim("finance"."transactions"."payee")) > 0 and "finance"."transactions"."paid_by_person_id" is not null and "finance"."transactions"."source" is null and "finance"."transactions"."received_by_person_id" is null and "finance"."transactions"."from_account_id" is null and "finance"."transactions"."to_account_id" is null)
        or
        ("finance"."transactions"."kind" = 'income' and "finance"."transactions"."account_id" is not null and "finance"."transactions"."source" is not null and length(btrim("finance"."transactions"."source")) > 0 and "finance"."transactions"."received_by_person_id" is not null and "finance"."transactions"."payee" is null and "finance"."transactions"."paid_by_person_id" is null and "finance"."transactions"."from_account_id" is null and "finance"."transactions"."to_account_id" is null)
        or
        ("finance"."transactions"."kind" = 'transfer' and "finance"."transactions"."from_account_id" is not null and "finance"."transactions"."to_account_id" is not null and "finance"."transactions"."account_id" is null and "finance"."transactions"."payee" is null and "finance"."transactions"."paid_by_person_id" is null and "finance"."transactions"."source" is null and "finance"."transactions"."received_by_person_id" is null and "finance"."transactions"."category_id" is null)
      ));--> statement-breakpoint
INSERT INTO "finance"."categories" ("id", "household_id", "name", "applicability", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    h."id",
    c.name,
    c.applicability::"finance"."category_applicability",
    now(),
    now()
FROM "finance"."households" h
CROSS JOIN (
    VALUES
        ('Jedzenie i zakupy codzienne', 'expense'),
        ('Mieszkanie i rachunki', 'expense'),
        ('Transport i paliwo', 'expense'),
        ('Zdrowie i uroda', 'expense'),
        ('Rozrywka i wypoczynek', 'expense'),
        ('Ubrania i obuwie', 'expense'),
        ('Inne wydatki', 'expense'),
        ('Wynagrodzenie i praca', 'income'),
        ('Świadczenia i zasiłki', 'income'),
        ('Inne przychody', 'income'),
        ('Zwroty i rozliczenia', 'both')
) AS c(name, applicability)
WHERE NOT EXISTS (
    SELECT 1 FROM "finance"."categories" existing
    WHERE existing.household_id = h.id AND existing.name = c.name
);