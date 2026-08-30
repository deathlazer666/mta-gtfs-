import { useState } from "react";
import { Layers, ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import { AGENCY_CONFIG } from "../lib/agencies";
import type { LegendRoute } from "../lib/staticData";

export function RouteFilter({
  routes,
  hidden,
  activeRoute,
  onToggle,
  onClearActive,
  trainCountByRoute,
}: {
  routes: LegendRoute[];
  hidden: Set<string>;
  activeRoute: string | null;
  onToggle: (key: string) => void;
  onClearActive: () => void;
  trainCountByRoute: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const agencies: { key: string; label: string; routes: LegendRoute[] }[] = (["subway", "lirr", "mnr"] as const).map((a) => ({
    key: a,
    label: AGENCY_CONFIG[a].short,
    routes: routes.filter((r) => r.agency === a).sort((x, y) => (x.short.localeCompare(y.short) || x.long.localeCompare(y.long))),
  }));

  const hiddenCount = hidden.size;

  return (
    <div className="w-72 overflow-hidden rounded-xl border border-edge bg-panel shadow-2xl">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 border-b border-edge bg-panel2 px-3 py-2.5 text-left"
      >
        <Layers className="h-4 w-4 text-accent" />
        <span className="text-[13px] font-bold text-white">Lines</span>
        {hiddenCount > 0 && (
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-200">{hiddenCount} hidden</span>
        )}
        {open ? <ChevronUp className="ml-auto h-4 w-4 text-muted" /> : <ChevronDown className="ml-auto h-4 w-4 text-muted" />}
      </button>

      {open && (
        <div className="max-h-[46vh] overflow-y-auto px-2 py-2">
          {activeRoute && (
            <button onClick={onClearActive} className="mb-2 w-full rounded-md border border-accent/40 bg-accent/10 px-2 py-1.5 text-[11.5px] font-semibold text-accent hover:bg-accent/20">
              ✕ Clear focused line ({activeRoute.split(":")[1]})
            </button>
          )}
          {agencies.map((ag) => (
            <div key={ag.key} className="mb-2">
              <div className="flex items-center gap-2 px-1 pb-1 pt-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: AGENCY_CONFIG[ag.key as keyof typeof AGENCY_CONFIG].color }} />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{ag.label}</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {ag.routes.map((r) => {
                  const key = `${r.agency}:${r.routeId}`;
                  const isHidden = hidden.has(key);
                  const isActive = activeRoute === key;
                  const count = trainCountByRoute[key] || 0;
                  return (
                    <button
                      key={key}
                      onClick={() => onToggle(key)}
                      className={`flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-left transition ${
                        isActive ? "border-white bg-panel2" : isHidden ? "border-edge opacity-40" : "border-edge hover:bg-panel2"
                      }`}
                      title={`${r.long} — ${count} trains`}
                    >
                      <span
                        className="grid h-4 w-4 shrink-0 place-items-center rounded-[5px] text-[8.5px] font-extrabold"
                        style={{ background: isHidden ? "#2a3442" : r.color, color: "#fff" }}
                      >
                        {r.short}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[10.5px] text-[#c8cdd6]">{r.short || r.long}</span>
                      {count > 0 && <span className="text-[9px] font-mono text-accent">{count}</span>}
                      {isHidden ? <EyeOff className="h-3 w-3 text-muted" /> : <Eye className="h-3 w-3 text-muted/60" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}