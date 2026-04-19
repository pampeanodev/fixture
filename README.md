# Mundial 2026 — Fixture & Prode

Fixture interactivo del Mundial 2026 con sistema de predicciones y competencia entre amigos. Inspirado en la clásica planilla de Excel que se pasaba entre amigos, pero en formato web, con sincronización peer-to-peer vía Nostr, y sin backend propio.

**Guía de usuario completa: [`docs/playing-guide.md`](docs/playing-guide.md)** — cómo jugar, competir con amigos, simular el mundial, y hacer backup de tu cuenta.

## Features

### Fixture

- **12 grupos con tabla de posiciones** — se recalcula en tiempo real
- **Llave de eliminatorias completa** — 32avos → final, con auto-completado según resultados de grupos
- **Mejores terceros** — algoritmo que selecciona los 8 mejores terceros de 12 grupos y los asigna a la llave (respetando restricciones de cruces)
- **Calendario cronológico** — todos los partidos ordenados por fecha
- **Horarios localizados** — en la zona horaria del browser
- **Responsive** — desktop y mobile

### Prode

- **Modo Predicciones** — cargás tus pronósticos sin afectar los resultados reales
- **Sistema de puntaje** — 3 pts exacto, 1 pt solo ganador, 0 si errás
- **Ranking automático** — compara contra resultados reales a medida que se cargan
- **Regenerar random** — botón para generar las 104 predicciones automáticamente con un modelo Poisson + ratings por equipo (útil para testear o salir del paso)

### Sync con amigos (Nostr P2P)

- **Salas online** — abiertas o con invitación de un solo uso
- **Link compartible + QR** — invitás con un link o escaneando
- **Sin backend** — sincronización por relays públicos de Nostr (6 relays, redundancia)
- **Commit-reveal criptográfico** — tus predicciones quedan selladas hasta 1 hora antes del partido; nadie las puede ver antes del cierre
- **Identidad criptográfica** — seed phrase BIP-39 + QR para backup/migración entre dispositivos

### Simulador

- **Match por match** — simulá el mundial partido por partido para probar el juego antes de que empiece
- **Random o manual** — generá un resultado realista o ponelo a mano
- **Deltas y ranking en vivo** — ves quién ganó puntos en cada partido y cómo se mueve el ranking
- **Efímero** — salir de la simulación restaura el estado real del prode intacto

### Persistencia

- **LocalStorage** — cerrás el browser y tus datos están cuando volvés
- **Export/Import JSON** — backup completo del fixture para migrar entre dispositivos
- **PWA** — instalable como app, funciona offline

## Stack

- React 19 + TypeScript
- Vite 8, Vitest (tests)
- nostr-tools 2 (SimplePool, NIP-06, NIP-19, NIP-33/78)
- qrcode, @scure/bip39 (transitivo)
- vite-plugin-pwa
- CSS vanilla, sin librerías de UI
- Sin backend — 100% client-side + Nostr relays

## Setup

```bash
pnpm install
pnpm run dev
```

Abrir `http://localhost:5173`

## Scripts

| Comando | Descripción |
|---------|-------------|
| `pnpm run dev` | Dev server con hot reload |
| `pnpm run build` | Build de producción en `dist/` |
| `pnpm run preview` | Preview del build |
| `pnpm test` | Correr tests (85 tests actualmente) |
| `pnpm test:watch` | Tests en modo watch |
| `pnpm lint` | Correr ESLint |

## Estructura del proyecto

```
src/
├── types.ts                       # Interfaces TypeScript
├── data/                          # Datos estáticos (equipos, fixtures, bracket)
├── utils/                         # Lógica de negocio (standings, scoring, knockout)
├── context/
│   ├── FixtureContext.tsx         # Estado del fixture + predicciones + simulación
│   └── NostrContext.tsx           # Identidad, salas, conexión a relays
├── nostr/                         # Capa de sincronización Nostr
│   ├── identity.ts                # NIP-06 seed phrase → keypair
│   ├── commitReveal.ts            # Hash + salt + verificación
│   ├── events.ts                  # Constructores de eventos NIP-78
│   ├── rooms.ts                   # Gestión de salas + invitaciones
│   ├── relayPool.ts               # Wrapper de SimplePool
│   └── outbox.ts                  # Cola offline de eventos
├── simulator/                     # Simulador de partidos
│   ├── ratings.ts                 # Tiers de fuerza por equipo
│   ├── poisson.ts                 # Sampling de goles
│   ├── resultGenerator.ts         # Generador de scores realistas
│   ├── penalties.ts               # Shootout con muerte súbita
│   ├── matchOrder.ts              # Próximo partido cronológico
│   └── randomize.ts               # Randomize de todas las predicciones
├── hooks/
│   └── useNostrSync.ts            # Bridge Nostr ↔ FixtureContext
└── components/
    ├── Sidebar                    # Navegación principal
    ├── TopBar                     # Modo, nombre, menú
    ├── GroupView                  # Tabla + partidos del grupo
    ├── BracketView                # Partidos de eliminatorias
    ├── ScheduleView               # Calendario cronológico
    ├── RankingView                # Ranking entre amigos
    ├── RoomList / RoomDetail      # Listado y detalle de salas
    ├── InviteModal                # Modal de invitación a sala
    ├── SimulatorView              # Vista del simulador
    ├── Onboarding                 # Pantalla inicial
    ├── AccountModal               # Seed phrase + QR backup
    └── ConnectionStatus           # Indicador de conexión a relays
```

## Documentación de diseño

- **Fixture base**: [`docs/superpowers/specs/2026-04-12-world-cup-fixture-design.md`](docs/superpowers/specs/2026-04-12-world-cup-fixture-design.md)
- **Nostr sync**: [`docs/superpowers/specs/2026-04-14-nostr-sync-design.md`](docs/superpowers/specs/2026-04-14-nostr-sync-design.md)
- **Simulador**: [`docs/superpowers/specs/2026-04-18-simulator-design.md`](docs/superpowers/specs/2026-04-18-simulator-design.md)

## Deploy

Build estático, deploy a Cloudflare Pages (o cualquier host de contenido estático):

```bash
pnpm run build
# dist/ contiene el app + service worker + _redirects
```

Config de Cloudflare:
- Build command: `pnpm run build`
- Output directory: `dist`
- SPA routing: `_redirects` ya incluido
- HTTPS: automático
