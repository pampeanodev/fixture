import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type LocaleCode } from "./types";

export function detectLocale(): LocaleCode {
  const langs: readonly string[] =
    navigator.languages !== undefined
      ? navigator.languages
      : navigator.language
        ? [navigator.language]
        : [];
  for (const lang of langs) {
    const primary = lang.toLowerCase().split("-")[0];
    if ((SUPPORTED_LOCALES as readonly string[]).includes(primary)) {
      return primary as LocaleCode;
    }
  }
  return DEFAULT_LOCALE;
}
