import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

import { isTrustedMutation } from "./lib/security/request-origin";
import { routing } from "./i18n/routing";

const nextIntlMiddleware = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  if (!isTrustedMutation({
    method: request.method,
    pathname: request.nextUrl.pathname,
    origin: request.headers.get("origin"),
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
