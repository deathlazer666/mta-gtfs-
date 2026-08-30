import { useMemo, useState } from "react";
import { Header } from "./components/Header";
import { TrainMap, MapImperative } from "./components/TrainMap";
import { AlertsPanel } from "./components/AlertsPanel";
import { TrainTicker } from "./components/TrainTicker";
import { TrainDetail } from "./components/TrainDetail";
import { useLive } from "./hooks/useLive";
import type { Agency, Train } from "./lib/types";
import { StopCircle } from "lucide-react";


export default function App() {
  const live = useLive(true);
  const [enabled, setEnabled] = useState<Record<Agency, boolean>>({ subway: true, lirr: true, mnr: true });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapApi, setMapApi] = useState<MapImperative | null>(null);
  // Minimum zoom-out severity filter (subway focused). Default shows all.
  const [hideLayovers, setHideLayovers] = useState(false);

  const toggleAgency = (a: Agency) => setEnabled((e) => ({ ...e, [a]: !e[a] }));

  const visible = useMemo(
    () =>
      live.trains.filter((t) => {
        if (!enabled[t.agency]) return false;
        if (hideLayovers && t.status === "layover") return false;
        return true;
      }),
    [live.trains, enabled, hideLayovers],
  );

  const selected = useMemo(() => {
    if (!selectedId) return null;
    const t = visible.find((x) => x.id === selectedId);
    if (t) return t;
    const full = live.trains.find((x) => x.id === selectedId);
    return full ?? null;
  }, [selectedId, visible, live.trains]);

  const activeAlerts = useMemo(() => live.alerts.filter((a) => a.active), [live.alerts]);

  const focusTrain = (t: Train) => {
    setSelectedId(t.id);
    mapApi?.flyToTrain(t);
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
        <TrainMap trains={visible} selectedId={selectedId} onSelect={setSelectedId} onMapInstance={setMapApi} />

        {/* Layover toggle */}
        <button
          onClick={() => setHideLayovers((h) => !h)}
          className="absolute right-4 top-4 z-[500] flex items-center gap-1.5 rounded-lg border border-edge bg-panel px-3 py-1.5 text-[11px] font-semibold text-[#c8cdd6] shadow-lg backdrop-blur"
        >
          <StopCircle className="h-3.5 w-3.5" />
          {hideLayovers ? "Show layovers" : "Hide layovers"}
        </button>

        {/* Left panel: train board */}
        <div className="absolute left-4 top-4 z-[500] flex max-h-[88%] flex-col gap-3">
          <TrainTicker trains={visible} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

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