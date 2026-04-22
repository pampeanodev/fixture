import { BCP47, type LocaleCode } from "./types";

const dateFormatters = new Map<LocaleCode, Intl.DateTimeFormat>();
const timeFormatters = new Map<LocaleCode, Intl.DateTimeFormat>();
const numberFormatters = new Map<LocaleCode, Intl.NumberFormat>();

function dateFormatter(locale: LocaleCode): Intl.DateTimeFormat {
  let f = dateFormatters.get(locale);
  if (!f) {
    f = new Intl.DateTimeFormat(BCP47[locale], {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    dateFormatters.set(locale, f);
  }
  return f;
}

function timeFormatter(locale: LocaleCode): Intl.DateTimeFormat {
  let f = timeFormatters.get(locale);
  if (!f) {
    f = new Intl.DateTimeFormat(BCP47[locale], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: locale === "en",
    });
    timeFormatters.set(locale, f);
  }
  return f;
}

function numberFormatter(locale: LocaleCode): Intl.NumberFormat {
  let f = numberFormatters.get(locale);
  if (!f) {
    f = new Intl.NumberFormat(BCP47[locale]);
    numberFormatters.set(locale, f);
  }
  return f;
}

export function formatMatchDate(utcDate: string, locale: LocaleCode): string {
  const date = new Date(utcDate);
  const datePart = dateFormatter(locale).format(date);
  const timePart = timeFormatter(locale).format(date);
  return `${datePart} · ${timePart}`;
}

export function formatTime(utcDate: string, locale: LocaleCode): string {
  return timeFormatter(locale).format(new Date(utcDate));
}

export function formatNumber(n: number, locale: LocaleCode): string {
  return numberFormatter(locale).format(n);
}
