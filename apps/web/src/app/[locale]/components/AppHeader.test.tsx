import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("@/lib/authorization/household", () => ({
  getCurrentUserHouseholdsStatus: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async (ns: string) => (key: string, params?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      "Navigation.skipToContent": "Przejdź do treści",
      "Navigation.brand": "Nodvis Finance",
      "Navigation.accounts": "Konta",
      "Navigation.categories": "Kategorie",
      "Navigation.imports": "Importy",
      "Accessibility.mainNavigation": "Główna nawigacja",
      "Accessibility.publicNavigation": "Nawigacja publiczna",
      "Accessibility.themeToggle": "Przełączanie motywu",
      "Accessibility.languageNavigation": "Wybór języka",
      "Auth.signedInAs": "Zalogowano",
    };
    return translations[`${ns}.${key}`] ?? `${ns}.${key}`;
  },
}));

vi.mock("./LanguageSwitcher", () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

vi.mock("./ThemeToggle", () => ({
  ThemeToggle: () => <button id="theme-toggle" data-testid="theme-toggle" />,
}));

vi.mock("./SignOutButton", () => ({
  SignOutButton: () => <button data-testid="sign-out-button">Wyloguj</button>,
}));

import { getCurrentSession } from "@/lib/auth/session";
import { getCurrentUserHouseholdsStatus } from "@/lib/authorization/household";
import { AppHeader } from "./AppHeader";

describe("AppHeader Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders public header with theme toggle and language switcher, and NO authenticated links, nav or sign-out when unauthenticated", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);

    const header = await AppHeader();
    const html = renderToStaticMarkup(header);

    // Public brand and controls are present
    expect(html).toContain("Nodvis Finance");
    expect(html).toContain('data-testid="theme-toggle"');
    expect(html).toContain('data-testid="language-switcher"');

    // Authenticated navigation and controls are strictly ABSENT
    expect(html).not.toContain("<nav");
    expect(html).not.toContain('aria-label="Główna nawigacja"');
    expect(html).not.toContain('href="/accounts"');
    expect(html).not.toContain('href="/categories"');
    expect(html).not.toContain('href="/imports"');
    expect(html).not.toContain('data-testid="sign-out-button"');
    expect(html).not.toContain("Gospodarstwo domowe");
  });

  it("renders authenticated navigation, active household pill, theme toggle, and sign out when session exists", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue({
      user: { id: "u-1", email: "alice@example.test", name: "Alice" } as any,
      session: { id: "s-1", userId: "u-1" } as any,
    });
    vi.mocked(getCurrentUserHouseholdsStatus).mockResolvedValue({
      status: "single",
      activeContext: {
        authUserId: "u-1",
        householdId: "018f47a0-7762-7b9c-8d17-27f2f79e59a1" as any,
        personId: "018f47a0-7762-7b9c-8d17-27f2f79e59a2" as any,
        householdName: "Nasze Gospodarstwo",
        personDisplayName: "Alice",
        defaultCurrency: "PLN",
      },
    });

    const header = await AppHeader();
    const html = renderToStaticMarkup(header);

    // Authenticated nav is present
    expect(html).toContain("<nav");
    expect(html).toContain('aria-label="Główna nawigacja"');
    expect(html).toContain('href="/accounts"');
    expect(html).toContain('href="/categories"');
    expect(html).toContain('href="/imports"');
    expect(html).toContain("Nasze Gospodarstwo");
    expect(html).toContain("PLN");
    expect(html).toContain('data-testid="theme-toggle"');
    expect(html).toContain('data-testid="language-switcher"');
    expect(html).toContain('data-testid="sign-out-button"');
  });
});
