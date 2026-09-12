DROP TRIGGER IF EXISTS "auth_users_first_owner_claim" ON "finance"."auth_users";
--> statement-breakpoint
CREATE TRIGGER "auth_users_first_owner_claim"
AFTER INSERT ON "finance"."auth_users"
FOR EACH ROW
EXECUTE FUNCTION "finance"."claim_first_owner_on_auth_user_insert"();
