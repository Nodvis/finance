import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: vi.fn(() => ({
    GET: vi.fn(),
    POST: vi.fn((request: Request) => new Response("delegated", { status: 200 })),
  })),
}));

vi.mock("@/lib/auth/auth", () => ({ auth: {} }));
vi.mock("@nodvis/finance-db", () => ({ isInstanceInitialized: vi.fn() }));

import { isInstanceInitialized } from "@nodvis/finance-db";
import { isAllowedAuthHost, POST } from "./route";

describe("Better Auth sign-up gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("closes public sign-up after instance bootstrap", async () => {
    vi.mocked(isInstanceInitialized).mockResolvedValueOnce(true);

    const response = await POST(
      new Request("http://127.0.0.1:3990/api/auth/sign-up/email", { method: "POST", headers: { host: "127.0.0.1:3990" } }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: "SIGN_UP_CLOSED",
      message: "Public sign-up is closed for this instance",
    });
  });

  it("allows the first-run sign-up route before bootstrap", async () => {
    vi.mocked(isInstanceInitialized).mockResolvedValueOnce(false);

    const response = await POST(
      new Request("http://127.0.0.1:3990/api/auth/sign-up/email", { method: "POST", headers: { host: "127.0.0.1:3990" } }),
    );

    expect(response.status).toBe(200);
  });

  it.each([
    "attacker.example:3990",
    "192.168.1.128:bad",
    "[malformed:3990",
  ])("rejects an unsafe direct Host: %s", (host) => {
    expect(isAllowedAuthHost(new Request("http://internal/api/auth/get-session", { headers: { host } }))).toBe(false);
  });

  it("accepts the explicitly configured HTTPS reverse-proxy host", () => {
    expect(
      isAllowedAuthHost(
        new Request("https://internal/api/auth/get-session", { headers: { host: "finance.example.com" } }),
        "https://finance.example.com",
      ),
    ).toBe(true);
  });

});
