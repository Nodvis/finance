export const LOCALES = ["pl", "en"] as const;

export type AppLocale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "pl";

export interface LocaleConfig {
  code: AppLocale;
  name: string;
  nativeName: string;
  decimalSeparator: "," | ".";
  groupingSeparator: " " | ",";
  defaultCurrency: string;
  switchLabelKey: "switchToPl" | "switchToEn";
}

export const LOCALE_CONFIGS: Record<AppLocale, LocaleConfig> = {
  pl: {
    code: "pl",
    name: "Polski",
    nativeName: "Polski",
    decimalSeparator: ",",
    groupingSeparator: " ",
    defaultCurrency: "PLN",
    switchLabelKey: "switchToPl",
  },
  en: {
    code: "en",
    name: "English",
    nativeName: "English",
    decimalSeparator: ".",
    groupingSeparator: ",",
    defaultCurrency: "EUR",
    switchLabelKey: "switchToEn",
  },
};

export function isSupportedLocale(locale: string): locale is AppLocale {
  return (LOCALES as readonly string[]).includes(locale);
}

export function getLocaleConfig(locale: string): LocaleConfig {
  if (isSupportedLocale(locale)) {
    return LOCALE_CONFIGS[locale];
  }
  return LOCALE_CONFIGS[DEFAULT_LOCALE];
}
