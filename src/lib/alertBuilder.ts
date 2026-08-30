import type { Agency, ServiceAlert } from "./types";
import { Alert, firstTranslationText, EFFECT } from "./gtfsrt";

// MTA alerts feed: informed_entity.route_id values. Subway = route letter/number.
// Rail alerts often use route_id values we map here.
const RAIL_ROUTE_MAP: Record<string, Agency> = {
  MN: "mnr", MNR: "mnr", MetroNorth: "mnr", MetroNorthRR: "mnr",
  LIRR: "lirr", LI: "lirr",
};

const SEVERITY_LABEL: Record<number, string> = {
  1: "Severe",
  2: "Warning",
  3: "Advisory",
  4: "Info",
};

export function buildAlerts(feedId: string, alerts: Alert[], now: number): ServiceAlert[] {
  return alerts.flatMap((a) => {
    const stripHtml = (s: string) =>
      s.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#39;/g, "'").replace(/&quot;/g, "\"").replace(/\s+/g, " ").trim();
    const header = stripHtml(firstTranslationText(a.header));
    const description = stripHtml(firstTranslationText(a.description));

    // Active period (impact period preferred; fall back to communication). If both
    // empty, treat as always-active.
    const period = a.impactPeriod.find((p) => (p.start ?? 0) <= now && (p.end ?? now + 3600 * 24 * 365) > now)
      ?? a.impactPeriod[a.impactPeriod.length - 1]
      ?? a.communicationPeriod[a.communicationPeriod.length - 1];

    const start = period?.start ?? 0;
    const end = period?.end ?? 0;
    const active = start === 0 || (now >= start && (end === 0 || now < end));

    const routes = [...new Set(a.informedEntity.map((e) => e.routeId).filter((r): r is string => !!r))];
    // In the MTA alerts feed an entity with no route and no trip is an agency-wide notice.
    const agencies: Agency[] = [];
    for (const r of routes) {
      const agency = RAIL_ROUTE_MAP[r];
      if (agency && !agencies.includes(agency)) agencies.push(agency);
      else if (!RAIL_ROUTE_MAP[r] && /^[A-Z0-9]+$/.test(r)) {
        if (!agencies.includes("subway")) agencies.push("subway");
      }
    }
    if (agencies.length === 0) agencies.push("subway");

    // Derive a severity from the MTA status label or effect when present.
    const statusL = (a.statusLabel || "").toLowerCase();
    let severity = a.severityLevel;
    if (severity === undefined || severity === 0) {
      if (a.effect === EFFECT.SIGNIFICANT_DELAYS || /severe|suspend|closed|cancel/.test(statusL)) severity = 1;
      else if (/delay|service change|modified|detour|reduced|partial/.test(statusL) || (a.effect && a.effect !== EFFECT.NO_EFFECT && a.effect !== EFFECT.UNKNOWN_EFFECT)) severity = 2;
      else if (a.effect && ![EFFECT.NO_EFFECT, EFFECT.UNKNOWN_EFFECT].includes(a.effect)) severity = 3;
      else severity = 4;
    }

    return {
      id: `${feedId}:${(a.header?.translation?.[0]?.text || "").slice(0, 24)}:${routes.join("+")}`,
      routes,
      agencies,
      header,
      description,
      severity,
      effect: a.effect?.toString() ?? "",
      cause: a.cause?.toString() ?? "",
      start,
      end,
      active,
    } satisfies ServiceAlert;
  });
}

export function severityLabel(severity: number): string {
  return SEVERITY_LABEL[severity] || "Info";
}