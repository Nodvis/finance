import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      switchToLight: "Przełącz na motyw jasny",
      switchToDark: "Przełącz na motyw ciemny",
    };
    return translations[key] ?? key;
  },
}));

import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders accessible theme toggle switch defaulting to light mode", () => {
    const html = renderToStaticMarkup(<ThemeToggle />);

    expect(html).toContain('id="theme-toggle"');
    expect(html).toContain('data-testid="theme-toggle"');
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('aria-label="Przełącz na motyw ciemny"');
  });
});
