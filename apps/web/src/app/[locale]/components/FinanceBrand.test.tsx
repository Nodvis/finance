import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FinanceBrand } from "./FinanceBrand";

describe("FinanceBrand", () => {
  it("uses approved responsive light and dark wordmarks", () => {
    const html = renderToStaticMarkup(<FinanceBrand />);

    expect(html).toContain("nodvis-finance-logo-primary.png");
    expect(html).toContain("nodvis-finance-logo-primary-dark.png");
    expect(html).toContain('alt=""');
  });

  it("provides a compact approved symbol variant", () => {
    const html = renderToStaticMarkup(<FinanceBrand compact />);

    expect(html).toContain("nodvis-finance-symbol.png");
    expect(html).not.toContain("logo-primary.png");
  });
});
