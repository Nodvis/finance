import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockReplace = vi.fn();
let mockPathname = "/";
let mockSearchParams = new URLSearchParams("");
let mockLocale = "pl";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  usePathname: () => mockPathname,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

vi.mock("next-intl", () => ({
  useLocale: () => mockLocale,
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      label: "Wybierz język",
      switchToPl: "Przełącz na język polski",
      switchToEn: "Przełącz na język angielski",
      pl: "Polski",
      en: "English",
    };
    return translations[key] ?? key;
  },
}));

import { LanguageSwitcher } from "./LanguageSwitcher";

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocale = "pl";
    mockPathname = "/";
    mockSearchParams = new URLSearchParams("");
  });

  it("renders accessible switcher buttons with correct aria-labels and navigation", () => {
    const html = renderToStaticMarkup(<LanguageSwitcher />);

    expect(html).toContain('aria-label="Wybierz język"');
    expect(html).toContain('aria-label="Przełącz na język polski"');
    expect(html).toContain('aria-label="Przełącz na język angielski"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Polski");
    expect(html).toContain("English");
  });

  it("indicates active locale on English when currentLocale is en", () => {
    mockLocale = "en";
    const html = renderToStaticMarkup(<LanguageSwitcher />);

    expect(html).toContain('aria-current="page"');
    expect(html).toContain('aria-label="Przełącz na język angielski"');
  });
});
