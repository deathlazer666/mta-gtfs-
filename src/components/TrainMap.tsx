import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Sun, Moon } from "lucide-react";
import type { Train } from "../lib/types";
import { routeStops, stopInfo, STATIC } from "../lib/staticData";

export interface RoutePathData {
  agency: string;
  routeId: string;
  color: string;
  latlngs: [number, number][][]; // one or more polylines
}

export interface MapImperative {
  flyToTrain: (t: Train) => void;
  flyToRoute: (d: RoutePathData) => void;
}

const NYC = [40.75, -73.985] as [number, number];

type MapStyle = "dark" | "light";

const BASEMAPS: Record<MapStyle, { url: string; label: string }> = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    label: "Dark",
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    label: "Light",
  },
};

function badgeLabel(t: Train): string {
  if (t.agency === "subway") return t.routeShort.split(" ")[0];
  return t.agency === "lirr" ? "L" : "M";
}

function markerHtml(t: Train): string {
  const size = t.agency === "subway" ? 30 : 26;
  return `<div class="train-marker" style="width:${size}px;height:${size}px">
    <div class="tm-arrow" style="transform:rotate(${t.bearing}deg)"></div>
    <div class="tm-disc" style="background:${t.routeColor};color:${t.routeText}">
      <span>${badgeLabel(t)}</span>
    </div>
  </div>`;
}

function popupHtml(t: Train): string {
  const lines = (t.nextStops.slice(0, 4) || [])
    .map((s) => `<div class="tm-stop"><span class="tm-stop-min">${s.minutes}m</span><span class="tm-stop-name">${s.name}</span></div>`)
    .join("");
  const agency = t.agency === "subway" ? "Subway" : t.agency === "lirr" ? "LIRR" : "Metro-North";
  return `<div class="tm-pop">
    <div class="tm-pop-head" style="background:${t.routeColor}">
      <span class="tm-pop-badge" style="color:${t.routeText}">${badgeLabel(t)}</span>
      <span class="tm-pop-label">${agency}</span>
    </div>
    <div class="tm-pop-title">${escapeHtml(t.headingLabel)}</div>
    <div class="tm-pop-status">${escapeHtml(t.statusLabel)}</div>
    <div class="tm-pop-stops">${lines || "<i>No predictions</i>"}</div>
  </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

export function TrainMap({
  trains,
  selectedId,
  routePaths,
  activeRoute,
  showAllStations,
  onSelect,
  onClickRoute,
  onMapInstance,
}: {
  trains: Train[];
  selectedId: string | null;
  routePaths: RoutePathData[];
  activeRoute: string | null; // "agency:routeId"
  showAllStations: boolean;
  onSelect: (id: string | null) => void;
  onClickRoute: (agency: string, routeId: string) => void;
  onMapInstance?: (m: MapImperative) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const basemapRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const routesRef = useRef<L.LayerGroup | null>(null);
  const stationsRef = useRef<L.LayerGroup | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>("dark");
  const onSelectRef = useRef(onSelect);
  const onClickRouteRef = useRef(onClickRoute);
  onSelectRef.current = onSelect;
  onClickRouteRef.current = onClickRoute;

  // Init map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: NYC,
      zoom: 11,
      zoomControl: true,
      attributionControl: true,
      // MapLibre GL restricts max latitude; constrain panning to avoid sync issues.
      maxBounds: [[85, -Infinity], [-85, Infinity]] as [L.LatLngTuple, L.LatLngTuple],
      maxBoundsViscosity: 1,
      minZoom: 1,
    });
    // CARTO raster basemap (free, no API key) — dark by default to match the app.
    basemapRef.current = L.tileLayer(BASEMAPS.dark.url, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);
    // Z-order (bottom -> top): routes, station labels, trains.
    const routes = L.layerGroup().addTo(map);
    const stations = L.layerGroup().addTo(map);
    const markers = L.layerGroup().addTo(map);
    markersRef.current = markers;
    routesRef.current = routes;
    stationsRef.current = stations;
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
      routesRef.current = null;
      stationsRef.current = null;
    };
  }, []);

  // Swap basemap tiles when the style toggle changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !basemapRef.current) return;
    basemapRef.current.remove();
    basemapRef.current = L.tileLayer(BASEMAPS[mapStyle].url, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);
    basemapRef.current.bringToBack();
  }, [mapStyle]);

  // Sync route polylines.
  useEffect(() => {
    const lg = routesRef.current;
    if (!lg) return;
    lg.clearLayers();
    if (!routePaths) return;
    const seen = new Set<string>();
    for (const r of routePaths) {
      for (const pts of r.latlngs) {
        const key = `${r.agency}:${r.routeId}:${pts[0][0].toFixed(3)}:${pts[0][1].toFixed(3)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const active = r.routeId && activeRoute === `${r.agency}:${r.routeId}`;
        const poly = L.polyline(pts, {
          color: active ? "#ffffff" : `#${r.color.replace("#", "")}`,
          weight: active ? 4 : 2,
          opacity: active ? 0.95 : 0.4,
        });
        poly.on("click", (e) => {
          const map = mapRef.current;
          if (map) {
            L.popup({ className: "tm-popup", closeButton: false })
              .setLatLng(e.latlng)
              .setContent(`<div class="tm-pop"><div class="tm-pop-title" style="color:${r.color}">${escapeHtml(routeName(r))}</div><div class="tm-pop-status">Click to focus this line</div></div>`)
              .openOn(map);
          }
          onClickRouteRef.current(r.agency, r.routeId);
        });
        poly.addTo(lg);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routePaths, activeRoute]);

  // Station labels. Two modes:
  //  - showAllStations: label every subway & Metro-North station (grouped by line color).
  //  - otherwise: label the stations along the selected train's line; hidden if none selected.
  useEffect(() => {
    const lg = stationsRef.current;
    if (!lg) return;
    lg.clearLayers();

    const addOne = (agency: string, stopKey: string, color: string, agencyName: string) => {
      const s = stopInfo(agency, stopKey);
      if (!s) return;
      const icon = L.divIcon({
        className: "",
        html: `<div class="station-label" style="--st-color:${color}"><span class="sl-dot"></span><span class="sl-name">${escapeHtml(s.name)}</span></div>`,
        iconSize: L.point(0, 0),
        iconAnchor: L.point(6, 6),
      });
      const m = L.marker([s.lat, s.lon], { icon, keyboard: false }).bindPopup(`<div class="tm-pop"><div class="tm-pop-title">${escapeHtml(s.name)}</div><div class="tm-pop-status">${agencyName} station</div></div>`, { className: "tm-popup", closeButton: false });
      m.addTo(lg);
    };

    if (showAllStations) {
      for (const agency of ["subway", "mnr"] as const) {
        const data = STATIC[agency];
        const agencyName = agency === "subway" ? "Subway" : "Metro-North";
        const seen = new Set<string>();
        for (const [sid, s] of Object.entries(data.stops)) {
          // Skip duplicate platform entries that share a station name.
          const key = `${s.name.toUpperCase()}|${s.lat.toFixed(3)}|${s.lon.toFixed(3)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          addOne(agency, sid, agency === "subway" ? "#ee352e" : "#0039a6", agencyName);
        }
      }
      return;
    }

    if (!selectedId) return;
    const sel = trains.find((t) => t.id === selectedId);
    if (!sel) return;
    if (sel.agency !== "subway" && sel.agency !== "mnr") return;
    const ids = routeStops(sel.agency, sel.routeId);
    const color = sel.routeColor || "#4ecdc4";
    for (const sid of ids) addOne(sel.agency, sid, color, sel.agency === "subway" ? "Subway" : "Metro-North");
  }, [trains, selectedId, showAllStations]);

  // Sync markers with trains.
  useEffect(() => {
    const lg = markersRef.current;
    if (!lg) return;
    lg.clearLayers();
    for (const t of trains) {
      const icon = L.divIcon({
        className: "",
        html: markerHtml(t),
        iconSize: L.point(t.agency === "subway" ? 30 : 26, t.agency === "subway" ? 30 : 26),
        iconAnchor: L.point(15, 15),
        popupAnchor: L.point(0, -16),
      });
      const mar = L.marker([t.lat, t.lon], { icon, title: t.headingLabel })
        .bindPopup(popupHtml(t), { className: "tm-popup", closeButton: false });
      mar.on("click", () => onSelectRef.current(t.id));
      mar.addTo(lg);
      if (t.id === selectedId) {
        L.circleMarker([t.lat, t.lon], { radius: 15, color: "#4ecdc4", weight: 2, fillColor: "transparent" }).addTo(lg);
      }
    }
  }, [trains, selectedId]);

  useEffect(() => {
    if (onMapInstance) {
      onMapInstance({
        flyToTrain: (t) => {
          const map = mapRef.current;
          if (!map) return;
          map.flyTo([t.lat, t.lon], Math.max(map.getZoom(), 14), { duration: 1.2 });
        },
        flyToRoute: (d) => {
          const map = mapRef.current;
          if (!map || !d.latlngs.length) return;
          map.flyToBounds(L.latLngBounds(d.latlngs.flat()), { duration: 1.2, padding: [40, 40] });
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <button
        onClick={() => setMapStyle((s) => (s === "dark" ? "light" : "dark"))}
        className="absolute right-4 top-4 z-[520] flex items-center gap-1.5 rounded-lg border border-edge bg-panel px-3 py-1.5 text-[11px] font-semibold shadow-lg backdrop-blur transition-colors hover:border-accent/60"
        title={`Switch to ${mapStyle === "dark" ? "light" : "dark"} basemap`}
      >
        {mapStyle === "dark" ? <Sun className="h-3.5 w-3.5 text-accent" /> : <Moon className="h-3.5 w-3.5 text-accent" />}
        {BASEMAPS[mapStyle].label}
      </button>
    </div>
  );
}

function routeName(r: RoutePathData): string {
  return `${r.agency === "subway" ? r.routeId : r.agency === "lirr" ? "LIRR" : "Metro-North"} · ${r.routeId}`;
}
