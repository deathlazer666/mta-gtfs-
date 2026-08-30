import { useMemo, useState } from "react";
import { Header } from "./components/Header";
import { TrainMap, RoutePathData, MapImperative } from "./components/TrainMap";
import { AlertsPanel } from "./components/AlertsPanel";
import { TrainTicker } from "./components/TrainTicker";
import { TrainDetail } from "./components/TrainDetail";
import { RouteFilter } from "./components/RouteFilter";
import { useLive } from "./hooks/useLive";
import { ALL_ROUTES, routePolyLines, routeLabel, LegendRoute } from "./lib/staticData";
import type { Agency, Train } from "./lib/types";
import { StopCircle, MapPinned, ListFilter } from "lucide-react";

const routeKey = (a: string, r: string) => `${a}:${r}`;

export default function App() {
  const live = useLive(true);
  const [enabled, setEnabled] = useState<Record<Agency, boolean>>({ subway: true, lirr: true, mnr: true });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapApi, setMapApi] = useState<MapImperative | null>(null);
  const [hideLayovers, setHideLayovers] = useState(false);
  const [showAllStations, setShowAllStations] = useState(false);
  const [showBoard, setShowBoard] = useState(true);
  const [hiddenRoutes, setHiddenRoutes] = useState<Set<string>>(new Set());
  const [activeRoute, setActiveRoute] = useState<string | null>(null);

  const toggleAgency = (a: Agency) => setEnabled((e) => ({ ...e, [a]: !e[a] }));

  // All routes with geometry, one entry per agency (reuse ALL_ROUTES for labels).
  const allLegend: LegendRoute[] = useMemo(() => ALL_ROUTES, []);

  // Visible trains: apply agency enable, hidden lines, focus line.
  const visible = useMemo(
    () =>
      live.trains.filter((t) => {
        if (!enabled[t.agency]) return false;
        if (hiddenRoutes.has(routeKey(t.agency, t.lineName))) return false;
        if (activeRoute && activeRoute !== routeKey(t.agency, t.lineName)) return false;
        if (hideLayovers && t.status === "layover") return false;
        return true;
      }),
    [live.trains, enabled, hiddenRoutes, activeRoute, hideLayovers],
  );

  // Build clickable route path geometries from static data, honoring visibility + agency.
  const routePaths = useMemo<RoutePathData[]>(() => {
    const out: RoutePathData[] = [];
    for (const r of allLegend) {
      if (!enabled[r.agency as Agency]) continue;
      if (hiddenRoutes.has(routeKey(r.agency, r.routeId))) continue;
      const latlngs = routePolyLines(r.agency, r.routeId);
      if (!latlngs.length) continue;
      out.push({ agency: r.agency, routeId: r.routeId, color: r.color, latlngs });
    }
    return out;
  }, [allLegend, enabled, hiddenRoutes]);

  const trainCountByRoute = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of live.trains) m[routeKey(t.agency, t.lineName)] = (m[routeKey(t.agency, t.lineName)] || 0) + 1;
    return m;
  }, [live.trains]);

  // Selected train could be hidden by filters after focus; keep detail working.
  const selected = useMemo(() => {
    if (!selectedId) return null;
    return live.trains.find((x) => x.id === selectedId) ?? null;
  }, [selectedId, live.trains]);

  const activeAlerts = useMemo(() => live.alerts.filter((a) => a.active), [live.alerts]);

  const focusTrain = (t: Train) => {
    // Reveal the line if it was filtered out.
    const key = routeKey(t.agency, t.lineName);
    setHiddenRoutes((h) => {
      if (!h.has(key)) return h;
      const n = new Set(h); n.delete(key); return n;
    });
    setSelectedId(t.id);
    mapApi?.flyToTrain(t);
  };

  const toggleRoute = (key: string) => {
    setHiddenRoutes((h) => {
      const n = new Set(h);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  };

  const clickRoute = (agency: string, routeId: string) => {
    const key = routeKey(agency, routeId);
    setActiveRoute((cur) => (cur === key ? null : key));
    const d = routePaths.find((x) => routeKey(x.agency, x.routeId) === key);
    if (d) mapApi?.flyToRoute(d);
  };

  return (
    <div className="flex h-screen flex-col bg-bg text-white">
      <Header
        enabled={enabled}
        toggleAgency={toggleAgency}
        updatedAt={live.updatedAt}
        trainCount={live.trains.length}
        error={live.errors.length > 0}
      />

      <div className="relative flex min-h-0 flex-1">
        <TrainMap
          trains={visible}
          selectedId={selectedId}
          routePaths={routePaths}
          activeRoute={activeRoute}
          showAllStations={showAllStations}
          onSelect={setSelectedId}
          onClickRoute={clickRoute}
          onMapInstance={setMapApi}
        />

        {/* Right-top: line filter */}
        <div className="absolute right-4 top-4 z-[500]">
          <RouteFilter
            routes={allLegend}
            hidden={hiddenRoutes}
            activeRoute={activeRoute}
            onToggle={toggleRoute}
            onClearActive={() => setActiveRoute(null)}
            trainCountByRoute={trainCountByRoute}
          />
        </div>

        {/* Top-left toggles: layover hide + show-all station labels + train board */}
        <div className="absolute left-4 top-4 z-[510] flex items-center gap-2">
          <button
            onClick={() => setHideLayovers((h) => !h)}
            className="flex items-center gap-1.5 rounded-lg border border-edge bg-panel px-3 py-1.5 text-[11px] font-semibold text-[#c8cdd6] shadow-lg backdrop-blur"
          >
            <StopCircle className="h-3.5 w-3.5" />
            {hideLayovers ? "Show layovers" : "Hide layovers"}
          </button>
          <button
            onClick={() => setShowAllStations((s) => !s)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold shadow-lg backdrop-blur ${showAllStations ? "border-accent bg-accent/15 text-accent" : "border-edge bg-panel text-[#c8cdd6]"}`}
            title="Label every subway & Metro-North station"
          >
            <MapPinned className="h-3.5 w-3.5" />
            Station labels
          </button>
          <button
            onClick={() => setShowBoard((b) => !b)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold shadow-lg backdrop-blur ${showBoard ? "border-accent bg-accent/15 text-accent" : "border-edge bg-panel text-[#c8cdd6]"}`}
            title="Show or hide the Active Trains panel"
          >
            <ListFilter className="h-3.5 w-3.5" />
            Board
          </button>
        </div>

        {/* Left panel: train board (below the top-left toggles so they never overlap) */}
        {showBoard && (
          <div className="absolute left-4 top-14 bottom-20 z-[500] flex w-80 flex-col">
            <TrainTicker
              trains={visible}
              selectedId={selectedId}
              onSelect={setSelectedId}
              activeRoute={activeRoute}
              onShowRoute={clickRoute}
              routeLabel={routeLabel}
            />
          </div>
        )}

        {/* Bottom-right: service alerts */}
        <div className="absolute bottom-4 right-4 z-[500]">
          <AlertsPanel alerts={activeAlerts} />
        </div>

        {/* Selected train detail */}
        {selected && (
          <TrainDetail
            train={selected}
            onClose={() => setSelectedId(null)}
            onFocus={() => focusTrain(selected)}
          />
        )}
      </div>
    </div>
  );
}