import type { RouteInfo, StopInfo } from "./types";
import subway from "../data/subway.json";
import lirr from "../data/lirr.json";
import mnr from "../data/mnr.json";

export interface StaticData {
  stops: Record<string, StopInfo>;
  routes: Record<string, RouteInfo>;
  headsigns: Record<string, string>;
  /** routeId -> array of flat [lat*1e5, lon*1e5, ...] polylines */
  paths: Record<string, number[][]>;
  /** routeId -> station stop_ids served by that route */
  routeStops: Record<string, string[]>;
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

/** Station stop_ids served by a route (subway direction-suffixes stripped). */
export function routeStops(agency: string, routeId: string): string[] {
  return STATIC[agency]?.routeStops?.[routeId] ?? [];
}

export function headsign(agency: string, tripId: string): string | undefined {
  return STATIC[agency]?.headsigns[tripId];
}

/** Decode route polylines into [lat, lon][] latlng arrays. */
export function routePolyLines(agency: string, routeId: string): [number, number][][] {
  const enc = STATIC[agency]?.paths?.[routeId];
  if (!enc) return [];
  const out: [number, number][][] = [];
  for (const flat of enc) {
    const pts: [number, number][] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) {
      pts.push([flat[i] / 1e5, flat[i + 1] / 1e5]);
    }
    out.push(pts);
  }
  return out;
}

/** All routes usable for a per-line filter legend. */
export interface LegendRoute {
  agency: string;
  routeId: string;
  color: string;
  short: string;
  long: string;
}

export const ALL_ROUTES: LegendRoute[] = (["subway", "lirr", "mnr"] as const).flatMap((agency) => {
  const data = STATIC[agency];
  return Object.entries(data.routes).flatMap(([routeId, r]) => {
    const hasPath = !!data.paths?.[routeId];
    if (!hasPath) return [];
    return [{
      agency,
      routeId,
      color: `#${r.color}`,
      short: r.short || (agency === "lirr" ? "LIRR" : "MN"),
      long: r.long || routeId,
    }];
  });
});

// Human display label for a train's line.
export function routeLabel(agency: string, routeId: string): string {
  const r = routeInfo(agency, routeId);
  if (!r) return routeId;
  if (agency === "subway") return r.short || routeId;
  return r.long || r.short || routeId;
}