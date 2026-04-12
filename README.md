# Mundial 2026 — Fixture & Prode

Fixture interactivo del Mundial 2026 con sistema de predicciones y competencia entre amigos. Inspirado en la clásica planilla de Excel que se pasaba entre amigos, pero en formato web.

## Features

- **12 grupos con tabla de posiciones** — se recalcula en tiempo real al cargar resultados
- **Llave de eliminatorias completa** — desde 32avos hasta la final, con auto-completado según resultados de grupos
- **Mejores terceros** — algoritmo que selecciona los 8 mejores terceros de 12 grupos y los asigna a la llave
- **Calendario cronológico** — todos los partidos ordenados por fecha para cargar resultados de arriba hacia abajo
- **Modo Predicciones** — cargá tus pronósticos sin afectar los resultados reales
- **Prode con amigos** — exportá tu prode, compartilo, importá el de tus rivales y armá un ranking
- **Ranking automático** — 3 pts por exacto, 1 pt por acertar ganador, 0 por error
- **Horarios localizados** — se muestran en la zona horaria de tu browser
- **Persistencia en LocalStorage** — cerrás y tus datos están cuando volvés
- **Export/Import JSON** — backup completo del fixture o solo tu prode para compartir
- **Responsive** — funciona en desktop y mobile

## Cómo competir

1. Cada jugador pone su nombre y carga sus predicciones en modo "Predicciones"
2. Exporta su prode desde el menú ⋯ → "Exportar mi prode"
3. Comparte el archivo JSON con sus amigos (WhatsApp, mail, lo que sea)
4. Cada uno importa los prodes de los demás desde ⋯ → "Importar prode rival"
5. A medida que se cargan resultados reales, el ranking se actualiza solo

## Stack

- React 19 + TypeScript
- Vite 8
- Vitest (tests)
- CSS vanilla (sin librerías de UI)
- Sin backend — 100% client-side

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
| `pnpm run preview` | Preview del build de producción |
| `pnpm test` | Correr tests |
| `pnpm test:watch` | Tests en modo watch |

## Estructura del proyecto

```
src/
├── types.ts                    # Interfaces TypeScript
├── data/                       # Datos estáticos (equipos, fixtures, bracket)
├── utils/                      # Lógica de negocio (standings, scoring, knockout)
├── context/                    # React Context + useReducer
└── components/                 # UI components
    ├── Sidebar                 # Navegación principal
    ├── TopBar                  # Modo, nombre, menú de acciones
    ├── GroupView               # Tabla de posiciones + partidos del grupo
    ├── BracketView             # Partidos de eliminatorias por ronda
    ├── ScheduleView            # Calendario cronológico completo
    └── RankingView             # Ranking del prode entre amigos
```
