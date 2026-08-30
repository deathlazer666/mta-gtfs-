import type { Agency, Train, NextStop, RouteInfo, StopInfo } from "./types";
import { VehiclePosition, TripUpdate, VEHICLE_STOP_STATUS } from "./gtfsrt";
import { stopInfo, routeInfo, headsign } from "./staticData";

const DEG = Math.PI / 180;

export function bearing(from: { lat: number; lon: number }, to: { lat: number; lon: number }): number {
  const dLon = (to.lon - from.lon) * DEG;
  const y = Math.sin(dLon) * Math.cos(to.lat * DEG);
  const x = Math.cos(from.lat * DEG) * Math.sin(to.lat * DEG) -
    Math.sin(from.lat * DEG) * Math.cos(to.lat * DEG) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function lerpLatLon(a: StopInfo, b: StopInfo, t: number): { lat: number; lon: number } {
  const clamp = Math.max(0, Math.min(1, t));
  return {
    lat: a.lat + (b.lat - a.lat) * clamp,
    lon: a.lon + (b.lon - a.lon) * clamp,
  };
}

function fmtMinutes(secs: number): number {
  return Math.max(0, Math.round(secs / 60));
}

interface RouteMeta {
  routeId: string;
  routeShort: string;
  routeColor: string;
  routeText: string;
}

function routeMeta(agency: Agency, routeId: string | undefined): RouteMeta {
  const r: RouteInfo | undefined = routeInfo(agency, routeId || "");
  const fallbackColor = agency === "lirr" ? "#00985f" : agency === "mnr" ? "#0039a6" : "#f7f7f8";
  return {
    routeId: routeId || "",
    routeShort: (agency === "subway" && r?.short) ? r.short : (r?.long || (agency === "mnr" ? "Metro-North" : "LIRR")),
    routeColor: r?.color ? `#${r.color}` : fallbackColor,
    routeText: r?.text ? `#${r.text}` : "#ffffff",
  };
}

function stripDir(stopId: string): string {
  // Subway platform ids like "101N"/"101S" -> look up parent-style "101".
  return stopId.replace(/[NS]$/, "");
}

function stopLookup(agency: Agency, stopId: string): StopInfo | undefined {
  return stopInfo(agency, stopId) || stopInfo(agency, stripDir(stopId));
}

interface Positioned {
  lat: number;
  lon: number;
  bearingNum: number;
}

/** Interpolate a train between consecutive stops using event times. */
function interpolate(
  agency: Agency,
  tu: TripUpdate,
  now: number,
): { pos?: Positioned; nextStops: NextStop[]; status: Train["status"]; statusLabel: string; headingLabel: string } {
  const times: { stopId: string; seq: number; t: number; arr?: number; dep?: number }[] = [];
  for (let i = 0; i < tu.stopTimeUpdates.length; i++) {
    const s = tu.stopTimeUpdates[i];
    if (!s.stopId) continue;
    const a = s.arrival?.time;
    const d = s.departure?.time;
    if (a == null && d == null) continue;
    times.push({ stopId: s.stopId, seq: i, t: Math.min(a ?? Infinity, d ?? Infinity), arr: a, dep: d });
  }
  // Sort by sequence position for a stable journey order.
  times.sort((x, y) => x.seq - y.seq);
  // Minimum-time variant for building segments: use departure for each stop.
  const seg: { stopId: string; t: number }[] = times.map((x) => ({
    stopId: x.stopId,
    t: x.dep != null ? x.dep : x.arr as number,
  }));

  let pos: Positioned | undefined;
  let status: Train["status"] = "intransit";

  // Find the segment [i, i+1] straddling `now`.
  for (let i = 0; i < seg.length - 1; i++) {
    const a = seg[i];
    const b = seg[i + 1];
    const sa = stopLookup(agency, a.stopId);
    const sb = stopLookup(agency, b.stopId);
    if (now >= a.t && now <= b.t && sa && sb) {
      const denom = b.t - a.t;
      const t = denom > 0 ? (now - a.t) / denom : 0;
      const lp = lerpLatLon(sa, sb, t);
      const brng = bearing(sa, sb);
      pos = { lat: lp.lat, lon: lp.lon, bearingNum: brng };
      status = t < 0.12 ? "stopped" : "intransit";
      break;
    }
  }

  // Next stops (predicted arrivals in the future).
  const nextStops: NextStop[] = [];
  for (const s of times) {
    const at = s.arr != null ? s.arr : (s.dep != null ? s.dep : null);
    if (at == null || at < now - 300) continue; // ignore stops >5min in past
    const si = stopLookup(agency, s.stopId);
    if (!si) continue;
    const mins = fmtMinutes(at - now);
    nextStops.push({
      stopId: s.stopId,
      name: si.name,
      time: at,
      minutes: mins,
    });
    if (nextStops.length >= 6) break;
  }

  const nextName = nextStops[0]?.name;
  const terminalName = times.length ? (stopLookup(agency, times[times.length - 1].stopId)?.name ?? "") : "";

  let statusLabel: string;
  switch (status) {
    case "stopped": statusLabel = nextName ? `Arriving at ${nextName}` : "At station"; break;
    default: statusLabel = nextName ? `In transit to ${nextName}` : "In transit";
  }
  return { pos, nextStops, status, statusLabel, headingLabel: terminalName || nextName || "" };
}

/** Build the live train set from all agencies. */
export function buildTrains(
  agency: Agency,
  updates: TripUpdate[],
  vehiclesById: Map<string, VehiclePosition>,
  now: number,
): Train[] {
  const out: Train[] = [];
  const seen = new Set<string>();

  for (const tu of updates) {
    const tripId = tu.trip?.tripId;
    if (!tripId) continue;
    if (seen.has(tripId)) continue;
    seen.add(tripId);

    const veh = vehiclesById.get(tripId);
    const vehPos = typeof veh?.position?.lat === "number" && typeof veh?.position?.lon === "number"
      ? veh.position
      : undefined;
    const vehStatus = veh?.currentStatus;

    const rm = routeMeta(agency, tu.trip?.routeId || veh?.trip?.routeId);
    const int = interpolate(agency, tu, now);

    let lat: number | undefined;
    let lon: number | undefined;
    let brng: number = int.pos?.bearingNum ?? 0;
    let status = int.status;
    let statusLabel = int.statusLabel;

    if (vehPos) {
      lat = vehPos.lat;
      lon = vehPos.lon;
      if (typeof vehPos.bearing === "number") brng = vehPos.bearing;
      if (vehStatus === VEHICLE_STOP_STATUS.STOPPED_AT) { status = "stopped"; statusLabel = `Stopped at ${int.nextStops[0]?.name || "station"}`; }
      else if (vehStatus === VEHICLE_STOP_STATUS.INCOMING_AT) status = "approaching";
      else status = "intransit";
    } else if (int.pos) {
      lat = int.pos.lat;
      lon = int.pos.lon;
    }

    if (lat == null || lon == null) {
      // No position at all — try placing at the nearest future stop so trains at terminals still show.
      const first = int.nextStops[0] ? stopLookup(agency, int.nextStops[0].stopId) : undefined;
      if (!first) continue;
      lat = first.lat;
      lon = first.lon;
      status = "layover";
      statusLabel = `Layover at ${first.name}`;
    }

    // Destination label.
    const hsign = headsign(agency, tripId);
    const destinations = hsign ? [hsign] : (int.headingLabel ? [int.headingLabel] : []);

    out.push({
      id: `${agency}:${tripId}`,
      tripId,
      agency,
      routeId: rm.routeId,
      routeShort: rm.routeShort,
      routeColor: rm.routeColor,
      routeText: rm.routeText,
      destinations,
      headingLabel: destinations[0] || rm.routeShort,
      status,
      statusLabel,
      lat,
      lon,
      bearing: brng,
      nextStop: int.nextStops[0],
      nextStops: int.nextStops,
      speedMph: vehPos?.speed ? Math.round(vehPos.speed * 2.237) : undefined,
      timestamp: tu.timestamp ?? now,
      lineName: rm.routeId || rm.routeShort,
    });
  }

  // Sort so short arrivals sit on top.
  out.sort((a, b) => (a.nextStop?.minutes ?? 99) - (b.nextStop?.minutes ?? 99));
  return out;
}

export function indexVehicles(vehicles: VehiclePosition[]): Map<string, VehiclePosition> {
  const m = new Map<string, VehiclePosition>();
  for (const v of vehicles) {
    const key = v.trip?.tripId || v.vehicle?.id || "";
    if (!key) continue;
    // Prefer entries carrying a position.
    const hasPos = typeof v.position?.lat === "number";
    if (!m.has(key) || hasPos) m.set(key, v);
  }
  return m;
}