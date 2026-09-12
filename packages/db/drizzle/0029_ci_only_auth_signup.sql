CREATE OR REPLACE FUNCTION "finance"."claim_first_owner_on_auth_user_insert"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  claimed boolean;
BEGIN
  IF current_setting('nodvis.ci_mode', true) = 'true' THEN
    RETURN NEW;
  END IF;

  UPDATE "finance"."instance_state"
  SET "owner_auth_user_id" = NEW."id"
  WHERE "id" = 1
    AND "initialized_at" IS NULL
    AND "owner_auth_user_id" IS NULL;

  claimed := FOUND;
  IF claimed THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "finance"."instance_state"
    WHERE "id" = 1
      AND (
        "initialized_at" IS NOT NULL
        OR ("owner_auth_user_id" IS NOT NULL AND "owner_auth_user_id" <> NEW."id")
      )
  ) THEN
    RAISE EXCEPTION 'SIGN_UP_CLOSED'
      USING ERRCODE = 'P0001',
            HINT = 'The instance already has an owner';
  END IF;

  RETURN NEW;
END;
$$;
