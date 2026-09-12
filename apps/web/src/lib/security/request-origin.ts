const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type RequestOriginInput = Readonly<{
  method: string;
  pathname: string;
  origin?: string | null;
  requestOrigin?: string | null;
}>;

function configuredOrigins(): Set<string> {
  return new Set(
    [
      process.env.BETTER_AUTH_URL,
      ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "").split(","),
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => new URL(value).origin),
  );
}

export function isTrustedMutation(request: RequestOriginInput): boolean {
  if (!MUTATING_METHODS.has(request.method)) {
    return true;
  }

  if (!request.pathname.startsWith("/api/") || request.pathname.startsWith("/api/auth/")) {
    return true;
  }

  if (!request.origin) {
    return true;
  }

  try {
    const origin = new URL(request.origin).origin;
    const configured = configuredOrigins();
    return configured.size > 0
      ? configured.has(origin)
      : Boolean(request.requestOrigin && origin === new URL(request.requestOrigin).origin);
  } catch {
    return false;
  }
}