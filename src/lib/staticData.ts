import type { RouteInfo, StopInfo } from "./types";
import subway from "../data/subway.json";
import lirr from "../data/lirr.json";
import mnr from "../data/mnr.json";

export interface StaticData {
  stops: Record<string, StopInfo>;
  routes: Record<string, RouteInfo>;
  headsigns: Record<string, string>;
}

export const STATIC: Record<string, StaticData> = {
  subway: subway as unknown as StaticData,
  lirr: lirr as unknown as StaticData,
  mnr: mnr as unknown as StaticData,
};

export function stopInfo(agency: string, stopId: string): StopInfo | undefined {
  return STATIC[agency]?.stops[stopId];
}

export function routeInfo(agency: string, routeId: string): RouteInfo | undefined {
  return STATIC[agency]?.routes[routeId];
}

export function headsign(agency: string, tripId: string): string | undefined {
  return STATIC[agency]?.headsigns[tripId];
}

// All subway route colors for the legend, sorted by route id.
export const SUBWAY_ROUTES = Object.entries(STATIC.subway.routes)
  .map(([id, r]) => ({ id, ...r }))
  .sort((a, b) => a.long.localeCompare(b.long));