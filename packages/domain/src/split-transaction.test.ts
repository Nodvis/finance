import { describe, expect, it } from "vitest";
import { categoryId, money, transactionId, householdId, createExpense } from "./index";
import { createSplitAllocations } from "./split-transaction";

describe("split transaction allocations", () => {
  const parent = createExpense({ id: transactionId("00000000-0000-4000-8000-000000000001"), householdId: householdId("00000000-0000-4000-8000-000000000002"), accountId: "00000000-0000-4000-8000-000000000003" as never, amount: money(10000n, "PLN"), payee: "Shop", paidByPersonId: "00000000-0000-4000-8000-000000000004" as never, occurredOn: new Date("2026-01-01T00:00:00Z") });
  const c1 = categoryId("00000000-0000-4000-8000-000000000005");
  const c2 = categoryId("00000000-0000-4000-8000-000000000006");
  it("requires exact positive same-currency allocations", () => {
    expect(createSplitAllocations(parent, [{ categoryId: c1, amount: money(4000n, "PLN") }, { categoryId: c2, amount: money(6000n, "PLN") }])).toHaveLength(2);
    expect(() => createSplitAllocations(parent, [{ categoryId: c1, amount: money(4001n, "PLN") }, { categoryId: c2, amount: money(6000n, "PLN") }])).toThrow(/exactly/);
    expect(() => createSplitAllocations(parent, [{ categoryId: c1, amount: money(4000n, "EUR") }, { categoryId: c2, amount: money(6000n, "EUR") }])).toThrow(/currency/);
    expect(() => createSplitAllocations(parent, [{ categoryId: c1, amount: money(10000n, "PLN") }, { categoryId: c1, amount: money(1n, "PLN") }])).toThrow(/positive|Duplicate/);
  });
  it("rejects income and transfers", () => {
    expect(() => createSplitAllocations({ ...parent, kind: "income" } as never, [])).toThrow(/expense/);
  });
});
