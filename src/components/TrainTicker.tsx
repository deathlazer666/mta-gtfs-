import type { Train } from "../lib/types";
import { AGENCY_CONFIG } from "../lib/agencies";

export function TrainTicker({
  trains,
  selectedId,
  onSelect,
}: {
  trains: Train[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const shown = trains.slice(0, 80);
  return (
    <div className="flex w-80 flex-col overflow-hidden rounded-xl border border-edge bg-panel shadow-2xl">
      <div className="border-b border-edge bg-panel2 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold text-white">Active Trains</span>
          <span className="text-[11px] font-mono text-muted">{trains.length.toLocaleString()} vehicles</span>
        </div>
      </div>
      <div className="max-h-60 flex-1 overflow-y-auto">
        {shown.length === 0 && (
          <div className="px-4 py-6 text-center text-[12px] text-muted">Waiting for feed…</div>
        )}
        {shown.map((t) => {
          const sel = t.id === selectedId;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(sel ? null : t.id)}
              className={`flex w-full items-center gap-2 border-b border-edge/60 px-3 py-2 text-left transition ${sel ? "bg-accent/10" : "hover:bg-panel2"}`}
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