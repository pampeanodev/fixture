import type { JSX } from "react";
import type { IllustrationId } from "../steps";
import "./illustrations.css";

import { HeroIndividual } from "./HeroIndividual";
import { HeroRoom } from "./HeroRoom";
import { GroupsPredict } from "./GroupsPredict";
import { KnockoutFlow } from "./KnockoutFlow";
import { Ranking } from "./Ranking";
import { SharedRanking } from "./SharedRanking";
import { ExportImport } from "./ExportImport";
import { CtaRooms } from "./CtaRooms";
import { InviteQr } from "./InviteQr";
import { Seal } from "./Seal";

const registry: Record<IllustrationId, () => JSX.Element> = {
  "hero-individual": HeroIndividual,
  "hero-room": HeroRoom,
  "groups-predict": GroupsPredict,
  "knockout-flow": KnockoutFlow,
  "ranking": Ranking,
  "shared-ranking": SharedRanking,
  "export-import": ExportImport,
  "cta-rooms": CtaRooms,
  "invite-qr": InviteQr,
  "seal": Seal,
};

export function Illustration({ id }: { id: IllustrationId }) {
  const Component = registry[id];
  return (
    <div className="htp-illustration" aria-hidden="true">
      <Component />
    </div>
  );
}
