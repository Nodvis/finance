import { describe, expect, it } from "vitest";

import { getDebtAmounts } from "./OverviewCardData";

describe("getDebtAmounts", () => {
  it("uses liabilities rather than net worth for the debt KPI", () => {
    expect(
      getDebtAmounts({
        byCurrency: [
          {
            currency: "PLN",
            currentNetWorthMinor: "842000",
            currentAssetsMinor: "842000",
            currentLiabilitiesMinor: "0",
            currentConfidence: "complete",
            currentIsComplete: true,
            points: [],
            missingSubjectNames: [],
            latestObservedAt: null,
          },
        ],
      }),
    ).toEqual([{ currency: "PLN", amountMinor: "0" }]);
  });

  it("keeps liability totals separated by currency", () => {
    expect(
      getDebtAmounts({
        byCurrency: [
          {
            currency: "EUR",
            currentNetWorthMinor: "1000",
            currentAssetsMinor: "1500",
            currentLiabilitiesMinor: "500",
            currentConfidence: "complete",
            currentIsComplete: true,
            points: [],
            missingSubjectNames: [],
            latestObservedAt: null,
          },
          {
            currency: "PLN",
            currentNetWorthMinor: "9000",
            currentAssetsMinor: "9000",
            currentLiabilitiesMinor: "0",
            currentConfidence: "complete",
            currentIsComplete: true,
            points: [],
            missingSubjectNames: [],
            latestObservedAt: null,
          },
        ],
      }),
    ).toEqual([
      { currency: "EUR", amountMinor: "500" },
      { currency: "PLN", amountMinor: "0" },
    ]);
  });
});
