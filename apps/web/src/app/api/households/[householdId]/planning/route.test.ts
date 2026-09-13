import { describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ requireHouseholdAccess: vi.fn() }));
const planning = vi.hoisted(() => ({ getHouseholdPlanning: vi.fn() }));
vi.mock("@/lib/authorization/household", () => ({ ...auth, HouseholdAccessDeniedError: class extends Error {} }));
vi.mock("@/lib/planning/service", () => planning);
vi.mock("@/lib/auth/session", () => ({ AuthenticationRequiredError: class extends Error {} }));
import { GET } from "./route";

describe("planning API", () => {
  it("authorizes household and returns exact JSON money strings", async () => {
    auth.requireHouseholdAccess.mockResolvedValue({ householdId: "h", personId: "p" });
    planning.getHouseholdPlanning.mockResolvedValue({ strategy: "stabilization", hasData: true, byCurrency: [{ currency: "PLN", projectedCashMinor: "9007199254740993", status: "positive", suggestions: [{ code: "protect-buffer", amountMinor: "9007199254740993" }] }] });
    const response = await GET(new Request("http://localhost/api/households/h/planning?strategy=stabilization"), { params: Promise.resolve({ householdId: "h" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { byCurrency: [{ projectedCashMinor: "9007199254740993", suggestions: [{ amountMinor: "9007199254740993" }] }] } });
    expect(auth.requireHouseholdAccess).toHaveBeenCalledWith("h");
  });
});
