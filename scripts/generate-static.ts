// Generates compact static data files from the MTA's supplemented GTFS feeds:
// stops, routes, headsigns (LIRR), and simplified route polylines (paths) per route
// so the map can render clickable line paths for every agency.
// Run with: bun scripts/generate-static.ts

import { mkdir, writeFile } from "node:fs/promises";
import { unzipSync } from "fflate";

const OUT = new URL("../src/data/", import.meta.url);
const SRCS = {
  subway: "https://rrgtfsfeeds.s3.amazonaws.com/gtfs_supplemented.zip",
  lirr: "https://rrgtfsfeeds.s3.amazonaws.com/gtfslirr.zip",
  mnr: "https://rrgtfsfeeds.s3.amazonaws.com/gtfsmnr.zip",
};

function parseCSV(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cols = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
        else cur += c;
      } else if (c === '"') inQ = true;
      else if (c === ",") { cols.push(cur); cur = ""; }
      else cur += c;
    }
    cols.push(cur);
    rows.push(cols);
  }
  return rows;
}

async function download(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

function headerToRow(rows) {
  const header = rows[0].map((h) => h.replace(/"|:$/g, "").trim());
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] || "").trim()])));
}

function parseTxt(files, f) {
  return headerToRow(parseCSV(new TextDecoder().decode(files[f])));
}

// Douglas-Peucker polyline simplification (lat/lon as [lat, lon]).
function perpDist(p, a, b) {
  const [px, py] = p; const [ax, ay] = a; const [bx, by] = b;
  const dx = bx - ax, dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function simplify(points, tol) {
  if (points.length < 3) return points;
  // find point with max distance
  let maxD = -1, idx = 0;
  const first = points[0], last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], first, last);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > tol) {
    const left = simplify(points.slice(0, idx + 1), tol);
    const right = simplify(points.slice(idx), tol);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

function build(name, buffer) {
  const files = unzipSync(buffer);
  const result = { stops: {}, routes: {}, headsigns: {}, paths: {}, routeStops: {} };

  const stops = parseTxt(files, "stops.txt");
  const parentNames = {};
  for (const s of stops) if (s.location_type === "1" && s.parent_station === "") parentNames[s.stop_id] = s.stop_name;
  for (const s of stops) result.stops[s.stop_id] = { name: parentNames[s.parent_station || ""] || s.stop_name, lat: Number(s.stop_lat), lon: Number(s.stop_lon) };

  const routes = parseTxt(files, "routes.txt");
  for (const r of routes) {
    result.routes[r.route_id] = {
      color: r.route_color || "0039a6",
      text: r.route_text_color || "ffffff",
      short: r.route_short_name || "",
      long: r.route_long_name || "",
    };
  }

  if (name === "lirr") {
    const trips = parseTxt(files, "trips.txt");
    for (const t of trips) { if (t.trip_headsign) result.headsigns[t.trip_id] = t.trip_headsign; }
  }

  // route -> station stop_ids served by that route (from trips + stop_times),
  // normalized to station level (strip direction suffix on subway platforms).
  if (files["trips.txt"] && files["stop_times.txt"]) {
    const tripRoute = {};
    const stripDir = (id) => (name === "subway" ? id.replace(/[NS]$/, "") : id);
    let hOffset = 0;
    // trips.txt: header then trip_id -> route_id.
    const tripsText = new TextDecoder().decode(files["trips.txt"]);
    {
      let first = true;
      let ti = 0, ri = 0;
      for (const l of tripsText.split(/\r?\n/)) {
        if (!l.trim()) continue;
        const cells = parseCSV(l)[0];
        if (first) { ti = cells.map((h) => h.replace(/"|:$/g, "").trim()).indexOf("trip_id"); ri = cells.map((h) => h.replace(/"|:$/g, "").trim()).indexOf("route_id"); first = false; continue; }
        if (cells[ti] && cells[ri]) tripRoute[cells[ti]] = cells[ri];
      }
    }
    hOffset = 0;
    // stop_times.txt: stream and collect station ids per route.
    const stopText = new TextDecoder().decode(files["stop_times.txt"]);
    {
      let first = true;
      let stIdx = 0, ssIdx = 0;
      const routeStops = {};
      for (const l of stopText.split(/\r?\n/)) {
        if (!l.trim()) continue;
        const cells = parseCSV(l)[0];
        if (first) {
          const h = cells.map((x) => x.replace(/"|:$/g, "").trim());
          stIdx = h.indexOf("trip_id"); ssIdx = h.indexOf("stop_id");
          first = false; continue;
        }
        const rid = tripRoute[cells[stIdx]];
        if (!rid || !cells[ssIdx]) continue;
        const sid = stripDir(cells[ssIdx]);
        if (!routeStops[rid]) routeStops[rid] = new Set();
        const key = result.stops[sid] ? sid : (result.stops[cells[ssIdx]] ? cells[ssIdx] : null);
        if (key) routeStops[rid].add(key);
      }
      result.routeStops = {};
      for (const [rid, set] of Object.entries(routeStops)) result.routeStops[rid] = [...set];
    }
    void hOffset;
  }

  // Build route paths from shapes.txt (dedupe shapes, simplify to keep the bundle small).
  if (files["shapes.txt"]) {
    const shapePts = new Map();
    for (const s of parseTxt(files, "shapes.txt")) {
      if (!shapePts.has(s.shape_id)) shapePts.set(s.shape_id, []);
      shapePts.get(s.shape_id).push([Number(s.shape_pt_lat), Number(s.shape_pt_lon)]);
    }
    // shapes.txt is already ordered by shape_pt_sequence; no sort needed.
    // route -> set of shape_ids (from trips)
    const routeShapes = new Map();
    if (files["trips.txt"]) {
      for (const t of parseTxt(files, "trips.txt")) {
        if (!t.shape_id) continue;
        if (!routeShapes.has(t.route_id)) routeShapes.set(t.route_id, new Set());
        routeShapes.get(t.route_id).add(t.shape_id);
      }
    }
    const dedupe = new Set();
    const tol = name === "subway" ? 0.0009 : 0.0018; // degrees (~100m / ~200m)
    for (const [routeId, shapes] of routeShapes) {
      const paths = [];
      for (const sid of shapes) {
        const raw = shapePts.get(sid) || [];
        if (raw.length < 2) continue;
        const clean = raw.map((p) => [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5]);
        const key = clean.map((p) => p.join(",")).join(";");
        if (dedupe.has(key)) continue;
        dedupe.add(key);
        const simp = simplify(clean, tol).map((p) => [p[0] * 1e5, p[1] * 1e5]).flat();
        paths.push(simp); // flat array of lat1e5,lon1e5 pairs
      }
      if (paths.length) result.paths[routeId] = paths;
    }
  }

  const hsKey = Object.keys(result.headsigns).length;
  const pathKey = Object.keys(result.paths).length;
  const rsKey = Object.keys(result.routeStops).length;
  console.log(`   ${name}: ${Object.keys(result.stops).length} stops, ${Object.keys(result.routes).length} routes, ${hsKey} headsigns, ${pathKey} routes w/ paths, ${rsKey} routes w/ stop lists`);
  return result;
}

for (const [name, url] of Object.entries(SRCS)) {
  console.log(`Downloading ${name}...`);
  try {
    const buf = await download(url);
    const data = build(name, buf);
    await mkdir(OUT, { recursive: true });
    await writeFile(new URL(`./${name}.json`, OUT), JSON.stringify(data));
    console.log(`   wrote src/data/${name}.json`);
  } catch (e) {
    console.error(`   FAILED ${name}: ${e.message}`);
  }
}

console.log("Done.");