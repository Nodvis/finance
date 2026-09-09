import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { betterAuthSchema, getDb } from "@nodvis/finance-db";

const configuredOrigin = process.env.BETTER_AUTH_URL;
const trustedOrigins = configuredOrigin ? [configuredOrigin] : [];

export const auth = betterAuth({
  appName: "Nodvis Finance",
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema: betterAuthSchema,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp:
      process.env.ALLOW_SIGN_UP !== "true" && process.env.CI !== "true",
    minPasswordLength: 12,
    maxPasswordLength: 128,
  },
  trustedOrigins,
  rateLimit: {
    enabled: true,
    ...(process.env.CI === "true"
      ? {
          customRules: {
            "/sign-up/email": { window: 60, max: 100 },
          },
        }
      : {}),
  },
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
});
