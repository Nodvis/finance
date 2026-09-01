CREATE SCHEMA "finance";
--> statement-breakpoint
CREATE TYPE "finance"."account_type" AS ENUM('checking', 'savings', 'cash', 'credit_card');--> statement-breakpoint
CREATE TABLE "finance"."auth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issuer" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."auth_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."auth_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."account_owners" (
	"household_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_owners_pk" PRIMARY KEY("account_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "finance"."accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"type" "finance"."account_type" NOT NULL,
	"currency" varchar(3) NOT NULL,
	"balance_snapshot_minor" bigint,
	"balance_snapshot_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_household_id_id_unique" UNIQUE("household_id","id"),
	CONSTRAINT "accounts_name_not_blank" CHECK (length(btrim("finance"."accounts"."name")) > 0),
	CONSTRAINT "accounts_currency_format" CHECK ("finance"."accounts"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "accounts_balance_snapshot_complete" CHECK (("finance"."accounts"."balance_snapshot_minor" is null) = ("finance"."accounts"."balance_snapshot_at" is null))
);
--> statement-breakpoint
CREATE TABLE "finance"."household_memberships" (
	"household_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "household_memberships_pk" PRIMARY KEY("household_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "finance"."households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"default_currency" varchar(3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "households_name_not_blank" CHECK (length(btrim("finance"."households"."name")) > 0),
	CONSTRAINT "households_default_currency_format" CHECK ("finance"."households"."default_currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "finance"."person_auth_links" (
	"auth_user_id" uuid PRIMARY KEY NOT NULL,
	"person_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "person_auth_links_person_id_unique" UNIQUE("person_id")
);
--> statement-breakpoint
CREATE TABLE "finance"."persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "persons_display_name_not_blank" CHECK (length(btrim("finance"."persons"."display_name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "finance"."auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "finance"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "finance"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."account_owners" ADD CONSTRAINT "account_owners_household_account_fk" FOREIGN KEY ("household_id","account_id") REFERENCES "finance"."accounts"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."account_owners" ADD CONSTRAINT "account_owners_household_person_fk" FOREIGN KEY ("household_id","person_id") REFERENCES "finance"."household_memberships"("household_id","person_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."accounts" ADD CONSTRAINT "accounts_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "finance"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."household_memberships" ADD CONSTRAINT "household_memberships_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "finance"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."household_memberships" ADD CONSTRAINT "household_memberships_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "finance"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."person_auth_links" ADD CONSTRAINT "person_auth_links_auth_user_id_auth_users_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "finance"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."person_auth_links" ADD CONSTRAINT "person_auth_links_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "finance"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_accounts_issuer_account_id_unique" ON "finance"."auth_accounts" USING btree ("issuer","account_id");--> statement-breakpoint
CREATE INDEX "auth_accounts_user_id_idx" ON "finance"."auth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_sessions_token_unique" ON "finance"."auth_sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_id_idx" ON "finance"."auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_users_email_unique" ON "finance"."auth_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "auth_verifications_identifier_idx" ON "finance"."auth_verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "account_owners_person_id_idx" ON "finance"."account_owners" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "accounts_household_id_idx" ON "finance"."accounts" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "household_memberships_person_id_idx" ON "finance"."household_memberships" USING btree ("person_id");