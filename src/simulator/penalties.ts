/** Probability a single penalty kick is converted. */
const CONVERSION_RATE = 0.70;

function kick(): boolean {
  return Math.random() < CONVERSION_RATE;
}

/**
 * Simulate a penalty shootout: 5 kicks each, then sudden death until someone misses.
 * Returns the total kicks converted by each side. Never returns a tie.
 */
export function simulatePenalties(): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (let i = 0; i < 5; i++) {
    if (kick()) home++;
    if (kick()) away++;
  }
  while (home === away) {
    const h = kick();
    const a = kick();
    if (h) home++;
    if (a) away++;
  }
  return { home, away };
}
