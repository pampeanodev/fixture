export const SUPPORTED_LOCALES = ["es", "en", "pt"] as const;
export type LocaleCode = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: LocaleCode = "es";

export const BCP47: Record<LocaleCode, string> = {
  es: "es-AR",
  en: "en-US",
  pt: "pt-BR",
};

export const NATIVE_NAMES: Record<LocaleCode, string> = {
  es: "Español",
  en: "English",
  pt: "Português",
};
