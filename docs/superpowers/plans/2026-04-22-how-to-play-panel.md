# How-to-Play Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an always-available "Cómo se juega" panel with a two-flow wizard (Individual / Sala) and per-step illustrations, accessed via a new menu on the existing floating `?` button.

**Architecture:** A new `HelpMenu` component wraps the existing `HelpButton` with a popover that routes either to the existing tour or to a new `HowToPlay` modal. The modal is a self-contained wizard: Screen 0 = mode-select, then N illustrated steps. Step data lives in a typed array; each step declares an `illustration` id that maps to a scoped React+SVG component. No persistence; no auto-open.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest, vanilla CSS. Reuses existing `.modal-overlay` / `.modal-card` / `.modal-close` / `.modal-btn` classes defined in `src/components/AccountModal.css`. Reuses `driver.js` tour through the existing `useTour` hook.

**Spec:** `docs/superpowers/specs/2026-04-22-how-to-play-panel-design.md`

---

## Preconditions

- `pnpm install` has been run.
- `pnpm test` is green on `main` before starting.
- Working in a worktree or branch; do NOT commit directly to `main` until the feature is done.

---

## File structure (reference)

```
src/
├── components/
│   ├── HelpButton.tsx                         (unchanged)
│   ├── HelpButton.css                         (unchanged)
│   ├── HelpMenu.tsx                           (NEW — Task 13)
│   ├── HelpMenu.css                           (NEW — Task 13)
│   ├── HowToPlay.tsx                          (NEW — Task 12)
│   ├── HowToPlay.css                          (NEW — Task 12)
│   └── howToPlay/
│       ├── steps.ts                           (NEW — Task 3)
│       ├── __tests__/
│       │   └── steps.test.ts                  (NEW — Task 3)
│       └── illustrations/
│           ├── index.tsx                      (NEW — Task 4)
│           ├── illustrations.css              (NEW — Task 4)
│           ├── HeroIndividual.tsx             (NEW — Task 5)
│           ├── HeroRoom.tsx                   (NEW — Task 5)
│           ├── GroupsPredict.tsx              (NEW — Task 6)
│           ├── Ranking.tsx                    (NEW — Task 7)
│           ├── SharedRanking.tsx              (NEW — Task 7)
│           ├── KnockoutFlow.tsx               (NEW — Task 8)
│           ├── Seal.tsx                       (NEW — Task 9)
│           ├── ExportImport.tsx               (NEW — Task 10)
│           ├── CtaRooms.tsx                   (NEW — Task 10)
│           └── InviteQr.tsx                   (NEW — Task 11)
│
├── i18n/
│   ├── inlineEmphasis.tsx                     (NEW — Task 1)
│   └── locales/{es,en,pt}.ts                  (MODIFIED — Task 2)
│
└── App.tsx                                    (MODIFIED — Task 14)
```

**Note on i18n inline emphasis:** the existing `tour/steps.ts` uses a `renderTourHtml` helper that returns raw HTML and is injected via `dangerouslySetInnerHTML`. That pattern is XSS-adjacent (even with internal escaping). The plan introduces a new, safer, React-native helper `renderInlineEmphasis` that returns an array of `ReactNode` (strings + `<strong>` elements). The old tour helper is **left alone** — changing it is out of scope for this feature. We accept having two helpers for now; future cleanup can migrate the tour to the new helper.

---

## Task 1: Safe inline-emphasis helper

**Why first:** step bodies need `<1>bold</1>` emphasis. We avoid `dangerouslySetInnerHTML` by returning React nodes instead of HTML strings.

**Files:**
- Create: `src/i18n/inlineEmphasis.tsx`
- Create: `src/i18n/__tests__/inlineEmphasis.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/i18n/__tests__/inlineEmphasis.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { isValidElement } from "react";
import { renderInlineEmphasis } from "../inlineEmphasis";

describe("renderInlineEmphasis", () => {
  it("returns the whole string as a single text node when there are no markers", () => {
    const out = renderInlineEmphasis("plain text");
    expect(out).toEqual(["plain text"]);
  });

  it("splits text around a <1>...</1> marker and wraps the inner part in <strong>", () => {
    const out = renderInlineEmphasis("a <1>b</1> c");
    expect(out).toHaveLength(3);
    expect(out[0]).toBe("a ");
    expect(isValidElement(out[1])).toBe(true);
    expect((out[1] as { type: string }).type).toBe("strong");
    expect((out[1] as { props: { children: string } }).props.children).toBe("b");
    expect(out[2]).toBe(" c");
  });

  it("handles multiple numbered markers in one string", () => {
    const out = renderInlineEmphasis("<1>x</1> and <2>y</2>");
    const strongNodes = out.filter(
      (n): n is ReturnType<typeof isValidElement> extends never ? never : { props: { children: string } } =>
        isValidElement(n),
    );
    expect(strongNodes).toHaveLength(2);
  });

  it("leaves unmatched markers as literal text (never breaks rendering)", () => {
    const out = renderInlineEmphasis("literal <1>open without close");
    expect(out).toEqual(["literal <1>open without close"]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/i18n/__tests__/inlineEmphasis.test.tsx`
Expected: fails with "Failed to resolve import '../inlineEmphasis'".

- [ ] **Step 3: Create the helper**

Create `src/i18n/inlineEmphasis.tsx`:

```tsx
import type { ReactNode } from "react";

const MARKER_RE = /<(\d+)>([\s\S]*?)<\/\1>/g;

/**
 * Parses `<1>inner</1>` / `<2>inner</2>` markers in translated strings and
 * returns a React node array with the inner parts wrapped in <strong>.
 * Plain text outside markers is returned as-is (React escapes it automatically).
 * Safer than HTML-string helpers because no raw HTML is ever produced.
 */
export function renderInlineEmphasis(template: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let keyCounter = 0;
  for (const match of template.matchAll(MARKER_RE)) {
    const start = match.index ?? 0;
    if (start > lastIndex) nodes.push(template.slice(lastIndex, start));
    nodes.push(<strong key={`em-${keyCounter++}`}>{match[2]}</strong>);
    lastIndex = start + match[0].length;
  }
  if (lastIndex === 0) return [template];
  if (lastIndex < template.length) nodes.push(template.slice(lastIndex));
  return nodes;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/i18n/__tests__/inlineEmphasis.test.tsx`
Expected: 4 passed.

- [ ] **Step 5: Run the whole test suite**

Run: `pnpm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/inlineEmphasis.tsx src/i18n/__tests__/inlineEmphasis.test.tsx
git commit -m "feat(i18n): add React-safe inline emphasis helper"
```

---

## Task 2: Add `howToPlay` i18n keys (ES/EN/PT)

**Files:**
- Modify: `src/i18n/locales/es.ts` (insert before the `teams:` section near line 312)
- Modify: `src/i18n/locales/en.ts`
- Modify: `src/i18n/locales/pt.ts`

- [ ] **Step 1: Insert Spanish keys**

In `src/i18n/locales/es.ts`, after the `tour: { ... },` block and before `teams: {`, add:

```ts
  howToPlay: {
    menuItem: "Cómo se juega",
    helpMenu: {
      tour: "Tour guiado",
      howTo: "Cómo se juega",
    },
    modeSelect: {
      title: "¿Cómo vas a jugar?",
      subtitle: "Elegí un modo para ver cómo funciona.",
      individualCard: {
        title: "Individual",
        subtitle: "Solo, en este dispositivo.",
      },
      roomCard: {
        title: "En Sala",
        subtitle: "Con amigos, sincronizado.",
      },
    },
    individual: {
      step1: {
        title: "Jugá en solitario",
        body: "Tus predicciones viven en este dispositivo. No necesitás cuenta ni conexión con nadie.",
      },
      step2: {
        title: "Predecí los grupos",
        body: "Elegí el resultado de cada partido. La tabla se recalcula en vivo.",
      },
      step3: {
        title: "Cómo avanzan los equipos",
        body: "Pasan los <1>1°</1> y <2>2°</2> de cada grupo. Los <3>8 mejores terceros</3> también clasifican.",
      },
      step4: {
        title: "Llaves eliminatorias",
        body: "Los cruces se arman solos con tus predicciones de grupos. Vos decidís los ganadores hasta la final.",
      },
      step5: {
        title: "Ranking y simulador",
        body: "Mirá tu puntaje con resultados reales o simulados. El simulador resuelve los partidos pendientes al azar.",
      },
      step6: {
        title: "Compartí con amigos (offline)",
        body: "Exportás tu fixture, se lo mandás a un amigo, él lo importa y aparece en tu ranking como rival. Sin internet común.",
      },
      step7: {
        title: "O jugá en Sala (online)",
        body: "Para sincronización automática con amigos: creá tu Sala o unite a la de alguien.",
      },
      ctaRooms: "Llevame a Salas",
    },
    room: {
      step1: {
        title: "¿Qué es una sala?",
        body: "Un grupo de amigos que predice junto. Sin servidor central — usamos una red P2P descentralizada.",
      },
      step2: {
        title: "Creá o unite",
        body: "Abrí tu propia sala y sos el admin, o entrá a la de alguien con un link de invitación.",
      },
      step3: {
        title: "Invitá a tus amigos",
        body: "Cada sala genera un link y un QR. Compartilo por donde quieras — tus amigos entran con un click.",
      },
      step4: {
        title: "Sellado antes del partido",
        body: "Tus predicciones se <1>sellan</1> 1 hora antes del kickoff. Ya no podés cambiarlas, y se revelan a todos a la vez. Nadie copia a nadie.",
      },
      step5: {
        title: "Ranking compartido",
        body: "Todos los miembros ven el mismo ranking actualizado en vivo. El admin puede cargar los resultados reales.",
      },
    },
    nav: {
      back: "Atrás",
      next: "Siguiente",
      done: "Entendido",
      close: "Cerrar",
      stepCounter: "{current} / {total}",
    },
  },
```

- [ ] **Step 2: Insert English keys**

In `src/i18n/locales/en.ts`, same position, add:

```ts
  howToPlay: {
    menuItem: "How to play",
    helpMenu: {
      tour: "Guided tour",
      howTo: "How to play",
    },
    modeSelect: {
      title: "How will you play?",
      subtitle: "Pick a mode to see how it works.",
      individualCard: {
        title: "Solo",
        subtitle: "Alone, on this device.",
      },
      roomCard: {
        title: "In a Room",
        subtitle: "With friends, synced.",
      },
    },
    individual: {
      step1: {
        title: "Play on your own",
        body: "Your predictions live on this device. No account, no shared connection required.",
      },
      step2: {
        title: "Predict group stage",
        body: "Pick a score for each match. The standings recalculate live as you go.",
      },
      step3: {
        title: "How teams advance",
        body: "The <1>1st</1> and <2>2nd</2> of each group qualify. The <3>8 best third-placed teams</3> also go through.",
      },
      step4: {
        title: "Knockout bracket",
        body: "The bracket fills itself from your group predictions. You pick the winners all the way to the final.",
      },
      step5: {
        title: "Ranking and simulator",
        body: "See your score against real or simulated results. The simulator randomly resolves any pending match.",
      },
      step6: {
        title: "Share with friends (offline)",
        body: "Export your fixture, send it to a friend, they import it, and they show up in your ranking as a rival. No shared internet needed.",
      },
      step7: {
        title: "Or play in a Room (online)",
        body: "For automatic sync with friends: create your own Room or join someone else's.",
      },
      ctaRooms: "Take me to Rooms",
    },
    room: {
      step1: {
        title: "What is a Room?",
        body: "A group of friends predicting together. No central server — we use a decentralized P2P network.",
      },
      step2: {
        title: "Create or join",
        body: "Open your own room and become its admin, or enter someone else's via an invite link.",
      },
      step3: {
        title: "Invite your friends",
        body: "Each room generates a link and a QR. Share them anywhere — your friends join with one click.",
      },
      step4: {
        title: "Sealed before kickoff",
        body: "Your predictions are <1>sealed</1> 1 hour before kickoff. You can't change them anymore, and they're revealed to everyone at the same time. Nobody can copy.",
      },
      step5: {
        title: "Shared ranking",
        body: "All members see the same live-updated ranking. The admin can enter real results as matches end.",
      },
    },
    nav: {
      back: "Back",
      next: "Next",
      done: "Got it",
      close: "Close",
      stepCounter: "{current} / {total}",
    },
  },
```

- [ ] **Step 3: Insert Portuguese keys**

In `src/i18n/locales/pt.ts`, same position, add:

```ts
  howToPlay: {
    menuItem: "Como se joga",
    helpMenu: {
      tour: "Tour guiado",
      howTo: "Como se joga",
    },
    modeSelect: {
      title: "Como você vai jogar?",
      subtitle: "Escolha um modo para ver como funciona.",
      individualCard: {
        title: "Sozinho",
        subtitle: "Apenas neste dispositivo.",
      },
      roomCard: {
        title: "Em Sala",
        subtitle: "Com amigos, sincronizado.",
      },
    },
    individual: {
      step1: {
        title: "Jogue sozinho",
        body: "Seus palpites ficam neste dispositivo. Sem conta e sem conexão compartilhada.",
      },
      step2: {
        title: "Palpite a fase de grupos",
        body: "Escolha o placar de cada partida. A tabela é recalculada em tempo real.",
      },
      step3: {
        title: "Como os times avançam",
        body: "O <1>1º</1> e o <2>2º</2> de cada grupo classificam. Os <3>8 melhores terceiros</3> também passam.",
      },
      step4: {
        title: "Chaves eliminatórias",
        body: "As chaves se montam sozinhas com seus palpites dos grupos. Você escolhe os vencedores até a final.",
      },
      step5: {
        title: "Ranking e simulador",
        body: "Veja sua pontuação com resultados reais ou simulados. O simulador resolve no aleatório os jogos que faltam.",
      },
      step6: {
        title: "Compartilhe com amigos (offline)",
        body: "Exporte seu fixture, mande a um amigo, ele importa e aparece no seu ranking como rival. Sem precisar de internet em comum.",
      },
      step7: {
        title: "Ou jogue em Sala (online)",
        body: "Para sincronização automática com amigos: crie sua Sala ou entre na de alguém.",
      },
      ctaRooms: "Ir para Salas",
    },
    room: {
      step1: {
        title: "O que é uma sala?",
        body: "Um grupo de amigos palpitando juntos. Sem servidor central — usamos uma rede P2P descentralizada.",
      },
      step2: {
        title: "Crie ou entre",
        body: "Abra sua própria sala e seja o admin, ou entre na de alguém via link de convite.",
      },
      step3: {
        title: "Convide seus amigos",
        body: "Cada sala gera um link e um QR. Compartilhe onde quiser — seus amigos entram com um clique.",
      },
      step4: {
        title: "Seladas antes do jogo",
        body: "Seus palpites são <1>selados</1> 1 hora antes do kickoff. Não dá mais pra mudar, e são revelados a todos ao mesmo tempo. Ninguém copia.",
      },
      step5: {
        title: "Ranking compartilhado",
        body: "Todos os membros veem o mesmo ranking atualizado em tempo real. O admin preenche os resultados reais.",
      },
    },
    nav: {
      back: "Voltar",
      next: "Próximo",
      done: "Entendi",
      close: "Fechar",
      stepCounter: "{current} / {total}",
    },
  },
```

- [ ] **Step 4: Run i18n consistency tests**

Run: `pnpm test`
Expected: all pass, including the i18n consistency tests (they flag any key missing across ES/EN/PT).

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales/es.ts src/i18n/locales/en.ts src/i18n/locales/pt.ts
git commit -m "feat(i18n): add howToPlay keys for ES/EN/PT"
```

---

## Task 3: Step definitions + data-layer test

**Files:**
- Create: `src/components/howToPlay/steps.ts`
- Create: `src/components/howToPlay/__tests__/steps.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/components/howToPlay/__tests__/steps.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { es } from "../../../i18n/locales/es";
import { individualSteps, roomSteps, type Step } from "../steps";

function resolveKey(path: string): unknown {
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, es);
}

function assertStepKeysResolve(steps: readonly Step[]): void {
  for (const step of steps) {
    expect(resolveKey(step.titleKey), `title key missing: ${step.titleKey}`).toEqual(
      expect.any(String),
    );
    expect(resolveKey(step.bodyKey), `body key missing: ${step.bodyKey}`).toEqual(
      expect.any(String),
    );
  }
}

describe("howToPlay steps", () => {
  it("individual has 7 steps", () => {
    expect(individualSteps).toHaveLength(7);
  });

  it("room has 5 steps", () => {
    expect(roomSteps).toHaveLength(5);
  });

  it("every individual step resolves to existing i18n keys", () => {
    assertStepKeysResolve(individualSteps);
  });

  it("every room step resolves to existing i18n keys", () => {
    assertStepKeysResolve(roomSteps);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/components/howToPlay/__tests__/steps.test.ts`
Expected: fails on import.

- [ ] **Step 3: Create `steps.ts`**

Create `src/components/howToPlay/steps.ts`:

```ts
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
  titleKey: string;
  bodyKey: string;
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
```

- [ ] **Step 4: Verify tests pass**

Run: `pnpm vitest run src/components/howToPlay/__tests__/steps.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/howToPlay/steps.ts src/components/howToPlay/__tests__/steps.test.ts
git commit -m "feat(howToPlay): add step definitions for individual and room flows"
```

---

## Task 4: Illustration registry + shared CSS + placeholders

**Files:**
- Create: `src/components/howToPlay/illustrations/index.tsx`
- Create: `src/components/howToPlay/illustrations/illustrations.css`
- Create: placeholder `.tsx` for each of the 10 illustrations

- [ ] **Step 1: Create the CSS**

Create `src/components/howToPlay/illustrations/illustrations.css`:

```css
.htp-illustration {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 180px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  overflow: hidden;
}

.htp-illustration svg {
  max-width: 100%;
  height: auto;
}

.htp-illustration-fallback {
  color: rgba(255, 255, 255, 0.35);
  font-size: 12px;
  font-family: monospace;
}

/* Shared mini-UI primitives used across mockup illustrations. */
.htp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  color: #fff;
}

.htp-table th, .htp-table td {
  padding: 4px 6px;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.htp-table th {
  color: rgba(255, 255, 255, 0.5);
  font-weight: 600;
  font-size: 10px;
  text-transform: uppercase;
}

.htp-row-highlight {
  background: rgba(76, 175, 80, 0.12);
}
```

- [ ] **Step 2: Create 10 placeholder components**

Each placeholder is a one-liner. Copy this pattern for every file:

`src/components/howToPlay/illustrations/HeroIndividual.tsx`:

```tsx
export function HeroIndividual() {
  return <span className="htp-illustration-fallback">HeroIndividual</span>;
}
```

Create the same-shaped file for each of the following names (matching filename to export):
- `HeroRoom`
- `GroupsPredict`
- `KnockoutFlow`
- `Ranking`
- `SharedRanking`
- `ExportImport`
- `CtaRooms`
- `InviteQr`
- `Seal`

- [ ] **Step 3: Create the registry**

Create `src/components/howToPlay/illustrations/index.tsx`:

```tsx
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
```

- [ ] **Step 4: Verify build**

Run: `pnpm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/howToPlay/illustrations/
git commit -m "feat(howToPlay): add illustration registry and placeholders"
```

---

## Task 5: Hero illustrations (Individual + Room)

**Files:**
- Modify: `src/components/howToPlay/illustrations/HeroIndividual.tsx`
- Modify: `src/components/howToPlay/illustrations/HeroRoom.tsx`

- [ ] **Step 1: Implement `HeroIndividual.tsx`**

Replace the placeholder with:

```tsx
export function HeroIndividual() {
  return (
    <svg viewBox="0 0 240 160" role="img" aria-hidden="true">
      <defs>
        <linearGradient id="htp-hero-ind-bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#2a2a55" />
          <stop offset="100%" stopColor="#1a1a38" />
        </linearGradient>
      </defs>
      {/* phone */}
      <rect x="84" y="20" width="72" height="120" rx="10" fill="url(#htp-hero-ind-bg)" stroke="rgba(255,255,255,0.12)" />
      <rect x="92" y="34" width="56" height="8" rx="2" fill="rgba(255,255,255,0.18)" />
      <rect x="92" y="50" width="56" height="22" rx="4" fill="rgba(76,175,80,0.35)" />
      <rect x="92" y="78" width="56" height="8" rx="2" fill="rgba(255,255,255,0.15)" />
      <rect x="92" y="92" width="36" height="8" rx="2" fill="rgba(255,255,255,0.12)" />
      <rect x="92" y="106" width="48" height="8" rx="2" fill="rgba(255,255,255,0.12)" />
      {/* person silhouette */}
      <circle cx="42" cy="70" r="14" fill="rgba(253,216,53,0.6)" />
      <path d="M22 130 Q42 96 62 130 Z" fill="rgba(253,216,53,0.6)" />
    </svg>
  );
}
```

- [ ] **Step 2: Implement `HeroRoom.tsx`**

Replace the placeholder with:

```tsx
export function HeroRoom() {
  const nodes = [
    { cx: 60, cy: 40 },
    { cx: 180, cy: 40 },
    { cx: 40, cy: 120 },
    { cx: 200, cy: 120 },
    { cx: 120, cy: 80 },
  ];
  const edges: Array<[number, number]> = [
    [0, 1], [0, 2], [0, 4], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4],
  ];
  return (
    <svg viewBox="0 0 240 160" role="img" aria-hidden="true">
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].cx} y1={nodes[a].cy}
          x2={nodes[b].cx} y2={nodes[b].cy}
          stroke="rgba(253,216,53,0.35)" strokeWidth={1.5}
          strokeDasharray="3 4"
        />
      ))}
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.cx} cy={n.cy} r={14} fill="#2a2a55" stroke="rgba(253,216,53,0.7)" strokeWidth={1.5} />
          <circle cx={n.cx} cy={n.cy - 3} r={5} fill="rgba(255,255,255,0.8)" />
          <path d={`M${n.cx - 8} ${n.cy + 10} Q${n.cx} ${n.cy + 2} ${n.cx + 8} ${n.cy + 10}`} fill="rgba(255,255,255,0.8)" />
        </g>
      ))}
    </svg>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/howToPlay/illustrations/HeroIndividual.tsx src/components/howToPlay/illustrations/HeroRoom.tsx
git commit -m "feat(howToPlay): implement hero illustrations"
```

---

## Task 6: `GroupsPredict` mockup

**Files:**
- Modify: `src/components/howToPlay/illustrations/GroupsPredict.tsx`
- Modify: `src/components/howToPlay/illustrations/illustrations.css` (append a block)

- [ ] **Step 1: Append scoped CSS**

Append to `src/components/howToPlay/illustrations/illustrations.css`:

```css
.htp-groups-predict {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  gap: 12px;
  width: 100%;
  max-width: 360px;
}

.htp-score-card {
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: 8px;
  padding: 10px;
  background: #1e1e3a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  font-size: 11px;
}

.htp-flag {
  width: 18px;
  height: 12px;
  border-radius: 2px;
  display: inline-block;
}

.htp-score-input {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: rgba(76,175,80,0.2);
  border: 1px solid rgba(76,175,80,0.5);
  border-radius: 4px;
  color: #fff;
  font-weight: 600;
}

.htp-score-dash {
  color: rgba(255, 255, 255, 0.4);
}
```

- [ ] **Step 2: Implement `GroupsPredict.tsx`**

Replace the placeholder with:

```tsx
export function GroupsPredict() {
  return (
    <div className="htp-groups-predict">
      <div className="htp-score-card" aria-hidden="true">
        <span className="htp-flag" style={{ background: "#75aadb" }} />
        <span>ARG</span>
        <span className="htp-score-input">2</span>
        <span className="htp-score-dash">–</span>
        <span className="htp-score-input">1</span>
        <span>BRA</span>
        <span className="htp-flag" style={{ background: "#009c3b" }} />
      </div>
      <table className="htp-table" aria-hidden="true">
        <thead>
          <tr><th>#</th><th>Eq.</th><th>Pts</th></tr>
        </thead>
        <tbody>
          <tr className="htp-row-highlight"><td>1</td><td>ARG</td><td>3</td></tr>
          <tr><td>2</td><td>ESP</td><td>1</td></tr>
          <tr><td>3</td><td>MEX</td><td>1</td></tr>
          <tr><td>4</td><td>BRA</td><td>0</td></tr>
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/components/howToPlay/illustrations/GroupsPredict.tsx src/components/howToPlay/illustrations/illustrations.css
git commit -m "feat(howToPlay): implement groups-predict mockup"
```

---

## Task 7: `Ranking` + `SharedRanking` mockups

**Files:**
- Modify: `src/components/howToPlay/illustrations/Ranking.tsx`
- Modify: `src/components/howToPlay/illustrations/SharedRanking.tsx`
- Modify: `src/components/howToPlay/illustrations/illustrations.css` (append)

- [ ] **Step 1: Append scoped CSS**

Append to `illustrations.css`:

```css
.htp-ranking-wrap {
  width: 100%;
  max-width: 300px;
}

.htp-live-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 6px;
  background: var(--accent-green, #4caf50);
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(76, 175, 80, 0.6);
  animation: htp-pulse 1.6s ease-in-out infinite;
}

@keyframes htp-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.htp-ranking-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.htp-you {
  color: var(--accent-gold, #fdd835);
  font-weight: 700;
}
```

- [ ] **Step 2: Implement `Ranking.tsx`**

Replace the placeholder with:

```tsx
export function Ranking() {
  return (
    <div className="htp-ranking-wrap">
      <div className="htp-ranking-header"><span>Ranking</span></div>
      <table className="htp-table" aria-hidden="true">
        <thead>
          <tr><th>#</th><th>Jugador</th><th>Pts</th></tr>
        </thead>
        <tbody>
          <tr><td>1</td><td>Ana</td><td>42</td></tr>
          <tr className="htp-row-highlight"><td>2</td><td className="htp-you">Vos</td><td>38</td></tr>
          <tr><td>3</td><td>Lucas</td><td>35</td></tr>
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Implement `SharedRanking.tsx`**

Replace the placeholder with:

```tsx
export function SharedRanking() {
  return (
    <div className="htp-ranking-wrap">
      <div className="htp-ranking-header">
        <span>Sala · Los Amigos</span>
        <span><i className="htp-live-dot" />live</span>
      </div>
      <table className="htp-table" aria-hidden="true">
        <thead>
          <tr><th>#</th><th>Jugador</th><th>Pts</th></tr>
        </thead>
        <tbody>
          <tr><td>1</td><td>Sofía</td><td>48</td></tr>
          <tr><td>2</td><td>Mateo</td><td>45</td></tr>
          <tr className="htp-row-highlight"><td>3</td><td className="htp-you">Vos</td><td>42</td></tr>
          <tr><td>4</td><td>Ana</td><td>40</td></tr>
          <tr><td>5</td><td>Valentina</td><td>37</td></tr>
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/components/howToPlay/illustrations/Ranking.tsx src/components/howToPlay/illustrations/SharedRanking.tsx src/components/howToPlay/illustrations/illustrations.css
git commit -m "feat(howToPlay): implement ranking illustrations"
```

---

## Task 8: `KnockoutFlow` abstract diagram

**Files:**
- Modify: `src/components/howToPlay/illustrations/KnockoutFlow.tsx`

- [ ] **Step 1: Implement**

Replace the placeholder with:

```tsx
export function KnockoutFlow() {
  const groupCols = 3;
  const groupRows = 4;
  const boxW = 28;
  const boxH = 20;
  const gapX = 10;
  const gapY = 8;
  const originX = 10;
  const originY = 14;
  const knockoutX = originX + groupCols * (boxW + gapX) + 30;

  const groups: Array<{ x: number; y: number; label: string }> = [];
  for (let r = 0; r < groupRows; r++) {
    for (let c = 0; c < groupCols; c++) {
      groups.push({
        x: originX + c * (boxW + gapX),
        y: originY + r * (boxH + gapY),
        label: String.fromCharCode(65 + r * groupCols + c),
      });
    }
  }

  return (
    <svg viewBox="0 0 240 160" role="img" aria-hidden="true">
      {groups.map((g, i) => (
        <g key={i}>
          <rect x={g.x} y={g.y} width={boxW} height={boxH} rx={3}
            fill="#2a2a55" stroke="rgba(255,255,255,0.15)" />
          <text x={g.x + boxW / 2} y={g.y + boxH / 2 + 3} fontSize="8" fill="rgba(255,255,255,0.75)" textAnchor="middle">
            {g.label}
          </text>
          <rect x={g.x + 2} y={g.y + 2} width={5} height={3} fill="rgba(76,175,80,0.8)" />
          <rect x={g.x + 9} y={g.y + 2} width={5} height={3} fill="rgba(253,216,53,0.8)" />
          <rect x={g.x + 16} y={g.y + 2} width={5} height={3} fill="none" stroke="rgba(253,216,53,0.6)" strokeDasharray="1 1" />
        </g>
      ))}

      {groups.map((g, i) => (
        <line key={`arr-${i}`}
          x1={g.x + boxW} y1={g.y + boxH / 2}
          x2={knockoutX} y2={80}
          stroke="rgba(255,255,255,0.12)" strokeWidth={0.6} />
      ))}

      <rect x={knockoutX} y={60} width={54} height={40} rx={4} fill="#1e1e3a" stroke="rgba(253,216,53,0.4)" />
      <text x={knockoutX + 27} y={78} fontSize="9" fill="#fff" textAnchor="middle" fontWeight="600">R32</text>
      <text x={knockoutX + 27} y={92} fontSize="7" fill="rgba(255,255,255,0.5)" textAnchor="middle">32 equipos</text>

      <g transform="translate(10 148)">
        <rect width="5" height="3" fill="rgba(76,175,80,0.8)" />
        <text x={10} y={3} fontSize="6" fill="rgba(255,255,255,0.6)">1°</text>
        <rect x={24} width="5" height="3" fill="rgba(253,216,53,0.8)" />
        <text x={34} y={3} fontSize="6" fill="rgba(255,255,255,0.6)">2°</text>
        <rect x={48} width="5" height="3" fill="none" stroke="rgba(253,216,53,0.6)" strokeDasharray="1 1" />
        <text x={58} y={3} fontSize="6" fill="rgba(255,255,255,0.6)">3° (mejor)</text>
      </g>
    </svg>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/components/howToPlay/illustrations/KnockoutFlow.tsx
git commit -m "feat(howToPlay): implement knockout-flow diagram"
```

---

## Task 9: `Seal` illustration

**Files:**
- Modify: `src/components/howToPlay/illustrations/Seal.tsx`

- [ ] **Step 1: Implement**

Replace the placeholder with:

```tsx
export function Seal() {
  return (
    <svg viewBox="0 0 240 160" role="img" aria-hidden="true">
      <g transform="translate(10 30)">
        <rect width="60" height="44" rx="4" fill="#2a2a55" stroke="rgba(255,255,255,0.25)" />
        <path d="M0 0 L30 28 L60 0" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
        <rect x="12" y="52" width="36" height="6" fill="rgba(255,255,255,0.2)" />
        <text x="30" y="76" fontSize="8" fill="rgba(255,255,255,0.7)" textAnchor="middle">Editable</text>
      </g>

      <line x1="76" y1="52" x2="94" y2="52" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
      <polygon points="94,49 98,52 94,55" fill="rgba(255,255,255,0.3)" />

      <g transform="translate(100 30)">
        <rect width="60" height="44" rx="4" fill="#2a2a55" stroke="rgba(253,216,53,0.7)" />
        <path d="M0 0 L30 18 L60 0" fill="none" stroke="rgba(253,216,53,0.5)" strokeWidth="1" />
        <rect x="22" y="20" width="16" height="14" rx="2" fill="rgba(253,216,53,0.85)" />
        <path d="M26 20 V14 a4 4 0 0 1 8 0 V20" fill="none" stroke="rgba(253,216,53,0.85)" strokeWidth="1.5" />
        <text x="30" y="52" fontSize="8" fill="#fdd835" textAnchor="middle">Sellado</text>
        <text x="30" y="62" fontSize="6" fill="rgba(255,255,255,0.5)" textAnchor="middle">-1:00 h</text>
      </g>

      <line x1="166" y1="52" x2="184" y2="52" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
      <polygon points="184,49 188,52 184,55" fill="rgba(255,255,255,0.3)" />

      <g transform="translate(190 30)">
        <rect width="40" height="44" rx="4" fill="#2a2a55" stroke="rgba(76,175,80,0.7)" />
        <rect x="6" y="8" width="28" height="3" fill="rgba(255,255,255,0.7)" />
        <rect x="6" y="16" width="20" height="3" fill="rgba(255,255,255,0.5)" />
        <rect x="6" y="24" width="24" height="3" fill="rgba(255,255,255,0.5)" />
        <text x="20" y="60" fontSize="8" fill="#4caf50" textAnchor="middle">Revelado</text>
      </g>

      <text x="120" y="132" fontSize="9" fill="rgba(255,255,255,0.6)" textAnchor="middle">
        A todos al mismo tiempo
      </text>
    </svg>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/components/howToPlay/illustrations/Seal.tsx
git commit -m "feat(howToPlay): implement seal illustration"
```

---

## Task 10: `ExportImport` + `CtaRooms` illustrations

**Files:**
- Modify: `src/components/howToPlay/illustrations/ExportImport.tsx`
- Modify: `src/components/howToPlay/illustrations/CtaRooms.tsx`

- [ ] **Step 1: Implement `ExportImport.tsx`**

Replace the placeholder with:

```tsx
export function ExportImport() {
  return (
    <svg viewBox="0 0 240 160" role="img" aria-hidden="true">
      <g transform="translate(20 40)">
        <rect width="50" height="80" rx="6" fill="#2a2a55" stroke="rgba(255,255,255,0.15)" />
        <text x="25" y="96" fontSize="8" fill="rgba(255,255,255,0.6)" textAnchor="middle">Vos</text>
      </g>
      <g transform="translate(94 56)">
        <rect width="52" height="40" rx="4" fill="rgba(253,216,53,0.12)" stroke="rgba(253,216,53,0.5)" />
        <text x="26" y="18" fontSize="7" fill="rgba(253,216,53,0.85)" textAnchor="middle" fontFamily="monospace">fixture</text>
        <text x="26" y="30" fontSize="7" fill="rgba(253,216,53,0.85)" textAnchor="middle" fontFamily="monospace">.json</text>
      </g>
      <line x1="74" y1="80" x2="94" y2="80" stroke="rgba(255,255,255,0.4)" strokeDasharray="3 3" />
      <polygon points="94,77 98,80 94,83" fill="rgba(255,255,255,0.4)" />
      <line x1="146" y1="80" x2="166" y2="80" stroke="rgba(255,255,255,0.4)" strokeDasharray="3 3" />
      <polygon points="166,77 170,80 166,83" fill="rgba(255,255,255,0.4)" />
      <g transform="translate(170 40)">
        <rect width="50" height="80" rx="6" fill="#2a2a55" stroke="rgba(255,255,255,0.15)" />
        <text x="25" y="96" fontSize="8" fill="rgba(255,255,255,0.6)" textAnchor="middle">Amigo</text>
      </g>
    </svg>
  );
}
```

- [ ] **Step 2: Implement `CtaRooms.tsx`**

Replace the placeholder with:

```tsx
export function CtaRooms() {
  const nodes = [
    { x: 120, y: 80 },
    { x: 40, y: 40 },
    { x: 200, y: 40 },
    { x: 40, y: 120 },
    { x: 200, y: 120 },
    { x: 120, y: 20 },
    { x: 120, y: 140 },
  ];
  return (
    <svg viewBox="0 0 240 160" role="img" aria-hidden="true">
      {nodes.slice(1).map((n, i) => (
        <line key={i}
          x1={nodes[0].x} y1={nodes[0].y}
          x2={n.x} y2={n.y}
          stroke="rgba(76,175,80,0.4)" strokeDasharray="2 3" />
      ))}
      {nodes.map((n, i) => (
        <g key={`n-${i}`}>
          <rect x={n.x - 14} y={n.y - 10} width={28} height={20} rx={3}
            fill="#2a2a55" stroke={i === 0 ? "rgba(253,216,53,0.7)" : "rgba(76,175,80,0.6)"} />
          <circle cx={n.x} cy={n.y} r={3} fill={i === 0 ? "rgba(253,216,53,0.9)" : "rgba(76,175,80,0.9)"} />
        </g>
      ))}
    </svg>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/components/howToPlay/illustrations/ExportImport.tsx src/components/howToPlay/illustrations/CtaRooms.tsx
git commit -m "feat(howToPlay): implement export-import and cta-rooms illustrations"
```

---

## Task 11: `InviteQr` illustration

**Files:**
- Modify: `src/components/howToPlay/illustrations/InviteQr.tsx`

- [ ] **Step 1: Implement**

Replace the placeholder with:

```tsx
export function InviteQr() {
  const size = 9;
  const pattern: number[][] = [];
  for (let r = 0; r < size; r++) {
    const row: number[] = [];
    for (let c = 0; c < size; c++) {
      row.push(((r * 31 + c * 17 + r * c) % 3 === 0) ? 1 : 0);
    }
    pattern.push(row);
  }
  for (const [sr, sc] of [[0, 0], [0, size - 3], [size - 3, 0]] as const) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        pattern[sr + r][sc + c] = (r === 0 || r === 2 || c === 0 || c === 2) ? 1 : 0;
      }
    }
  }

  const cell = 10;
  const pad = 14;
  const qrSide = size * cell;

  return (
    <svg viewBox="0 0 240 160" role="img" aria-hidden="true">
      <rect x={pad} y={(160 - qrSide - 2 * pad) / 2} width={qrSide + 2 * pad} height={qrSide + 2 * pad} rx={8}
        fill="#fff" />
      {pattern.map((row, r) =>
        row.map((v, c) =>
          v === 1 ? (
            <rect
              key={`${r}-${c}`}
              x={pad + pad / 2 + c * cell}
              y={(160 - qrSide - 2 * pad) / 2 + pad / 2 + r * cell}
              width={cell} height={cell}
              fill="#1a1a38"
            />
          ) : null,
        ),
      )}
      <g transform="translate(132 56)">
        <rect width="90" height="10" rx="4" fill="rgba(255,255,255,0.08)" />
        <text x="8" y="7" fontSize="7" fill="rgba(255,255,255,0.7)" fontFamily="monospace">prode.app/r/a1b2c3d4</text>
      </g>
      <g transform="translate(132 74)">
        <rect width="60" height="18" rx="4" fill="rgba(76,175,80,0.2)" stroke="rgba(76,175,80,0.5)" />
        <text x="30" y="12" fontSize="8" fill="#fff" textAnchor="middle" fontWeight="600">Compartir</text>
      </g>
    </svg>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/components/howToPlay/illustrations/InviteQr.tsx
git commit -m "feat(howToPlay): implement invite-qr illustration"
```

---

## Task 12: `HowToPlay` modal

**Files:**
- Create: `src/components/HowToPlay.tsx`
- Create: `src/components/HowToPlay.css`

- [ ] **Step 1: Create `HowToPlay.css`**

```css
.htp-modal {
  background: #1a1a38;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 0;
  max-width: 720px;
  width: 100%;
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
  animation: modal-in 0.15s ease-out;
}

.htp-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.htp-modal-header h2 {
  color: #fff;
  font-size: 18px;
  margin: 0;
}

.htp-modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.htp-modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  gap: 12px;
}

.htp-step-counter {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.htp-btn {
  padding: 8px 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.htp-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
}

.htp-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.htp-btn-primary {
  background: var(--accent-green, #4caf50);
  border-color: transparent;
}

.htp-btn-primary:hover:not(:disabled) {
  background: #1b5e20;
}

.htp-footer-actions {
  display: flex;
  gap: 8px;
}

.htp-mode-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 18px;
}

.htp-mode-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
  padding: 20px;
  background: #1e1e3a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: #fff;
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;
  font-family: inherit;
}

.htp-mode-card:hover {
  border-color: var(--accent-green, #4caf50);
  transform: translateY(-2px);
}

.htp-mode-card h3 {
  margin: 0;
  font-size: 16px;
}

.htp-mode-card p {
  margin: 0;
  color: rgba(255, 255, 255, 0.65);
  font-size: 12px;
  line-height: 1.4;
}

.htp-step-body {
  margin-top: 18px;
}

.htp-step-body p {
  color: rgba(255, 255, 255, 0.78);
  font-size: 14px;
  line-height: 1.5;
  margin: 0;
}

.htp-step-body strong {
  color: #fff;
  font-weight: 700;
}

.htp-modal-subtitle {
  color: rgba(255, 255, 255, 0.65);
  font-size: 13px;
  margin: 0;
}

@media (max-width: 768px) {
  .htp-modal {
    max-width: none;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
  }
  .htp-mode-grid {
    grid-template-columns: 1fr;
  }
  .htp-modal-body {
    padding: 18px;
  }
}
```

- [ ] **Step 2: Create `HowToPlay.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "../i18n";
import { useFixture } from "../context/FixtureContext";
import { renderInlineEmphasis } from "../i18n/inlineEmphasis";
import { Illustration } from "./howToPlay/illustrations";
import { individualSteps, roomSteps, type Step } from "./howToPlay/steps";
import "./HowToPlay.css";

type Mode = "individual" | "room";

type WizardState =
  | { screen: "mode-select" }
  | { screen: "wizard"; mode: Mode; stepIndex: number };

interface HowToPlayProps {
  onClose: () => void;
}

function stepsFor(mode: Mode): readonly Step[] {
  return mode === "individual" ? individualSteps : roomSteps;
}

export function HowToPlay({ onClose }: HowToPlayProps) {
  const { t } = useLocale();
  const { dispatch } = useFixture();
  const [state, setState] = useState<WizardState>({ screen: "mode-select" });

  const goBack = useCallback(() => {
    setState((prev) => {
      if (prev.screen === "mode-select") return prev;
      if (prev.stepIndex === 0) return { screen: "mode-select" };
      return { ...prev, stepIndex: prev.stepIndex - 1 };
    });
  }, []);

  const goNext = useCallback(() => {
    setState((prev) => {
      if (prev.screen === "mode-select") return prev;
      const total = stepsFor(prev.mode).length;
      if (prev.stepIndex >= total - 1) return prev;
      return { ...prev, stepIndex: prev.stepIndex + 1 };
    });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goBack();
      else if (e.key === "ArrowRight") goNext();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [goBack, goNext, onClose]);

  function pickMode(mode: Mode) {
    setState({ screen: "wizard", mode, stepIndex: 0 });
  }

  function goToRooms() {
    dispatch({ type: "SET_VIEW", view: { type: "rooms" } });
    onClose();
  }

  const isWizard = state.screen === "wizard";
  const currentStep = isWizard ? stepsFor(state.mode)[state.stepIndex] : null;
  const total = isWizard ? stepsFor(state.mode).length : 0;
  const isLastStep = isWizard && state.stepIndex === total - 1;
  const isIndividualCta = isWizard && state.mode === "individual" && isLastStep;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="htp-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="htp-modal-header">
          <h2>{currentStep ? t(currentStep.titleKey) : t("howToPlay.modeSelect.title")}</h2>
          <button className="modal-close" onClick={onClose} aria-label={t("howToPlay.nav.close")}>
            &times;
          </button>
        </div>

        <div className="htp-modal-body">
          {!isWizard ? (
            <>
              <p className="htp-modal-subtitle">{t("howToPlay.modeSelect.subtitle")}</p>
              <div className="htp-mode-grid">
                <button className="htp-mode-card" onClick={() => pickMode("individual")}>
                  <h3>{t("howToPlay.modeSelect.individualCard.title")}</h3>
                  <p>{t("howToPlay.modeSelect.individualCard.subtitle")}</p>
                </button>
                <button className="htp-mode-card" onClick={() => pickMode("room")}>
                  <h3>{t("howToPlay.modeSelect.roomCard.title")}</h3>
                  <p>{t("howToPlay.modeSelect.roomCard.subtitle")}</p>
                </button>
              </div>
            </>
          ) : (
            <>
              <Illustration id={currentStep!.illustration} />
              <div className="htp-step-body">
                <p>{renderInlineEmphasis(t(currentStep!.bodyKey))}</p>
              </div>
            </>
          )}
        </div>

        {isWizard && (
          <div className="htp-modal-footer">
            <button className="htp-btn" onClick={goBack}>{t("howToPlay.nav.back")}</button>
            <span className="htp-step-counter">
              {t("howToPlay.nav.stepCounter")
                .replace("{current}", String(state.stepIndex + 1))
                .replace("{total}", String(total))}
            </span>
            {isIndividualCta ? (
              <div className="htp-footer-actions">
                <button className="htp-btn" onClick={onClose}>{t("howToPlay.nav.close")}</button>
                <button className="htp-btn htp-btn-primary" onClick={goToRooms}>
                  {t("howToPlay.individual.ctaRooms")}
                </button>
              </div>
            ) : isLastStep ? (
              <button className="htp-btn htp-btn-primary" onClick={onClose}>
                {t("howToPlay.nav.done")}
              </button>
            ) : (
              <button className="htp-btn htp-btn-primary" onClick={goNext}>
                {t("howToPlay.nav.next")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/components/HowToPlay.tsx src/components/HowToPlay.css
git commit -m "feat(howToPlay): implement wizard modal"
```

---

## Task 13: `HelpMenu` popover

**Files:**
- Create: `src/components/HelpMenu.tsx`
- Create: `src/components/HelpMenu.css`

- [ ] **Step 1: Create `HelpMenu.css`**

```css
.help-menu-wrap {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.help-menu-wrap .help-fab {
  position: static;
  right: auto;
  bottom: auto;
}

.help-menu-popover {
  background: #1e1e3a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  min-width: 180px;
  display: flex;
  flex-direction: column;
  animation: modal-in 0.12s ease-out;
}

.help-menu-item {
  padding: 10px 14px;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  background: none;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
}

.help-menu-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

@media (max-width: 768px) {
  .help-menu-wrap {
    right: 14px;
    bottom: 14px;
  }
}
```

- [ ] **Step 2: Create `HelpMenu.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { useLocale } from "../i18n";
import { useTour } from "../tour/useTour";
import type { TourId } from "../tour/steps";
import { HelpButton } from "./HelpButton";
import { HowToPlay } from "./HowToPlay";
import "./HelpMenu.css";

interface HelpMenuProps {
  tourId: TourId;
}

export function HelpMenu({ tourId }: HelpMenuProps) {
  const { t } = useLocale();
  const { startTour } = useTour();
  const [menuOpen, setMenuOpen] = useState(false);
  const [howToOpen, setHowToOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function handleTour() {
    setMenuOpen(false);
    startTour(tourId);
  }

  function handleHowTo() {
    setMenuOpen(false);
    setHowToOpen(true);
  }

  return (
    <>
      <div className="help-menu-wrap" ref={wrapRef}>
        {menuOpen && (
          <div className="help-menu-popover" role="menu">
            <button className="help-menu-item" role="menuitem" onClick={handleTour}>
              {t("howToPlay.helpMenu.tour")}
            </button>
            <button className="help-menu-item" role="menuitem" onClick={handleHowTo}>
              {t("howToPlay.helpMenu.howTo")}
            </button>
          </div>
        )}
        <HelpButton onStart={() => setMenuOpen((v) => !v)} />
      </div>
      {howToOpen && <HowToPlay onClose={() => setHowToOpen(false)} />}
    </>
  );
}
```

**Note on stacking:** `HelpButton` uses `position: fixed` at bottom-right. Inside `.help-menu-wrap`, the `.help-fab` override resets it to `static`, so the popover renders directly above the button inside the wrapper's column layout.

- [ ] **Step 3: Verify build**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/components/HelpMenu.tsx src/components/HelpMenu.css
git commit -m "feat(helpMenu): add popover combining tour and how-to-play"
```

---

## Task 14: Wire `HelpMenu` into `App.tsx` + manual QA

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Swap `HelpButton` for `HelpMenu`**

In `src/App.tsx`:

Replace this import line (line 14):

```ts
import { HelpButton } from "./components/HelpButton";
```

with:

```ts
import { HelpMenu } from "./components/HelpMenu";
```

Remove the import of `useTour` on line 16:

```ts
import { useTour } from "./tour/useTour";
```

Replace the whole `TourBridge` component (lines 37–40) with:

```tsx
function TourBridge({ activeView }: { activeView: ViewTarget }) {
  return <HelpMenu tourId={contextTour(activeView)} />;
}
```

- [ ] **Step 2: Verify build + tests + lint**

Run: `pnpm test && pnpm run build && pnpm lint`
Expected: tests pass, build succeeds, lint produces **exactly the 9 preexisting errors** (no new ones).

- [ ] **Step 3: Manual QA**

Run: `pnpm run dev` and verify the following in a real browser:

- [ ] Click the floating `?` → popover appears with two options.
- [ ] "Tour guiado" triggers the same contextual tour that existed before (regression).
- [ ] Clicking outside the popover closes it. `Esc` closes it.
- [ ] "Cómo se juega" opens the modal at Screen 0 with two cards.
- [ ] Pick "Individual": title updates to step 1 title; `← Atrás` returns to mode-select.
- [ ] Navigate all 7 Individual steps via `Siguiente →` and `←/→` arrow keys.
- [ ] On Individual step 7: "Llevame a Salas" closes the modal and the app's active view becomes `rooms`.
- [ ] Pick "Sala": walk through 5 steps; on step 5 the primary button says *"Entendido"* and closes.
- [ ] `Esc` closes the modal from any step.
- [ ] Overlay click closes the modal.
- [ ] Reopen the modal: it starts at Screen 0 (state reset confirmed).
- [ ] Switch language to English, repeat happy path: titles/bodies/buttons are in English, "sealed" reads correctly in step 4 of Room.
- [ ] Switch to Portuguese, repeat happy path.
- [ ] Resize to mobile width (≤ 768px): modal goes fullscreen, mode cards stack, no horizontal scroll, illustrations fit.
- [ ] On mobile, FAB stays in bottom-right; tapping it opens the popover and the popover sits above the FAB.
- [ ] In all three languages, step 4 of Room renders the word for "sealed" as bold (via inline emphasis). No literal `<1>` tag leaks through.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): wire HelpMenu with tour + how-to-play entry points"
```

---

## Task 15 (optional): PR

Only run if the user asks to open a PR.

- [ ] **Step 1: Open the PR**

```bash
git push -u origin HEAD
gh pr create --title "feat: how-to-play panel with Individual/Sala wizard" --body "$(cat <<'EOF'
## Summary
- New `Cómo se juega` panel reachable from the floating `?` (now a menu).
- Wizard with mode selection (Individual / Sala) + illustrated steps.
- Added React-safe inline-emphasis helper for translated strings.
- No changes to backend data, Nostr sync, or scoring.

## Test plan
- [ ] `pnpm test` green
- [ ] `pnpm run build` green
- [ ] Walk both flows in ES/EN/PT on desktop and mobile
- [ ] Verify the existing contextual tour still starts from the menu
EOF
)"
```

---

## Self-review checklist (run before handoff)

**Spec coverage (§ spec → task):**
- Entry point (FAB becomes menu) → Task 13, wired in Task 14.
- Wizard format with mode-select → Task 12.
- Individual 7 steps / Room 5 steps → Task 3 (data) + Task 12 (rendering) + Task 2 (copy).
- "Sellar" terminology → Task 2.
- Mixed illustration style (mockups + abstract) → Tasks 5–11 (mockups: 6, 7; abstract: 5, 8, 9, 10, 11).
- No persistence / no auto-open → Task 12 (`useState` resets on unmount; never auto-triggered).
- i18n ES/EN/PT → Task 2; i18n consistency tests assert coverage in Tasks 2 + 3.
- CTA from Indiv. step 7 dispatches `SET_VIEW type:"rooms"` and closes → Task 12.
- Safe inline-emphasis helper (replaces raw-HTML plan) → Task 1.
- Reuses existing modal overlay + close-button classes → Task 12 uses `.modal-overlay` / `.modal-close`.

**Placeholder scan:** No "TBD", "TODO", or "add appropriate X". Every code step contains concrete code. Every test step shows expected output.

**Type consistency:** `IllustrationId` declared in Task 3 is consumed by the registry in Task 4 and by every illustration file via `Record<IllustrationId, () => JSX.Element>`. `Step` shape is stable across Tasks 3 and 12. `WizardState` is private to `HowToPlay.tsx`. `HelpMenu` exposes only `tourId` externally. `renderInlineEmphasis` signature (`(template: string) => ReactNode[]`) matches its test (Task 1) and its single call site (Task 12).

**Out-of-scope items not in any task:** relays / multi-room / admin-vs-member contextual help (spec § Out of scope); onboarding-tour hidden-elements fix (spec § Out of scope). Intentional — separate follow-ups.
