# How-to-Play Panel — Design

**Status:** approved, pending implementation
**Date:** 2026-04-22
**Scope:** problem 1 only (panel with visual infographic explaining individual and room play). Problem 2 (onboarding tour targets hidden in mobile collapsed sidebar) is tracked separately.

## Why

Users completing onboarding and the guided tour still report not understanding how the app works end-to-end — specifically:

- The offline / individual flow is discoverable (predict scores) but the value ("see my ranking vs simulations, share JSON with friends") is not.
- The rooms flow involves concepts with no precedent in similar apps (commit-reveal over Nostr, P2P sync, admin role).

Onboarding is a one-shot and the guided tour depends on DOM elements that may be hidden (collapsed sidebar on mobile). We need a **consultable reference** that works regardless of layout state and explains the two play modes at the conceptual level, not the element level.

## Decisions

1. **Entry point:** the floating `?` button becomes a menu with two items — *"Tour guiado"* (existing behavior) and *"Cómo se juega"* (new panel). Single FAB, no new affordance competing for attention.
2. **Format:** modal wizard. Screen 0 = mode selection; from there a linear sequence of illustrated steps for the chosen mode.
3. **Modes:** Individual (7 steps) and Sala (5 steps).
4. **Terminology:** "sellar / sealed" for the commit-reveal lock concept. The internal code identifier (`commit`) stays; only user-facing strings change.
5. **Illustrations:** mix — UI-mockups (HTML/CSS replicas of real app elements) for concrete steps; abstract SVG for conceptual ones (seal, P2P, export/import).
6. **Persistence:** none. Reopening resets to Screen 0.
7. **Auto-open:** never. Always manual.
8. **i18n:** ES/EN/PT, same system as the rest of the app.

## Out of scope (follow-up specs)

- Contextual help on the Rooms screen for: relays, multi-room, admin vs member roles.
- Fix for problem 2: onboarding / tour targeting elements that are hidden in mobile collapsed sidebar.
- Recovering account across devices — already covered by the My Account modal.

## Architecture

### Components

```
HelpMenu (wraps HelpButton)
  └── on click → popover: [Tour guiado] [Cómo se juega]
                                            │
                                            ▼
                                       HowToPlay (modal)
                                         ├── Screen 0: mode select
                                         ├── Individual: 7 steps
                                         └── Room: 5 steps
```

`HelpMenu` owns the popover open state and renders `HowToPlay` when the user picks that option. `HelpButton` is unchanged — it still renders the same FAB; only its parent changes who handles the click.

`App.tsx` swaps `<HelpButton onStart={...} />` for `<HelpMenu />`. `HelpMenu` internally calls `useTour()` for the tour option and manages its own `HowToPlay` visibility.

### Internal state of `HowToPlay`

```ts
type HowToPlayState =
  | { screen: "mode-select" }
  | { screen: "wizard"; mode: "individual" | "room"; stepIndex: number };
```

Two `useState` values or one reducer — implementer's choice. No localStorage; closing the modal discards state.

### Step definitions

File: `src/components/howToPlay/steps.ts`.

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
  titleKey: string;   // i18n key
  bodyKey: string;    // i18n key; may contain <1>...</1> for emphasis
  illustration: IllustrationId;
};

export const individualSteps: readonly Step[] = [...];
export const roomSteps: readonly Step[] = [...];
```

The `IllustrationId` literal union means TypeScript fails the build if a step references an illustration that does not exist.

### Illustrations

One `.tsx` file per `IllustrationId` under `src/components/howToPlay/illustrations/`. Each exports a component that renders its own SVG + HTML, scoped by its own class names. A dispatcher `illustrations/index.tsx` maps `IllustrationId` → component for `HowToPlay` to render via `<Illustration id={step.illustration} />`.

Shared styles (common widths, aspect ratios, color tokens) live in `illustrations/illustrations.css`.

## Wizard flow

```
              ┌─────────────────────────┐
  open ──────>│  Screen 0: Mode select  │
              │  [Individual]  [Sala]   │
              └──────────┬──────────────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
      Individual (7 pasos)    Sala (5 pasos)
      1. Bienvenida           1. Qué es una sala
      2. Predecí grupos       2. Creá o unite
      3. Cómo avanzan         3. Invitá amigos
      4. Llaves               4. Sellado
      5. Ranking y sim        5. Ranking compartido
      6. Compartir offline
      7. CTA a Salas ────────> closes modal + SET_VIEW rooms
```

### Navigation

- Header: step title + close button (X).
- Footer: `← Atrás` · `N / Total` · `Siguiente →`.
- Screen 0 hides the footer; the two mode cards are the primary actions.
- Step 1 of any mode: `← Atrás` returns to Screen 0 (does not close).
- Last step of any mode: `Siguiente` becomes the closing action (e.g. *"Entendido"*). For Individual step 7, the primary action is the CTA "Llevame a Salas" which closes the modal and dispatches `SET_VIEW { type: "rooms" }`. A secondary `Cerrar` lets the user dismiss without navigating.
- **Keyboard:** `←` / `→` navigate, `Esc` closes. Listener is mounted on `document` while the modal is open, removed on unmount.
- **Overlay click:** closes the modal (same pattern as `DonateModal`, `AccountModal`).

### Layout

- Desktop: centered modal, max 720 × 600, dark overlay behind.
- Mobile (`<= 768px`): fullscreen, no overlay margin.
- Illustration area occupies roughly the top half; text (title + body) the bottom half; footer fixed.

## Content

### Mode select (Screen 0)

- Title: "¿Cómo vas a jugar?"
- Two large tappable cards side-by-side on desktop, stacked on mobile. Each has an icon, title, and one-line subtitle.
  - Individual: "Solo, en este dispositivo."
  - Sala: "Con amigos, sincronizado."

### Individual — 7 steps

1. **Bienvenida** — "Jugá solo. Tus predicciones viven en este dispositivo, sin servidores ni cuenta compartida." · `hero-individual`
2. **Predecí grupos** — "Elegí el resultado de cada partido de la fase de grupos. Los standings se actualizan en vivo según tus predicciones." · `groups-predict` (mockup of a ScoreInput card + mini standings).
3. **Cómo avanzan los equipos** — "Los primeros y segundos de cada grupo clasifican a 32vos. Además, los 8 mejores terceros también pasan." · `knockout-flow`
4. **Llaves eliminatorias** — "Las llaves se arman solas según tus predicciones de grupos. Vos decidís quién gana en cada cruce hasta la final." · `knockout-flow` (reused; text focuses on knockouts).
5. **Ranking y simulador** — "Mirá cuánto puntuás en escenarios reales o simulados. El simulador te muestra qué pasaría si los partidos que faltan se resolvieran al azar." · `ranking` (mockup of RankingView).
6. **Compartí con amigos (offline)** — "Exportás tu fixture como archivo, se lo mandás a un amigo, él lo importa y lo ves en tu ranking como rival. Sin internet compartido." · `export-import`
7. **O jugá en Sala (online)** — "Para sincronización automática con amigos: creá tu Sala o unite a la de alguien." · `cta-rooms` · primary button: *"Llevame a Salas"*.

### Room (Sala) — 5 steps

1. **Qué es una sala** — "Un grupo de amigos que predicen juntos. Sin servidores propios — usamos una red P2P descentralizada." · `hero-room`
2. **Creá o unite** — "Abrí tu propia sala y te volvés el admin, o entrá a la de alguien pegando el link de invitación." · `hero-room` (reuse with different focus — small variant acceptable if implementer prefers a dedicated illustration).
3. **Invitá a tus amigos** — "Tu sala genera un link y un QR. Mandalo por donde quieras — al abrirlo, tu amigo entra automáticamente." · `invite-qr`
4. **Sellado antes del partido** — "Tus predicciones se <1>sellan</1> 1 hora antes del kickoff. Ya no las podés cambiar, y se revelan a todos los miembros al mismo tiempo. Nadie puede copiar a nadie." · `seal`
5. **Ranking compartido** — "Todos los miembros ven el mismo ranking, actualizado en vivo. El admin puede editar los resultados reales cuando terminan los partidos." · `shared-ranking`

## Illustrations map

| Id | Used in | Type | Notes |
|---|---|---|---|
| `hero-individual` | Ind. 1 | abstract SVG | Single device + person silhouette. |
| `groups-predict` | Ind. 2 | mockup | Mini ScoreInput card with filled scores + mini standings table. Reuses color tokens from GroupView. |
| `knockout-flow` | Ind. 3, Ind. 4 | abstract SVG | 4×3 grid of group boxes; arrows from 1st/2nd to R32 column; best thirds marked with dashed border. |
| `ranking` | Ind. 5 | mockup | Mini ranking table with "Vos" + 2 fictional rivals + point totals. |
| `export-import` | Ind. 6 | abstract SVG | Two devices with a JSON file icon traveling between them via a generic share icon. |
| `cta-rooms` | Ind. 7 | abstract SVG | Multiple devices connected by a mesh, visually contrasting with the 1:1 export-import. |
| `hero-room` | Sala 1, Sala 2 | abstract SVG | Avatars clustered around a P2P mesh (no central node). |
| `invite-qr` | Sala 3 | abstract SVG | CSS-checkerboard QR + link line. |
| `seal` | Sala 4 | abstract SVG | Envelope with lock + clock at `-1:00`; optional three-state strip (editable → sealed → revealed). |
| `shared-ranking` | Sala 5 | mockup | Mini ranking with 4–5 rivals + a live-sync dot. |

**Fictional names used in rankings:** Ana, Lucas, Sofía, Mateo, Valentina (or locale-appropriate equivalents). No public figures.

## i18n

New key tree under `howToPlay` in `src/i18n/locales/{es,en,pt}.ts`:

```
howToPlay:
  menuItem          // "Cómo se juega" / "How to play" / "Como se joga"
  helpMenu:
    tour            // "Tour guiado"
    howTo           // same as menuItem; separate key for clarity
  modeSelect:
    title
    individualCard: { title, subtitle }
    roomCard:       { title, subtitle }
  individual:
    step1: { title, body }
    step2: { title, body }
    step3: { title, body }
    step4: { title, body }
    step5: { title, body }
    step6: { title, body }
    step7: { title, body }
    ctaRooms
  room:
    step1: { title, body }
    step2: { title, body }
    step3: { title, body }
    step4: { title, body }
    step5: { title, body }
  nav:
    back            // "Atrás"
    next            // "Siguiente"
    done            // "Entendido"
    close           // "Cerrar"
    stepCounter     // "{current} / {total}"
```

### Inline emphasis

Step bodies may contain `<1>texto</1>` for bold (used at least in Sala step 4 around *sellan*). The existing helper in `src/tour/steps.ts:10` (`renderTourHtml`) handles this exact syntax. We extract it to `src/i18n/inlineHtml.ts` so both `tour/steps.ts` and `HowToPlay` share one implementation. The tour module imports from the new location; behavior is unchanged.

### Consistency tests

The existing i18n consistency tests (CLAUDE.md: "fail if a key is missing in EN/PT vs ES") cover the new subtree automatically. No new tests needed for i18n.

## File structure

```
src/components/
├── HelpButton.tsx                            (unchanged)
├── HelpButton.css                            (unchanged)
├── HelpMenu.tsx                              (NEW)
├── HelpMenu.css                              (NEW)
├── HowToPlay.tsx                             (NEW)
├── HowToPlay.css                             (NEW)
└── howToPlay/
    ├── steps.ts                              (NEW)
    └── illustrations/
        ├── index.tsx                         (NEW — dispatcher)
        ├── HeroIndividual.tsx                (NEW)
        ├── HeroRoom.tsx                      (NEW)
        ├── GroupsPredict.tsx                 (NEW)
        ├── KnockoutFlow.tsx                  (NEW)
        ├── Ranking.tsx                       (NEW)
        ├── SharedRanking.tsx                 (NEW)
        ├── ExportImport.tsx                  (NEW)
        ├── CtaRooms.tsx                      (NEW)
        ├── InviteQr.tsx                      (NEW)
        ├── Seal.tsx                          (NEW)
        └── illustrations.css                 (NEW)

src/i18n/
├── inlineHtml.ts                             (NEW — extracted from tour/steps.ts)
└── locales/{es,en,pt}.ts                     (MODIFIED — + howToPlay.*)

src/App.tsx                                   (MODIFIED — HelpButton → HelpMenu)
src/tour/steps.ts                             (MODIFIED — imports from i18n/inlineHtml)
```

Total: 18 new files, 5 modified.

## Testing

Consistent with existing conventions (CLAUDE.md § Testing):

- No component unit tests. Logic in `HowToPlay` is trivial navigation; no pure utilities to unit-test.
- `pnpm test` must keep passing (i18n consistency tests cover the new keys).
- `pnpm run build` must pass.
- `pnpm lint` must not add new errors (9 preexisting allowed).

### Manual QA checklist

- [ ] Click FAB `?` → popover with two options.
- [ ] "Tour guiado" still triggers the contextual tour (regression check).
- [ ] "Cómo se juega" opens the modal at mode-select screen.
- [ ] Pick Individual → 7 steps → final CTA navigates to Salas view and closes modal.
- [ ] Pick Sala → 5 steps → final step closes cleanly.
- [ ] `← / →` / `Esc` work as specified.
- [ ] Overlay click closes.
- [ ] Back button on step 1 returns to mode-select.
- [ ] Close + reopen → resets to mode-select.
- [ ] Works in ES, EN, PT.
- [ ] Works on mobile (≤ 768px) — illustrations don't overflow, text wraps, footer stays reachable.

## Risks & trade-offs

- **Illustration count (10 components):** the biggest implementation cost. Mitigated by reusing `knockout-flow` across two steps and `hero-room` across two. Keeping each illustration small and SVG-based (no images) avoids bundle bloat.
- **Duplication with existing tour:** the contextual tour already covers some of this ground. Accepting the overlap — the tour is step-by-step in-context; the how-to-play is consultable reference. Different jobs.
- **CTA from Individual step 7:** navigating to Salas rather than opening the Sala wizard is a small UX compromise (less direct) but avoids a nested wizard transition that would be jarring. Users who want to learn about Salas can reopen the panel and pick Sala.
