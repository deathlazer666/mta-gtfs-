import { useCallback, useEffect, useRef, useState } from "react";
import { refreshAll, LiveSnapshot } from "../lib/live";
import type { Train } from "../lib/types";

const POLL_MS = 15000;

export function useLive(active: boolean) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot>({ trains: [], alerts: [], updatedAt: 0, errors: [] });
  const [refreshKey, setRefreshKey] = useState(0);
  const running = useRef(false);

  const refresh = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const snap = await refreshAll(Date.now() / 1000);
      setSnapshot(snap);
    } catch {
      setSnapshot((s) => ({ ...s, errors: [...s.errors, "sphere refresh failed"] }));
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [active, refresh, refreshKey]);

  return {
    ...snapshot,
    trains: snapshot.trains,
    alerts: snapshot.alerts,
    refreshNow: () => setRefreshKey((k) => k + 1),
  };
}

export function trainFilter(
  trains: Train[],
  enabled: Record<string, boolean>,
  routeFilter: string | null,
): Train[] {
  return trains.filter((t) => {
    if (!enabled[t.agency]) return false;
    if (routeFilter && routeFilter !== "all" && t.lineName !== routeFilter) return false;
    return true;
  });
}export function groupByLine(trains: Train[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of trains) counts[t.lineName] = (counts[t.lineName] || 0) + 1;
  return counts;
}

