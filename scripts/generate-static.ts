// Generates compact static data files from the MTA's supplemented GTFS feeds:
// stop_id -> {name, lat, lon}, route_id -> {color, short, long}, and trip_id -> headsign (LIRR/MNR).
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
        if (c === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = false;
        } else cur += c;
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

function build(name, buffer, parse) {
  const files = unzipSync(buffer);
  const names = Object.keys(files).filter((n) => n.endsWith(".txt"));
  const read = (f) => new TextDecoder().decode(files[f]);
  const colIdx = (header, key) => header.findIndex((h) => h.trim() === key);
  const parseTxt = (f) => {
    const rows = parseCSV(read(f));
    return { header: rows[0].map((h) => h.replace(/"|:$/g, "").trim()), rows: rows.slice(1).map((r) => Object.fromEntries(r.map((v, i) => [rows[0].map((h) => h.replace(/"|:$/g, "").trim())[i], v.trim()]))) };
  };

  const result = { stops: {}, routes: {}, headsigns: {} };

  const stops = parseTxt("stops.txt");
  const byId = new Map();
  const parentNames = {};
  for (const s of stops.rows) {
    byId.set(s.stop_id, s);
    if (s.location_type === "1" && s.parent_station === "") parentNames[s.stop_id] = s.stop_name;
  }
  for (const s of stops.rows) {
    const name = parentNames[s.parent_station || ""] || s.stop_name;
    result.stops[s.stop_id] = { name, lat: Number(s.stop_lat), lon: Number(s.stop_lon) };
  }

  const routes = parseTxt("routes.txt");
  for (const r of routes.rows) {
    result.routes[r.route_id] = {
      color: r.route_color || "0039a6",
      text: r.route_text_color || "ffffff",
      short: r.route_short_name || "",
      long: r.route_long_name || "",
    };
  }

  // Realtime trip_ids only match static trips.txt for LIRR (e.g. GO201_26_6702).
  // Subway and MNR realtime trip_ids use a different scheme, so their destination
  // names come from the terminal stop instead — drop their headsigns to keep the
  // bundle small.
  if (name === "lirr") {
    const trips = parseTxt("trips.txt");
    let matched = 0;
    for (const t of trips.rows) {
      const hs = t.trip_headsign;
      if (hs) { result.headsigns[t.trip_id] = hs; matched++; }
    }
    console.log(`   ${name}: ${Object.keys(result.stops).length} stops, ${Object.keys(result.routes).length} routes, ${matched} headsigns`);
  } else {
    console.log(`   ${name}: ${Object.keys(result.stops).length} stops, ${Object.keys(result.routes).length} routes (headsigns omitted)`);
  }

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