import type { Agency, Train, ServiceAlert } from "./types";
import { AGENCY_CONFIG, feedUrl, ALERTS_URL } from "./agencies";
import { decodeFeedMessage, TripUpdate, VehiclePosition, Alert } from "./gtfsrt";
import { buildTrains, indexVehicles } from "./trainBuilder";
import { buildAlerts } from "./alertBuilder";

export interface LiveSnapshot {
  trains: Train[];
  alerts: ServiceAlert[];
  updatedAt: number;
  errors: string[];
}

export async function fetchFeed(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { Accept: "application/x-protobuf" } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

function decode(buf: Uint8Array) {
  return decodeFeedMessage(buf);
}

/** Fetch one agency's realtime feeds and build its trains. */
export async function fetchAgency(agency: Agency, now: number): Promise<Train[]> {
  const cfg = AGENCY_CONFIG[agency];
  const allUpdates: TripUpdate[] = [];
  const allVehicles: VehiclePosition[] = [];

  await Promise.all(
    cfg.feeds.map(async (f) => {
      const url = feedUrl(f);
      const msg = decode(await fetchFeed(url));
      for (const e of msg.entity) {
        if (e.tripUpdate) allUpdates.push(e.tripUpdate);
        if (e.vehicle) allVehicles.push(e.vehicle);
      }
    }),
  );

  const byId = indexVehicles(allVehicles);
  return buildTrains(agency, allUpdates, byId, now);
}

/** Fetch the aggregate service-alerts feed. */
export async function fetchAlerts(now: number): Promise<ServiceAlert[]> {
  const msg = decode(await fetchFeed(ALERTS_URL));
  const al: Alert[] = msg.entity.map((e) => e.alert).filter((a): a is Alert => !!a);
  return buildAlerts("alerts", al, now);
}

export async function refreshAll(now: number): Promise<LiveSnapshot> {
  const errors: string[] = [];
  const agencies: Agency[] = ["subway", "lirr", "mnr"];
  const results = await Promise.allSettled(agencies.map((a) => fetchAgency(a, now)));
  const trains: Train[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") trains.push(...r.value);
    else errors.push(`${agencies[i]}: ${(r.reason as Error).message}`);
  });

  let alerts: ServiceAlert[] = [];
  try {
    alerts = await fetchAlerts(now);
  } catch (e) {
    errors.push(`alerts: ${(e as Error).message}`);
  }

  return { trains, alerts, updatedAt: now, errors };
}