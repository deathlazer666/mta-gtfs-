export type Agency = "subway" | "lirr" | "mnr";

export interface RouteInfo {
  short: string;
  long: string;
  color: string;
  text: string;
}

export interface StopInfo {
  name: string;
  lat: number;
  lon: number;
}

export interface NextStop {
  stopId: string;
  name: string;
  time: number; // epoch seconds
  minutes: number; // minutes from now
}

export type TrainStatus =
  | "approaching"
  | "stopped"
  | "intransit"
  | "departed"
  | "layover";

export interface Train {
  id: string; // stable key: agency + tripId (or vehicle)
  tripId: string;
  agency: Agency;
  routeId: string;
  routeShort: string; // e.g. "N", "2", "Hempstead Branch", "New Haven"
  routeColor: string;
  routeText: string;
  destinations: string[]; // static headsign / terminal names
  headingLabel: string; // human heading e.g. "South Ferry"
  status: TrainStatus;
  statusLabel: string;
  lat: number;
  lon: number;
  bearing: number; // degrees, 0 = north, clockwise
  nextStop?: NextStop;
  nextStops: NextStop[];
  speedMph?: number;
  timestamp: number;
  lineName: string; // display line used by filters
}

export interface ServiceAlert {
  id: string;
  routes: string[]; // route ids affected (subway: "N","4"; lirr: route id; mnr: route id)
  agencies: Agency[];
  header: string;
  description: string;
  severity: number; // 1 = most severe
  effect: string;
  cause: string;
  start: number;
  end: number;
  active: boolean;
}

export interface AgencyState {
  key: Agency;
  name: string;
  short: string;
  color: string;
  feeds: string[];
  enabled: boolean;
}