import { describe, expect, test, vi } from "vitest";
import { isTrustedMutation } from "./lib/security/request-origin";

describe("API mutation origin protection", () => {
  test("accepts a configured same-origin mutation", () => {
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");

    const request = { method: "POST", pathname: "/api/households", origin: "http://localhost:3000" };

    expect(isTrustedMutation(request)).toBe(true);
  });

  test("rejects a cross-origin mutation", () => {
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");

    const request = { method: "POST", pathname: "/api/households", origin: "https://attacker.example" };

    expect(isTrustedMutation(request)).toBe(false);
  });

  test("does not apply the custom check to Better Auth routes", () => {
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");

    const request = { method: "POST", pathname: "/api/auth/sign-in/email", origin: "https://attacker.example" };

    expect(isTrustedMutation(request)).toBe(true);
  });

  test("allows non-mutating requests and non-browser clients without Origin", () => {
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");

    const getRequest = { method: "GET", pathname: "/api/households", origin: "https://attacker.example" };
    const apiClientRequest = { method: "POST", pathname: "/api/households" };

    expect(isTrustedMutation(getRequest)).toBe(true);
    expect(isTrustedMutation(apiClientRequest)).toBe(true);
  });
});
