import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";

import { isInstanceInitialized } from "@nodvis/finance-db";
import { auth } from "@/lib/auth/auth";
import { isSafeDirectHost } from "@/lib/security/request-host";

const authHandler = toNextJsHandler(auth);

export async function GET(request: Request) {
  if (!isAllowedAuthHost(request)) {
    return NextResponse.json({ code: "INVALID_AUTH_HOST", message: "The request host is not allowed" }, { status: 400 });
  }
  return authHandler.GET(request);
}

export async function POST(request: Request) {
  if (!isAllowedAuthHost(request)) {
    return NextResponse.json({ code: "INVALID_AUTH_HOST", message: "The request host is not allowed" }, { status: 400 });
  }

  if (new URL(request.url).pathname.endsWith("/sign-up/email")) {
    if (process.env.CI !== "true" && await isInstanceInitialized()) {
      return NextResponse.json(
        { code: "SIGN_UP_CLOSED", message: "Public sign-up is closed for this instance" },
        { status: 403 },
      );
    }
  }

  return authHandler.POST(request);
}

export function isAllowedAuthHost(request: Request, configuredOrigin = process.env.BETTER_AUTH_URL): boolean {
  try {
    const host = request.headers.get("host");
    if (!host) return false;
    if (!configuredOrigin) return isSafeDirectHost(host);
    const configured = new URL(configuredOrigin);
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const protocol = process.env.BETTER_AUTH_TRUSTED_PROXY_HEADERS === "true" && forwardedProto
      ? `${forwardedProto.replace(/:$/, "")}:`
      : new URL(request.url).protocol;
    return configured.host === host && configured.protocol === protocol;
  } catch {
    return false;
  }
}
