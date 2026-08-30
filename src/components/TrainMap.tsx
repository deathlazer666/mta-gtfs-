import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Train } from "../lib/types";

export interface MapImperative {
  flyToTrain: (t: Train) => void;
}

const NYC = [40.75, -73.985] as [number, number];

function badgeLabel(t: Train): string {
  if (t.agency === "subway") return t.routeShort.split(" ")[0]; // e.g. "N", "2", "SIR"
  return t.agency === "lirr" ? "L" : "M";
}

function markerHtml(t: Train): string {
  const size = t.agency === "subway" ? 30 : 26;
  const deg = t.bearing;
  return `<div class="train-marker" style="width:${size}px;height:${size}px">
    <div class="tm-arrow" style="transform:rotate(${deg}deg)"></div>
    <div class="tm-disc" style="background:${t.routeColor};color:${t.routeText}">
      <span>${badgeLabel(t)}</span>
    </div>
  </div>`;
}

function popupHtml(t: Train): string {
  const lines = (t.nextStops.slice(0, 4) || [])
    .map((s) => `<div class="tm-stop"><span class="tm-stop-min">${s.minutes}m</span><span class="tm-stop-name">${s.name}</span></div>`)
    .join("");
  return `<div class="tm-pop">
    <div class="tm-pop-head" style="background:${t.routeColor}">
      <span class="tm-pop-badge" style="color:${t.routeText}">${badgeLabel(t)}</span>
      <span class="tm-pop-label">${t.agency === "subway" ? "Subway" : t.agency === "lirr" ? "LIRR" : "Metro-North"}</span>
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
  onSelect,
  onMapInstance,
}: {
  trains: Train[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMapInstance?: (m: { flyToTrain: (t: Train) => void }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Init map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: NYC, zoom: 11, zoomControl: true, attributionControl: true });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);
    const lg = L.layerGroup().addTo(map);
    markersRef.current = lg;
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []);

  // Sync markers with trains.
  useEffect(() => {
    const map = mapRef.current;
    const lg = markersRef.current;
    if (!map || !lg) return;
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
        L.circleMarker([t.lat, t.lon], {
          radius: 15,
          color: "#4ecdc4",
          weight: 2,
          fillColor: "transparent",
          fillOpacity: 1,
        }).addTo(lg);
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
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="h-full w-full" />;
}