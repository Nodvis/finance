import { describe, expect, it } from "vitest";

import { detectRecurringPatterns } from "./recurring";

function observation(id: string, date: string, amountMinor = 4999n) {
  return {
    id,
    kind: "expense" as const,
    counterparty: " Stream Co ",
    amountMinor,
    currency: "PLN",
    occurredOn: new Date(`${date}T12:00:00.000Z`),
  };
}

describe("detectRecurringPatterns", () => {
  it("recognizes a monthly pattern with small amount variation", () => {
    const result = detectRecurringPatterns([
      observation("1", "2026-01-05"),
      observation("2", "2026-02-05", 5099n),
      observation("3", "2026-03-06", 4999n),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      frequency: "monthly",
      counterparty: "Stream Co",
      currency: "PLN",
      typicalAmountMinor: 4999n,
      observationIds: ["1", "2", "3"],
    });
  });

  it("does not infer recurrence from equal amounts at irregular intervals", () => {
    expect(
      detectRecurringPatterns([
        observation("1", "2026-01-01"),
        observation("2", "2026-01-20"),
        observation("3", "2026-04-01"),
      ]),
    ).toEqual([]);
  });

  it("keeps currencies and directions separate", () => {
    expect(
      detectRecurringPatterns([
        observation("1", "2026-01-01"),
        observation("2", "2026-02-01"),
        observation("3", "2026-03-01"),
        { ...observation("4", "2026-01-01"), currency: "EUR" },
        { ...observation("5", "2026-02-01"), currency: "EUR" },
        { ...observation("6", "2026-03-01"), currency: "EUR" },
      ]),
    ).toHaveLength(2);
  });
});
