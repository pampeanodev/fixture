// src/utils/standings.ts
import type { GroupMatch, StandingRow, Score } from "../types";

export function calculateStandings(
  matches: GroupMatch[],
  teamIds: string[],
  scoreField: "result" | "prediction" = "result"
): StandingRow[] {
  const map = new Map<string, StandingRow>();

  for (const id of teamIds) {
    map.set(id, {
      teamId: id, played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
    });
  }

  for (const match of matches) {
    const score: Score | null = match[scoreField];
    if (!score) continue;
    const home = map.get(match.homeTeamId);
    const away = map.get(match.awayTeamId);
    if (!home || !away) continue;

    home.played++; away.played++;
    home.goalsFor += score.home; home.goalsAgainst += score.away;
    away.goalsFor += score.away; away.goalsAgainst += score.home;

    if (score.home > score.away) { home.won++; home.points += 3; away.lost++; }
    else if (score.home < score.away) { away.won++; away.points += 3; home.lost++; }
    else { home.drawn++; away.drawn++; home.points += 1; away.points += 1; }
  }

  const standings = Array.from(map.values());
  for (const row of standings) { row.goalDifference = row.goalsFor - row.goalsAgainst; }

  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  });

  return standings;
}
