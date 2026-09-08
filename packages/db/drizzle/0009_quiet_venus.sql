CREATE TABLE "finance"."statement_import_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"account_id" uuid,
	"name" varchar(160) NOT NULL,
	"mapping_config" jsonb NOT NULL,
	"auto_process_safe" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finance"."statement_import_profiles" ADD CONSTRAINT "statement_import_profiles_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "finance"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."statement_import_profiles" ADD CONSTRAINT "statement_import_profiles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "finance"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."statement_import_profiles" ADD CONSTRAINT "statement_import_profiles_household_account_fk" FOREIGN KEY ("household_id","account_id") REFERENCES "finance"."accounts"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "statement_import_profiles_household_id_idx" ON "finance"."statement_import_profiles" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "statement_import_profiles_account_id_idx" ON "finance"."statement_import_profiles" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "statement_import_profiles_household_account_name_idx" ON "finance"."statement_import_profiles" USING btree ("household_id",coalesce("account_id", '00000000-0000-0000-0000-000000000000'::uuid),"name");