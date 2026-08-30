import { Reader } from "./protobuf";

// Standard GTFS-RT enums (subset used).
export const VEHICLE_STOP_STATUS = { INCOMING_AT: 0, STOPPED_AT: 1, IN_TRANSIT_TO: 2 };

export interface StopTimeEvent { delay?: number; time?: number; }
export interface StopTimeUpdate { stopSequence?: number; stopId?: string; arrival?: StopTimeEvent; departure?: StopTimeEvent; relationship?: number; }
export interface TripDescriptor { tripId?: string; routeId?: string; directionId?: number; startTime?: string; startDate?: string; relationship?: number; }

export const SCHEDULE_REL = { SCHEDULED: 0, ADDED: 1, UNSCHEDULED: 2, CANCELED: 3, REPLACEMENT: 5, DUPLICATED: 6, DELETED: 7, NEW: 8 };
export const STOP_UPDATE_REL = { SCHEDULED: 0, SKIPPED: 1, NO_DATA: 2, UNSCHEDULED: 3 };
export const EFFECT = { NO_SERVICE: 1, REDUCED_SERVICE: 2, SIGNIFICANT_DELAYS: 3, DETOUR: 4, ADDITIONAL_SERVICE: 5, MODIFIED_SERVICE: 6, OTHER_EFFECT: 7, UNKNOWN_EFFECT: 8, STOP_MOVED: 9, NO_EFFECT: 10, ACCESSIBILITY_ISSUE: 11 };
export interface TripUpdate { trip?: TripDescriptor; stopTimeUpdates: StopTimeUpdate[]; timestamp?: number; delay?: number; }
export interface Position { lat?: number; lon?: number; bearing?: number; speed?: number; }
export interface VehicleDescriptor { id?: string; label?: string; }
export interface VehiclePosition { trip?: TripDescriptor; vehicle?: VehicleDescriptor; position?: Position; currentStopSequence?: number; stopId?: string; timestamp?: number; currentStatus?: number; }
export interface Transcript { language?: string; text?: string; }
export interface Translation { translation: Transcript[]; }
export interface TimeRange { start?: number; end?: number; }
export interface EntitySelector { agencyId?: string; routeId?: string; routeType?: number; trip?: TripDescriptor; stopId?: string; directionId?: number; }
export interface Alert {
  communicationPeriod: TimeRange[];
  impactPeriod: TimeRange[];
  informedEntity: EntitySelector[];
  cause?: number;
  effect?: number;
  url?: Translation;
  header?: Translation;
  description?: Translation;
  severityLevel?: number;
  /** MTA extension (feed 1001).status: e.g. "Delays", "Severe Delays", "Service Change". */
  statusLabel?: string;
}
export interface FeedEntity { id: string; isDeleted?: boolean; tripUpdate?: TripUpdate; vehicle?: VehiclePosition; alert?: Alert; }
export interface FeedHeader { timestamp?: number; }
export interface FeedMessage { header?: FeedHeader; entity: FeedEntity[]; }

function decodeStopTimeEvent(r: Reader): StopTimeEvent {
  const ev: StopTimeEvent = {};
  r.fields((fn, wt) => {
    switch (fn) {
      case 1: if (wt === 0) ev.delay = r.varint() | 0; else r.skip(wt); break;
      case 2: if (wt === 0) ev.time = r.int64(); else r.skip(wt); break;
      default: r.skip(wt);
    }
  });
  return ev;
}

function decodeTripDescriptor(r: Reader): TripDescriptor {
  const t: TripDescriptor = {};
  r.fields((fn, wt) => {
    switch (fn) {
      case 1: t.tripId = r.string(); break;
      case 2: t.startTime = r.string(); break;
      case 3: t.startDate = r.string(); break;
      case 4: if (wt === 0) t.relationship = r.varint(); else r.skip(wt); break;
      case 5: t.routeId = r.string(); break;
      case 6: if (wt === 0) t.directionId = r.varint(); else r.skip(wt); break;
      default: r.skip(wt);
    }
  });
  return t;
}

function decodeStopTimeUpdate(r: Reader): StopTimeUpdate {
  const s: StopTimeUpdate = {};
  r.fields((fn, wt) => {
    switch (fn) {
      case 1: if (wt === 0) s.stopSequence = r.varint(); else r.skip(wt); break;
      case 2: if (wt === 2) s.arrival = decodeStopTimeEvent(r.sub()); else r.skip(wt); break;
      case 3: if (wt === 2) s.departure = decodeStopTimeEvent(r.sub()); else r.skip(wt); break;
      case 4: s.stopId = r.string(); break;
      case 5: if (wt === 0) s.relationship = r.varint(); else r.skip(wt); break;
      default: r.skip(wt);
    }
  });
  return s;
}

function decodeTripUpdate(r: Reader, out: TripUpdate): void {
  r.fields((fn, wt) => {
    switch (fn) {
      case 1: if (wt === 2) out.trip = decodeTripDescriptor(r.sub()); else r.skip(wt); break;
      case 2: if (wt === 2) out.stopTimeUpdates.push(decodeStopTimeUpdate(r.sub())); else r.skip(wt); break;
      case 4: if (wt === 0) out.timestamp = r.int64(); else r.skip(wt); break;
      case 5: if (wt === 0) out.delay = r.varint() | 0; else r.skip(wt); break;
      default: r.skip(wt);
    }
  });
}

function decodePosition(r: Reader): Position {
  const p: Position = {};
  r.fields((fn, wt) => {
    switch (fn) {
      case 1: if (wt === 5) p.lat = r.float32(); else r.skip(wt); break;
      case 2: if (wt === 5) p.lon = r.float32(); else r.skip(wt); break;
      case 3: if (wt === 5) p.bearing = r.float32(); else r.skip(wt); break;
      case 5: if (wt === 5) p.speed = r.float32(); else r.skip(wt); break;
      default: r.skip(wt);
    }
  });
  return p;
}

function decodeVehicleDescriptor(r: Reader): VehicleDescriptor {
  const v: VehicleDescriptor = {};
  r.fields((fn, wt) => {
    if (fn === 1) v.id = r.string();
    else if (fn === 2) v.label = r.string();
    else r.skip(wt);
  });
  return v;
}

function decodeVehiclePosition(r: Reader, out: VehiclePosition): void {
  r.fields((fn, wt) => {
    switch (fn) {
      case 1: if (wt === 2) out.trip = decodeTripDescriptor(r.sub()); else r.skip(wt); break;
      case 2: if (wt === 2) out.position = decodePosition(r.sub()); else r.skip(wt); break;
      case 3: if (wt === 0) out.currentStopSequence = r.varint(); else r.skip(wt); break;
      case 5: if (wt === 0) out.timestamp = r.int64(); else r.skip(wt); break;
      case 7: out.stopId = r.string(); break;
      case 8: if (wt === 2) out.vehicle = decodeVehicleDescriptor(r.sub()); else r.skip(wt); break;
      case 9: if (wt === 0) out.currentStatus = r.varint(); else r.skip(wt); break;
      default: r.skip(wt);
    }
  });
}

function decodeTimeRange(r: Reader): TimeRange {
  const t: TimeRange = {};
  r.fields((fn, wt) => {
    if (fn === 1 && wt === 0) t.start = r.int64();
    else if (fn === 2 && wt === 0) t.end = r.int64();
    else r.skip(wt);
  });
  return t;
}

function decodeEntitySelector(r: Reader): EntitySelector {
  const e: EntitySelector = {};
  r.fields((fn, wt) => {
    switch (fn) {
      case 1: e.agencyId = r.string(); break;
      case 2: e.routeId = r.string(); break;
      case 3: if (wt === 0) e.routeType = r.varint() | 0; else r.skip(wt); break;
      case 4: if (wt === 2) e.trip = decodeTripDescriptor(r.sub()); else r.skip(wt); break;
      case 5: e.stopId = r.string(); break;
      case 6: if (wt === 0) e.directionId = r.varint(); else r.skip(wt); break;
      default: r.skip(wt);
    }
  });
  return e;
}

/** TranslatedString { repeated Translation translation = 1; } / Translation { text = 1; language = 2; }. */
function decodeTranslationMessage(r: Reader): Transcript {
  const out: Transcript = { text: "", language: undefined };
  r.fields((fn, wt) => {
    if (fn === 1 && wt === 2) {
      // field 1 = a Translation sub-message
      const tr = r.sub();
      tr.fields((tfn, twt) => {
        if (tfn === 1) out.text = tr.string(); // text
        else if (tfn === 2) out.language = tr.string(); // language
        else tr.skip(twt);
      });
    } else r.skip(wt);
  });
  return out;
}

function decodeAlert(r: Reader, out: Alert): void {
  r.fields((fn, wt) => {
    switch (fn) {
      case 2: if (wt === 2) out.communicationPeriod.push(decodeTimeRange(r.sub())); else r.skip(wt); break;
      case 3: if (wt === 2) out.impactPeriod.push(decodeTimeRange(r.sub())); else r.skip(wt); break;
      case 5: if (wt === 2) out.informedEntity.push(decodeEntitySelector(r.sub())); else r.skip(wt); break;
      case 6: if (wt === 0) out.cause = r.varint(); else r.skip(wt); break;
      case 7: if (wt === 0) out.effect = r.varint(); else r.skip(wt); break;
      case 10: if (wt === 2) out.header = { translation: [decodeTranslationMessage(r.sub())] }; else r.skip(wt); break;
      case 11: if (wt === 2) out.description = { translation: [decodeTranslationMessage(r.sub())] }; else r.skip(wt); break;
      case 14: if (wt === 0) out.severityLevel = r.varint(); else r.skip(wt); break;
      case 1001: {
        // MTA alert extension: field 3 = status label (e.g. "Delays").
        if (wt === 2) {
          const ext = r.sub();
          ext.fields((xfn, xwt) => {
            if (xfn === 3 && xwt === 2) out.statusLabel = ext.string();
            else ext.skip(xwt);
          });
        } else r.skip(wt);
        break;
      }
      default: r.skip(wt);
    }
  });
}

export function decodeFeedMessage(data: Uint8Array): FeedMessage {
  const r = new Reader(data);
  const fm: FeedMessage = { entity: [] };
  r.fields((fn, wt) => {
    switch (fn) {
      case 1: {
        if (wt !== 2) throw new Error("header must be length-delimited");
        const hr = r.sub();
        hr.fields((hfn, hwt) => {
          if (hfn === 3 && hwt === 0) fm.header = { timestamp: hr.int64() };
          else hr.skip(hwt);
        });
        break;
      }
      case 2: {
        if (wt !== 2) throw new Error("entity must be length-delimited");
        const er = r.sub();
        const ent: FeedEntity = { id: "" };
        er.fields((efn, ewt) => {
          if (efn === 1) ent.id = er.string();
          else if (efn === 2) { if (ewt === 0) ent.isDeleted = er.varint() === 1; else er.skip(ewt); }
          else if (efn === 3) { if (ewt === 2) { ent.tripUpdate = { stopTimeUpdates: [] }; decodeTripUpdate(er.sub(), ent.tripUpdate); } else er.skip(ewt); }
          else if (efn === 4) { if (ewt === 2) { ent.vehicle = {}; decodeVehiclePosition(er.sub(), ent.vehicle); } else er.skip(ewt); }
          else if (efn === 5) { if (ewt === 2) { ent.alert = { communicationPeriod: [], impactPeriod: [], informedEntity: [] }; decodeAlert(er.sub(), ent.alert); } else er.skip(ewt); }
          else er.skip(ewt);
        });
        fm.entity.push(ent);
        break;
      }
      default: r.skip(wt);
    }
  });
  return fm;
}

export function firstTranslationText(t?: Translation): string {
  return t?.translation?.map((x) => x.text).join("") || "";
}