// src/data/thirdPlaceMapping.ts

export type ThirdPlaceAssignment = Record<string, string>; // group -> R32 match id

export function assignThirdPlaceSlots(qualifyingGroups: string[]): ThirdPlaceAssignment {
  const slots: { matchId: string; possibleGroups: string[] }[] = [
    { matchId: "R32-2", possibleGroups: ["A","B","C","D","F"] },
    { matchId: "R32-5", possibleGroups: ["C","D","F","G","H"] },
    { matchId: "R32-7", possibleGroups: ["C","E","F","H","I"] },
    { matchId: "R32-8", possibleGroups: ["E","H","I","J","K"] },
    { matchId: "R32-9", possibleGroups: ["B","E","F","I","J"] },
    { matchId: "R32-10", possibleGroups: ["A","E","H","I","J"] },
    { matchId: "R32-13", possibleGroups: ["E","F","G","I","J"] },
    { matchId: "R32-15", possibleGroups: ["D","E","I","J","L"] },
  ];

  const sorted = [...qualifyingGroups].sort();
  const assignment: ThirdPlaceAssignment = {};
  const usedSlots = new Set<string>();
  const assignedGroups = new Set<string>();

  const remaining = [...sorted];

  while (remaining.length > 0) {
    let bestGroup = remaining[0];
    let bestCount = Infinity;

    for (const group of remaining) {
      const count = slots.filter(
        (s) => !usedSlots.has(s.matchId) && s.possibleGroups.includes(group)
      ).length;
      if (count < bestCount) {
        bestCount = count;
        bestGroup = group;
      }
    }

    const availableSlots = slots.filter(
      (s) => !usedSlots.has(s.matchId) && s.possibleGroups.includes(bestGroup)
    );

    if (availableSlots.length === 0) {
      remaining.splice(remaining.indexOf(bestGroup), 1);
      continue;
    }

    let bestSlot = availableSlots[0];
    let bestSlotScore = Infinity;
    for (const slot of availableSlots) {
      const score = slot.possibleGroups.filter(
        (g) => remaining.includes(g) && !assignedGroups.has(g)
      ).length;
      if (score < bestSlotScore) {
        bestSlotScore = score;
        bestSlot = slot;
      }
    }

    assignment[bestGroup] = bestSlot.matchId;
    usedSlots.add(bestSlot.matchId);
    assignedGroups.add(bestGroup);
    remaining.splice(remaining.indexOf(bestGroup), 1);
  }

  return assignment;
}
