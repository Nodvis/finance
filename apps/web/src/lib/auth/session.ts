import "server-only";

import { headers } from "next/headers";

import { auth } from "./auth";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required");
    this.name = "AuthenticationRequiredError";
  }
}

export async function getCurrentSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireCurrentSession() {
  const session = await getCurrentSession();

  if (!session) {
    throw new AuthenticationRequiredError();
  }

  return session;
}
