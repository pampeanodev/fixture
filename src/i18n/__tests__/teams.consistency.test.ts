import { describe, it, expect } from "vitest";
import { TEAMS } from "../../data/teams";
import { es } from "../locales/es";
import { en } from "../locales/en";
import { pt } from "../locales/pt";

describe("team name consistency", () => {
  for (const team of TEAMS) {
    it(`${team.id} has a name in all locales`, () => {
      expect(es.teams).toHaveProperty(team.id);
      expect(en.teams).toHaveProperty(team.id);
      expect(pt.teams).toHaveProperty(team.id);
    });
  }

  it("no extra team entries beyond TEAMS", () => {
    const validIds = new Set<string>(TEAMS.map((t) => t.id));
    for (const locale of [es, en, pt]) {
      const extras = Object.keys(locale.teams).filter((k) => !validIds.has(k));
      expect(extras).toEqual([]);
    }
  });
});
