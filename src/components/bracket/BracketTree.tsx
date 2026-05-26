import { useMemo } from "react";
import { useFixture } from "../../context/FixtureContext";
import type { KnockoutMatch } from "../../types";
import { BracketHalf } from "./BracketHalf";
import { BracketCenter } from "./BracketCenter";
import "./BracketTree.css";

export function BracketTree() {
  const { resolvedKnockout } = useFixture();

  const matchesById = useMemo(() => {
    const map = new Map<string, KnockoutMatch>();
    for (const m of resolvedKnockout) map.set(m.id, m);
    return map;
  }, [resolvedKnockout]);

  const finalMatch = matchesById.get("F");
  const thirdPlaceMatch = matchesById.get("3P");

  return (
    <div className="bracket-tree">
      <BracketHalf side="left" matchesById={matchesById} />
      <BracketCenter finalMatch={finalMatch} thirdPlaceMatch={thirdPlaceMatch} />
      <BracketHalf side="right" matchesById={matchesById} />
    </div>
  );
}
