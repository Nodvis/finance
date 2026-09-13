CREATE TABLE "finance"."budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"month" date NOT NULL,
	"limit_amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"archived_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budgets_household_id_id_unique" UNIQUE("household_id","id"),
	CONSTRAINT "budgets_household_category_month_currency_unique" UNIQUE("household_id","category_id","month","currency"),
	CONSTRAINT "budgets_limit_positive" CHECK ("finance"."budgets"."limit_amount_minor" > 0),
	CONSTRAINT "budgets_month_format" CHECK ("finance"."budgets"."month" = date_trunc('month', "finance"."budgets"."month")::date),
	CONSTRAINT "budgets_currency_format" CHECK ("finance"."budgets"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "budgets_version_positive" CHECK ("finance"."budgets"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "finance"."budgets" ADD CONSTRAINT "budgets_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "finance"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."budgets" ADD CONSTRAINT "budgets_household_category_fk" FOREIGN KEY ("household_id","category_id") REFERENCES "finance"."categories"("household_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budgets_household_month_idx" ON "finance"."budgets" USING btree ("household_id","month");