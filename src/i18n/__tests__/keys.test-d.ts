import type { MessageKey, PluralBaseKey } from "../keys";

const ok1: MessageKey = "topbar.mode.predictions";
const ok2: MessageKey = "groups.title";
const ok3: MessageKey = "teams.ARG";
const okPlural: PluralBaseKey = "ranking.points";

// @ts-expect-error — key inexistente
const bad1: MessageKey = "topbar.mode.unknown";
// @ts-expect-error — path que apunta a un objeto, no a string
const bad2: MessageKey = "topbar.mode";

export { ok1, ok2, ok3, okPlural, bad1, bad2 };
