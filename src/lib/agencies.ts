import type { Agency, AgencyState } from "./types";

const FEED_BASE = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/";

export const AGENCY_CONFIG: Record<Agency, AgencyState> = {
  subway: {
    key: "subway",
    name: "NYC Subway",
    short: "Subway",
    color: "#ee352e",
    feeds: [
      "nyct/gtfs",
      "nyct/gtfs-ace",
      "nyct/gtfs-bdfm",
      "nyct/gtfs-g",
      "nyct/gtfs-jz",
      "nyct/gtfs-l",
      "nyct/gtfs-nqrw",
      "nyct/gtfs-si",
    ],
    enabled: true,
  },
  lirr: {
    key: "lirr",
    name: "Long Island Rail Road",
    short: "LIRR",
    color: "#00985f",
    feeds: ["lirr/gtfs-lirr"],
    enabled: true,
  },
  mnr: {
    key: "mnr",
    name: "Metro-North Railroad",
    short: "Metro-North",
    color: "#0039a6",
    feeds: ["mnr/gtfs-mnr"],
    enabled: true,
  },
};

const encode = (s: string) => s.replace(/\//g, "%2F");

export const ALERTS_URL = `${FEED_BASE}camsys%2Fall-alerts`;

export function feedUrl(feed: string): string {
  return `${FEED_BASE}${encode(feed)}`;
}