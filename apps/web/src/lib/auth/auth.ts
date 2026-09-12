import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { betterAuthSchema, getDb } from "@nodvis/finance-db";
import { isSafeDirectHost } from "@/lib/security/request-host";

function parseConfiguredOrigin(value: string, name: string): string {
  if (value.includes("*")) {
    throw new Error(`${name} must not contain wildcard patterns`);
  }
  const parsed = new URL(value);
  if (!(["http:", "https:"].includes(parsed.protocol)) || parsed.origin === "null") {
    throw new Error(`${name} must be an absolute HTTP(S) origin`);
  }
  return parsed.origin;
}

const configuredOrigin = process.env.BETTER_AUTH_URL
  ? parseConfiguredOrigin(process.env.BETTER_AUTH_URL, "BETTER_AUTH_URL")
  : undefined;
const configuredAdditionalOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)
  .map((origin) => (origin.includes("*") ? null : parseConfiguredOrigin(origin, "BETTER_AUTH_TRUSTED_ORIGINS")))
  .filter((origin): origin is string => Boolean(origin));
const trustedProxyHeaders = process.env.BETTER_AUTH_TRUSTED_PROXY_HEADERS === "true";


/**
 * Direct self-hosting has no stable hostname to put in Compose. Better Auth
 * derives the request URL, while this callback only trusts that URL when the
 * request Host header agrees with it. A browser Origin from another host is
 * therefore rejected rather than blindly trusted.
 */
const trustedOrigins = (request?: Request) => {
  const origins = [configuredOrigin, ...configuredAdditionalOrigins].filter(
    (origin): origin is string => Boolean(origin),
  );

  if (request) {
    try {
      const requestUrl = new URL(request.url);
      const host = trustedProxyHeaders
        ? request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host")
        : request.headers.get("host");
      const configuredHost = configuredOrigin ? new URL(configuredOrigin).host : null;
      const configuredProtocol = configuredOrigin ? new URL(configuredOrigin).protocol : null;
      const forwardedProto = request.headers.get("x-forwarded-proto");
      const requestProtocol = trustedProxyHeaders && forwardedProto
        ? `${forwardedProto.replace(/:$/, "")}:`
        : requestUrl.protocol;
      if (
        host
        && ((configuredHost === host && configuredProtocol === requestProtocol) || (!configuredHost && isSafeDirectHost(host)))
      ) {
        origins.push(`${requestProtocol}//${host}`);
      }
    } catch {
      // Better Auth will reject the request if it cannot resolve its origin.
    }
  }

  return origins;
};

export const auth = betterAuth({
  appName: "Nodvis Finance",
  ...(configuredOrigin ? { baseURL: configuredOrigin } : {}),
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema: betterAuthSchema,
    transaction: true,
  }),
  emailAndPassword: {
    enabled: true,
    // The route wrapper closes public sign-up after bootstrap. Better Auth
    // itself must keep sign-up enabled so a fresh instance can be initialized.
    disableSignUp: false,
    minPasswordLength: 12,
    maxPasswordLength: 128,
  },
  trustedOrigins,
  advanced: {
    database: {
      generateId: "uuid",
    },
    trustedProxyHeaders,
    useSecureCookies: configuredOrigin
      ? new URL(configuredOrigin).protocol === "https:"
      : false,
  },
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
});
