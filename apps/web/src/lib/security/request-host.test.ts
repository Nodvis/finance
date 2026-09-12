import { describe, expect, it } from "vitest";

import { isSafeDirectHost } from "./request-host";

describe("direct self-host request host classification", () => {
  it.each([
    "localhost:3990",
    "127.0.0.1:3990",
    "10.24.8.7:3990",
    "172.16.0.1:3990",
    "172.31.255.254:3990",
    "192.168.1.128:3990",
    "[::1]:3990",
    "[fd12:3456:789a::1]:3990",
  ])("accepts bounded direct host %s", (host) => {
    expect(isSafeDirectHost(host)).toBe(true);
  });

  it.each([
    "172.15.255.255:3990",
    "172.32.0.1:3990",
    "attacker.example:3990",
    "192.168.1.128:3000",
    "192.168.1.128",
    "192.168.1.999:3990",
    "192.168.1.128:3990:bad",
    "[2001:db8::1]:3990",
  ])("rejects unsafe direct host %s", (host) => {
    expect(isSafeDirectHost(host)).toBe(false);
  });
});
