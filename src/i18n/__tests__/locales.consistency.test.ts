import { describe, it, expect } from "vitest";
import { es } from "../locales/es";
import { en } from "../locales/en";
import { pt } from "../locales/pt";

type Tree = { [K: string]: Tree | string };

function collectKeys(obj: Tree, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.push(path);
    else if (v && typeof v === "object") out.push(...collectKeys(v as Tree, path));
  }
  return out.sort();
}

describe("locale bundle consistency", () => {
  const esKeys = collectKeys(es as unknown as Tree);

  it("en has the same keys as es", () => {
    const enKeys = collectKeys(en as unknown as Tree);
    const missing = esKeys.filter((k) => !enKeys.includes(k));
    const extra = enKeys.filter((k) => !esKeys.includes(k));
    expect(missing, `Missing keys in en: ${missing.join(", ")}`).toEqual([]);
    expect(extra, `Extra keys in en: ${extra.join(", ")}`).toEqual([]);
  });

  it("pt has the same keys as es", () => {
    const ptKeys = collectKeys(pt as unknown as Tree);
    const missing = esKeys.filter((k) => !ptKeys.includes(k));
    const extra = ptKeys.filter((k) => !esKeys.includes(k));
    expect(missing, `Missing keys in pt: ${missing.join(", ")}`).toEqual([]);
    expect(extra, `Extra keys in pt: ${extra.join(", ")}`).toEqual([]);
  });

  it("every plural key xxxOne has a matching xxxOther", () => {
    const oneKeys = esKeys.filter((k) => k.endsWith("One"));
    const missingOther = oneKeys.filter((k) => {
      const otherKey = k.slice(0, -3) + "Other";
      return !esKeys.includes(otherKey);
    });
    expect(missingOther).toEqual([]);
  });
});
