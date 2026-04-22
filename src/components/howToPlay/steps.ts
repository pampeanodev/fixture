import type { MessageKey } from "../../i18n/keys";

export type IllustrationId =
  | "hero-individual"
  | "hero-room"
  | "groups-predict"
  | "knockout-flow"
  | "ranking"
  | "shared-ranking"
  | "export-import"
  | "cta-rooms"
  | "invite-qr"
  | "seal";

export type Step = {
  titleKey: MessageKey;
  bodyKey: MessageKey;
  illustration: IllustrationId;
};

export const individualSteps: readonly Step[] = [
  { titleKey: "howToPlay.individual.step1.title", bodyKey: "howToPlay.individual.step1.body", illustration: "hero-individual" },
  { titleKey: "howToPlay.individual.step2.title", bodyKey: "howToPlay.individual.step2.body", illustration: "groups-predict" },
  { titleKey: "howToPlay.individual.step3.title", bodyKey: "howToPlay.individual.step3.body", illustration: "knockout-flow" },
  { titleKey: "howToPlay.individual.step4.title", bodyKey: "howToPlay.individual.step4.body", illustration: "knockout-flow" },
  { titleKey: "howToPlay.individual.step5.title", bodyKey: "howToPlay.individual.step5.body", illustration: "ranking" },
  { titleKey: "howToPlay.individual.step6.title", bodyKey: "howToPlay.individual.step6.body", illustration: "export-import" },
  { titleKey: "howToPlay.individual.step7.title", bodyKey: "howToPlay.individual.step7.body", illustration: "cta-rooms" },
];

export const roomSteps: readonly Step[] = [
  { titleKey: "howToPlay.room.step1.title", bodyKey: "howToPlay.room.step1.body", illustration: "hero-room" },
  { titleKey: "howToPlay.room.step2.title", bodyKey: "howToPlay.room.step2.body", illustration: "hero-room" },
  { titleKey: "howToPlay.room.step3.title", bodyKey: "howToPlay.room.step3.body", illustration: "invite-qr" },
  { titleKey: "howToPlay.room.step4.title", bodyKey: "howToPlay.room.step4.body", illustration: "seal" },
  { titleKey: "howToPlay.room.step5.title", bodyKey: "howToPlay.room.step5.body", illustration: "shared-ranking" },
];
