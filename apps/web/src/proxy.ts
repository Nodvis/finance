import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

import { isSafeDirectHost } from "./lib/security/request-host";
import { isTrustedMutation } from "./lib/security/request-origin";
import { routing } from "./i18n/routing";

const nextIntlMiddleware = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const host = request.headers.get("host");
  const configuredHost = process.env.BETTER_AUTH_URL
    ? new URL(process.env.BETTER_AUTH_URL).host
    : null;
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const trustedProxyHeaders = process.env.BETTER_AUTH_TRUSTED_PROXY_HEADERS === "true";
  const protocol = trustedProxyHeaders && forwardedProto
    ? `${forwardedProto.replace(/:$/, "")}:`
    : request.nextUrl.protocol;
  const requestOrigin = host && (configuredHost === host || (!configuredHost && isSafeDirectHost(host)))
    ? `${protocol}//${host}`
    : null;

  if (!isTrustedMutation({
    method: request.method,
    pathname: request.nextUrl.pathname,
    origin: request.headers.get("origin"),
    requestOrigin,
  })) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  return nextIntlMiddleware(request);
}

export const config = {
  matcher: "/((?!_next|_vercel|.*\\..*).*)",
};
