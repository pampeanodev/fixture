import type { DriveStep } from "driver.js";
import type { TFunction } from "../i18n/translate";

export type TourId = "overview" | "groups" | "knockout" | "rooms" | "simulator";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderTourHtml(template: string): string {
  return template.replace(
    /<(\d+)>([\s\S]*?)<\/\1>/g,
    (_, _id, content: string) => `<strong>${escapeHtml(content)}</strong>`,
  );
}

export function buildTours(t: TFunction): Record<TourId, DriveStep[]> {
  const overview: DriveStep[] = [
    {
      popover: {
        title: t("tour.overview.welcomeTitle"),
        description: renderTourHtml(t("tour.overview.welcomeBody")),
      },
    },
    {
      element: '[data-tour="mode-toggle"]',
      popover: {
        title: t("tour.overview.modeTitle"),
        description: t("tour.overview.modeBody"),
      },
    },
    {
      element: '[data-tour="nav-groups"]',
      popover: {
        title: t("tour.overview.groupsTitle"),
        description: t("tour.overview.groupsBody"),
      },
    },
    {
      element: '[data-tour="nav-knockout"]',
      popover: {
        title: t("tour.overview.knockoutTitle"),
        description: t("tour.overview.knockoutBody"),
      },
    },
    {
      element: '[data-tour="nav-rooms"]',
      popover: {
        title: t("tour.overview.roomsTitle"),
        description: t("tour.overview.roomsBody"),
      },
    },
    {
      element: '[data-tour="help-button"]',
      popover: {
        title: t("tour.overview.helpTitle"),
        description: t("tour.overview.helpBody"),
        side: "left",
      },
    },
  ];

  const groups: DriveStep[] = [
    {
      element: '[data-tour="group-tabs"]',
      popover: {
        title: t("tour.groups.tabsTitle"),
        description: t("tour.groups.tabsBody"),
      },
    },
    {
      element: '[data-tour="standings-table"]',
      popover: {
        title: t("tour.groups.standingsTitle"),
        description: t("tour.groups.standingsBody"),
      },
    },
    {
      element: '[data-tour="match-cards"]',
      popover: {
        title: t("tour.groups.matchesTitle"),
        description: t("tour.groups.matchesBody"),
      },
    },
  ];

  const knockout: DriveStep[] = [
    {
      element: '[data-tour="round-tabs"]',
      popover: {
        title: t("tour.knockout.tabsTitle"),
        description: t("tour.knockout.tabsBody"),
      },
    },
    {
      popover: {
        title: t("tour.knockout.autoTitle"),
        description: t("tour.knockout.autoBody"),
      },
    },
  ];

  const rooms: DriveStep[] = [
    {
      element: '[data-tour="room-create"]',
      popover: {
        title: t("tour.rooms.createTitle"),
        description: t("tour.rooms.createBody"),
      },
    },
    {
      element: '[data-tour="room-join"]',
      popover: {
        title: t("tour.rooms.joinTitle"),
        description: t("tour.rooms.joinBody"),
      },
    },
    {
      popover: {
        title: t("tour.rooms.commitTitle"),
        description: t("tour.rooms.commitBody"),
      },
    },
  ];

  const simulator: DriveStep[] = [
    {
      popover: {
        title: t("tour.simulator.modeTitle"),
        description: t("tour.simulator.modeBody"),
      },
    },
    {
      popover: {
        title: t("tour.simulator.rankingTitle"),
        description: t("tour.simulator.rankingBody"),
      },
    },
    {
      popover: {
        title: t("tour.simulator.safeTitle"),
        description: t("tour.simulator.safeBody"),
      },
    },
  ];

  return { overview, groups, knockout, rooms, simulator };
}
