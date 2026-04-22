import type { Messages } from "./locales/es";
import type { MessageKey, PluralBaseKey, Vars } from "./keys";
import { BCP47, type LocaleCode } from "./types";

type TKey = MessageKey | PluralBaseKey;

function lookup(root: unknown, path: string): string | undefined {
  let cur: unknown = root;
  for (const part of path.split(".")) {
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[part];
    if (cur === undefined) return undefined;
  }
  return typeof cur === "string" ? cur : undefined;
}

function interpolate(template: string, vars: Vars): string {
  return template.replace(/\{(\w+)\}/g, (_, name) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}

export function createT(bundle: Messages, locale: LocaleCode) {
  const pluralRules = new Intl.PluralRules(BCP47[locale]);

  function t(key: TKey, vars?: Vars): string {
    if (vars && typeof vars.count === "number") {
      const rule = pluralRules.select(vars.count);
      const suffix = rule === "one" ? "One" : "Other";
      const pluralValue = lookup(bundle, `${key}${suffix}`);
      if (pluralValue !== undefined) return interpolate(pluralValue, vars);
    }
    const value = lookup(bundle, key);
    if (value === undefined) return key;
    return vars ? interpolate(value, vars) : value;
  }

  return t;
}

export type TFunction = ReturnType<typeof createT>;
