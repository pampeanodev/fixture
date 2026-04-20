import type { DriveStep } from "driver.js";

export type TourId = "overview" | "groups" | "knockout" | "rooms" | "simulator";

const overview: DriveStep[] = [
  {
    popover: {
      title: "Bienvenido al Prode 2026",
      description:
        "Predecís los 104 partidos del Mundial y ganás puntos cuando acertás." +
        "<br><br>" +
        "<strong>3 pts</strong> resultado exacto · <strong>1 pt</strong> solo ganador · <strong>0</strong> errado.",
    },
  },
  {
    element: '[data-tour="mode-toggle"]',
    popover: {
      title: "Resultados vs Predicciones",
      description:
        "Cambiás entre cargar lo que pensás que va a pasar (Predicciones) y lo que pasó realmente (Resultados). Tus puntos salen de comparar ambos.",
    },
  },
  {
    element: '[data-tour="nav-groups"]',
    popover: {
      title: "Grupos",
      description:
        "72 partidos de fase de grupos divididos en 12 grupos (A a L). La tabla se recalcula sola con tus predicciones.",
    },
  },
  {
    element: '[data-tour="nav-knockout"]',
    popover: {
      title: "Eliminatorias",
      description:
        "32 partidos desde 32avos hasta la final. Los cruces se arman automáticamente según tus predicciones de grupos — no los definís a mano.",
    },
  },
  {
    element: '[data-tour="nav-rooms"]',
    popover: {
      title: "Salas",
      description:
        "Competí con amigos. Creás una sala, compartís el link, y los rankings se sincronizan peer-to-peer (sin backend).",
    },
  },
  {
    element: '[data-tour="help-button"]',
    popover: {
      title: "¿Dudas más adelante?",
      description:
        "Tocá este botón en cualquier pantalla para abrir un tour específico de lo que estás viendo.",
      side: "left",
    },
  },
];

const groups: DriveStep[] = [
  {
    element: '[data-tour="group-tabs"]',
    popover: {
      title: "Grupos A–L",
      description: "Cambiás entre los 12 grupos desde estos tabs.",
    },
  },
  {
    element: '[data-tour="standings-table"]',
    popover: {
      title: "Tabla de posiciones",
      description:
        "Se recalcula en vivo con tus predicciones. Verde = clasifica directo a 32avos. Amarillo = 3er puesto, puede pasar como mejor tercero junto a otros 7 de otros grupos.",
    },
  },
  {
    element: '[data-tour="match-cards"]',
    popover: {
      title: "Cargar predicción",
      description:
        "Escribí el score de cada partido. Se guarda solo. Si estás en modo Resultados, cargás el resultado real. Desde el menú ⋯ podés regenerar todas las predicciones random de un toque.",
    },
  },
];

const knockout: DriveStep[] = [
  {
    element: '[data-tour="round-tabs"]',
    popover: {
      title: "Rondas de eliminatorias",
      description: "Navegás entre 32avos, Octavos, Cuartos, Semis y Final desde estos tabs.",
    },
  },
  {
    popover: {
      title: "Cruces automáticos",
      description:
        "Los equipos que aparecen en cada cruce salen de tus predicciones de grupos (1° de A, 2° de B, mejores terceros, etc.). Cuando cargás un partido, el ganador pasa solo al siguiente cruce.",
    },
  },
];

const rooms: DriveStep[] = [
  {
    element: '[data-tour="room-create"]',
    popover: {
      title: "Crear sala",
      description:
        "Ponele nombre y elegí el tipo: abierta (cualquiera con el link entra) o cerrada (generás invites de un solo uso). Te da un código de 8 caracteres y un link para compartir.",
    },
  },
  {
    element: '[data-tour="room-join"]',
    popover: {
      title: "Unirme con código",
      description:
        "Si alguien te pasó un código de 8 caracteres, pegalo acá. Lo más cómodo igual es abrir el link de invitación que te manden — te mete solo.",
    },
  },
  {
    popover: {
      title: "Commit-reveal",
      description:
        "Tus predicciones se publican encriptadas hasta 1 hora antes del kickoff de cada partido. Nadie las puede ver antes (ni el relay ni los rivales).",
    },
  },
];

const simulator: DriveStep[] = [
  {
    popover: {
      title: "Modo simulación",
      description:
        "Jugá el mundial entero antes que empiece. Para cada partido podés simular random, cargar un score manual, o saltarlo.",
    },
  },
  {
    popover: {
      title: "Ranking en vivo",
      description:
        "Después de cada partido ves el ranking actualizado con flechas (↑↓) según quién subió o bajó.",
    },
  },
  {
    popover: {
      title: "No afecta tu prode real",
      description:
        "Cuando salís de simulación, todo vuelve al estado real. Tus predicciones quedan intactas. Si recargás el browser, también volvés al real.",
    },
  },
];

export const TOURS: Record<TourId, DriveStep[]> = {
  overview,
  groups,
  knockout,
  rooms,
  simulator,
};
