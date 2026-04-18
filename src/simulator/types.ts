import type { GroupMatch, KnockoutMatch } from "../types";

export type PendingMatch =
  | { kind: "group"; match: GroupMatch }
  | { kind: "knockout"; match: KnockoutMatch };
