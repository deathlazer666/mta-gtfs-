import { X, MapPin, Clock, ArrowUpRight, TrainFront } from "lucide-react";
import type { Train } from "../lib/types";
import { AGENCY_CONFIG } from "../lib/agencies";

export function TrainDetail({ train, onClose, onFocus }: { train: Train; onClose: () => void; onFocus: () => void }) {
  const agency = AGENCY_CONFIG[train.agency];
  return (
    <div className="absolute bottom-4 left-4 z-[600] w-80 overflow-hidden rounded-xl border border-edge bg-panel shadow-2xl">
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: `${train.routeColor}1f` }}>
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-sm font-extrabold shadow"
          style={{ background: train.routeColor, color: train.routeText }}
        >
          {train.agency === "subway" ? train.routeShort.split(" ")[0] : train.agency === "lirr" ? "LIRR" : "MN"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-extrabold text-white">{train.headingLabel}</span>
            {agency && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: agency.color, color: "#fff" }}>
                {agency.short}
              </span>
            )}
          </div>
          <p className="text-[12px] text-muted" style={{ color: train.routeColor }}>{train.routeShort}</p>
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-panel2 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 py-3">
        <div className="mb-3 flex items-center gap-2 text-[12.5px] text-[#cfd6df]">
          <span className={`h-2.5 w-2.5 rounded-full ${train.status === "stopped" ? "bg-emerald-400" : "animate-pulse bg-accent"}`} />
          {train.statusLabel}
        </div>

        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
          <Clock className="h-3.5 w-3.5" /> Next stops
        </div>
        <div className="rounded-lg border border-edge bg-panel2">
          {train.nextStops.length === 0 && (
            <div className="px-3 py-4 text-center text-[12px] text-muted"><MapPin className="mx-auto mb-1 h-4 w-4" />No predictions yet</div>
          )}
          {train.nextStops.map((s, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 px-3 py-1.5 ${i !== train.nextStops.length - 1 ? "border-b border-edge/60" : ""}`}
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-panel text-[9px] font-bold text-muted">{s.minutes}</span>
              <span className="text-[12.5px] text-[#dfe3e9]">{s.name}</span>
              <span className="ml-auto flex items-center gap-1 font-mono text-[11px] text-accent">
                <Clock className="h-3 w-3" /> {new Date(s.time * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex justify-between text-[11px] text-muted">
          <span>Speed {train.speedMph != null ? `${train.speedMph} mph` : "—"}</span>
          <span className="font-mono">Trip {train.tripId.slice(0, 24)}</span>
        </div>

        <button
          onClick={onFocus}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-accent/90 py-2 text-[12.5px] font-bold text-black transition hover:bg-accent"
        >
          <ArrowUpRight className="h-4 w-4" /> Center on map
        </button>
      </div>
      <div className="flex items-center gap-2 border-t border-edge/60 bg-panel2 px-4 py-2 text-[10.5px] text-muted">
        <TrainFront className="h-3.5 w-3.5" />
        Source: MTA GTFS-RT · {agency.name}
      </div>
    </div>
  );
}