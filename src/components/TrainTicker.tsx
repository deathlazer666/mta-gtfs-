import type { Train } from "../lib/types";
import { AGENCY_CONFIG } from "../lib/agencies";

export function TrainTicker({
  trains,
  selectedId,
  onSelect,
  activeRoute,
  onShowRoute,
  routeLabel,
}: {
  trains: Train[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  activeRoute: string | null;
  onShowRoute: (agency: string, routeId: string) => void;
  routeLabel: (agency: string, routeId: string) => string;
}) {
  const shown = trains.slice(0, 120);
  return (
    <div className="flex max-h-full w-80 flex-col overflow-hidden rounded-xl border border-edge bg-panel shadow-2xl">
      <div className="border-b border-edge bg-panel2 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-white">Active Trains</span>
            {activeRoute && (
              <button
                onClick={() => onShowRoute(activeRoute.split(":")[0], activeRoute.split(":")[1])}
                className="rounded-md border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10.5px] font-bold text-accent hover:bg-accent/20"
              >
                {routeLabel(activeRoute.split(":")[0], activeRoute.split(":")[1])}
              </button>
            )}
          </div>
          <span className="text-[11px] font-mono text-muted">{trains.length.toLocaleString()} vehicles</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: "72vh" }}>
        {shown.length === 0 && (
          <div className="px-4 py-6 text-center text-[12px] text-muted">No trains match the current filters.</div>
        )}
        {shown.map((t) => {
          const sel = t.id === selectedId;
          const key = `${t.agency}:${t.lineName}`;
          const isActive = activeRoute === key;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(sel ? null : t.id)}
              className={`flex w-full items-center gap-2 border-b border-edge/60 px-3 py-2 text-left transition ${
                sel ? "bg-accent/10" : isActive ? "bg-panel2" : "hover:bg-panel2"
              }`}
            >
              <span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[12px] font-extrabold"
                style={{ background: t.routeColor, color: t.routeText }}
              >
                {t.agency === "subway" ? t.routeShort.split(" ")[0] : t.agency === "lirr" ? "L" : "M"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold text-white">{t.headingLabel}</span>
                <span className="block truncate text-[11px] text-muted">{t.statusLabel}</span>
              </span>
              <span className={`shrink-0 font-mono text-[11px] font-bold ${t.nextStop ? "text-accent" : "text-muted"}`}>
                {t.nextStop ? `${t.nextStop.minutes}m` : "–"}
              </span>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: AGENCY_CONFIG[t.agency].color }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}