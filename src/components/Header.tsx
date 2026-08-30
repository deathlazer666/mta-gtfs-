import { TrainFront, Radio, Wifi } from "lucide-react";
import { AGENCY_CONFIG } from "../lib/agencies";
import type { Agency } from "../lib/types";

export function Header({
  enabled,
  toggleAgency,
  updatedAt,
  trainCount,
  error,
}: {
  enabled: Record<Agency, boolean>;
  toggleAgency: (a: Agency) => void;
  updatedAt: number;
  trainCount: number;
  error: boolean;
}) {
  const last = updatedAt ? new Date(updatedAt * 1000).toLocaleTimeString() : "…";
  return (
    <header className="flex h-14 items-center gap-3 border-b border-edge bg-panel px-4">
      <div className="flex items-center gap-2.5">
        <div className="bg-gradient-to-br from-[#ee352e] via-[#0039a6] to-[#00985f] grid h-9 w-9 place-items-center rounded-lg p-0 shadow-lg">
          <TrainFront className="h-5 w-5" aria-hidden />
        </div>
        <div className="leading-tight">
          <h1 className="text-[15px] font-extrabold tracking-tight text-white">MTA Live</h1>
          <p className="text-[11px] text-muted">Subway · Metro-North · LIRR</p>
        </div>
      </div>

      {/* Agency toggles */}
      <div className="ml-6 flex items-center gap-2">
        {(Object.keys(AGENCY_CONFIG) as Agency[]).map((a) => {
          const on = enabled[a];
          const col = AGENCY_CONFIG[a].color;
          return (
            <button
              key={a}
              onClick={() => toggleAgency(a)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold transition ${on ? "text-white" : "border-edge bg-panel2 text-muted"}`}
              style={on ? { borderColor: col, background: `${col}22` } : undefined}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: on ? col : "#3a4350" }} />
              {AGENCY_CONFIG[a].short}
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-3 text-[12px]">
        <div className="flex items-center gap-1.5 rounded-md border border-edge bg-panel2 px-2.5 py-1 font-mono text-muted">
          <Radio className="h-3.5 w-3.5" />
          <span>{trainCount.toLocaleString()} trains</span>
        </div>
        <div className="flex items-center gap-1.5">
          {error ? (
            <span className="flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-red-300">
              <Wifi className="h-3.5 w-3.5" /> Feed issue
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-md border border-edge bg-panel2 px-2.5 py-1 font-mono text-muted">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              <span>Updated {last}</span>
            </span>
          )}
        </div>
      </div>
    </header>
  );
}