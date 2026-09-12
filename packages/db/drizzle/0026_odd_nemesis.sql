CREATE TABLE "finance"."instance_state" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"initialized_at" timestamp with time zone,
	"owner_auth_user_id" uuid,
	CONSTRAINT "instance_state_singleton" CHECK ("finance"."instance_state"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "finance"."instance_state" ADD CONSTRAINT "instance_state_owner_auth_user_id_auth_users_id_fk" FOREIGN KEY ("owner_auth_user_id") REFERENCES "finance"."auth_users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "finance"."instance_state" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
UPDATE "finance"."instance_state"
SET
  "initialized_at" = COALESCE("initialized_at", now()),
  "owner_auth_user_id" = COALESCE(
    "owner_auth_user_id",
    (SELECT "id" FROM "finance"."auth_users" ORDER BY "created_at", "id" LIMIT 1)
  )
WHERE EXISTS (SELECT 1 FROM "finance"."auth_users");