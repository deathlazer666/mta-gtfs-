import { TriangleAlert, CircleAlert, Info, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { ServiceAlert } from "../lib/types";
import { severityLabel } from "../lib/alertBuilder";
import { AGENCY_CONFIG } from "../lib/agencies";

function severityTone(s: number): { icon: typeof Info; cls: string; bar: string } {
  if (s === 1 || s === 2) return { icon: TriangleAlert, cls: "text-red-300", bar: "bg-red-500" };
  if (s === 3) return { icon: CircleAlert, cls: "text-amber-300", bar: "bg-amber-400" };
  return { icon: Info, cls: "text-blue-300", bar: "bg-blue-400" };
}

export function AlertsPanel({ alerts }: { alerts: ServiceAlert[] }) {
  const [open, setOpen] = useState(true);
  const sorted = [...alerts].sort((a, b) => a.severity - b.severity);
  const severe = sorted.filter((a) => a.severity <= 2).length;

  return (
    <div className="flex max-h-72 w-80 flex-col overflow-hidden rounded-xl border border-edge bg-panel shadow-2xl">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 border-b border-edge bg-panel2 px-3 py-2.5 text-left"
      >
        <TriangleAlert className={`h-4 w-4 ${severe ? "text-red-300" : "text-amber-300"}`} />
        <span className="text-[13px] font-bold text-white">Service Issues</span>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${severe ? "bg-red-500/20 text-red-200" : "bg-panel text-muted"}`}>
          {alerts.length}
        </span>
        {open ? <ChevronDown className="h-4 w-4 text-muted" /> : <ChevronRight className="h-4 w-4 text-muted" />}
      </button>

      {open && (
        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 && (
            <div className="px-4 py-6 text-center text-[12px] text-muted">
              <div className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-full bg-emerald-500/10 text-emerald-300">
                <Info className="h-4 w-4" />
              </div>
              No active service alerts.
            </div>
          )}
          {sorted.map((a, i) => {
            const tone = severityTone(a.severity);
            const Icon = tone.icon;
            const agencyColors = [...new Set(a.agencies)].map((ag) => AGENCY_CONFIG[ag].color);
            return (
              <div key={i} className="relative border-b border-edge/60 px-3 py-2.5 pl-4">
                <span className={`absolute left-0 top-0 h-full w-[3px] ${tone.bar}`} />
                <div className="flex items-center gap-2">
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${tone.cls}`} />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
                    {severityLabel(a.severity)}
                  </span>
                  <span className="ml-auto flex gap-1">
                    {agencyColors.map((c, ci) => (
                      <span key={ci} className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                    ))}
                  </span>
                </div>
                {a.routes.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {a.routes.slice(0, 8).map((r, ri) => (
                      <span key={ri} className="rounded bg-panel2 border border-edge px-1.5 py-0.5 text-[10px] font-mono text-[#c8cdd6]">
                        {r}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-[12.5px] font-medium leading-snug text-white">{a.header}</p>
                {a.description && <p className="mt-1 text-[11.5px] leading-snug text-muted">{a.description}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}