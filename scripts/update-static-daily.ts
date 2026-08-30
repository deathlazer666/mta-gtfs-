// Daily auto-refresh of the static GTFS supplemental data bundles.
//
// The MTA updates its supplemented GTFS bundles continuously (stop names,
// headsigns, route paths). This script re-runs the static generator and
// writes fresh JSON bundles into src/data/ if the source feeds changed.
//
// Modes:
//   bun scripts/update-static-daily.ts           # run once, then exit
//   bun scripts/update-static-daily.ts --watch   # keep running, re-run every 24h
//
// Desktop builds: the pkg launcher (desktop/serve-node.cjs) re-runs the
// updater every 24h against the snapshot's bundled generator when possible;
// otherwise the embedded src/data/ JSON from build time is used.

import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REFRESH_MS = 24 * 60 * 60 * 1000; // 24 hours
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "generate-static.ts");
const DATA_DIR = join(HERE, "..", "src", "data");
const STAMP_FILE = join(HERE, "..", ".gtfs-static-last-update");

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function lastRunMs() {
  try {
    return Number(readFileSync(STAMP_FILE, "utf8").trim());
  } catch {
    return 0;
  }
}

function stampNow() {
  try {
    writeFileSync(STAMP_FILE, String(Date.now()));
  } catch {
    // Read-only fs (e.g. pkg snapshot): stamping is best-effort only.
  }
}

function dataFilesPresent() {
  return ["subway.json", "lirr.json", "mnr.json"].every((f) =>
    existsSync(join(DATA_DIR, f)),
  );
}

export async function updateGtfsSupplemental({ force = false } = {}) {
  const last = lastRunMs();
  const elapsed = Date.now() - last;
  if (!force && last && elapsed < REFRESH_MS) {
    log(`Last update ${Math.round(elapsed / 60000)} min ago — skipping (24h window).`);
    return { skipped: true };
  }
  if (!force && !last && dataFilesPresent()) {
    // First run with bundled data present: treat build time as fresh enough,
    // stamp now so the next check happens 24h later.
    stampNow();
    log("Bundled data present — first-run stamp written, next update in 24h.");
    return { skipped: true };
  }

  log("Refreshing GTFS supplemental bundles...");
  // Run the generator with Bun directly (process.execPath may be node in pkg builds).
  const bunBin = process.env.BUN_INSTALL_BIN || "bun";
  const proc = spawn(bunBin, ["run", SCRIPT], {
    stdio: "inherit",
    env: process.env,
  });
  const code = await new Promise((resolve) => proc.on("close", resolve));
  if (code === 0) {
    stampNow();
    log("GTFS supplemental bundles refreshed.");
    return { skipped: false, ok: true };
  }
  log(`generate-static exited with code ${code} — keeping existing bundles.`);
  return { skipped: false, ok: false };
}

export function startDailyGtfsUpdater() {
  // Run once shortly after boot, then every 24h.
  const run = () => updateGtfsSupplemental().catch((e) => log(`update failed: ${e}`));
  setTimeout(run, 30_000);
  setInterval(run, REFRESH_MS);
  log("Daily GTFS supplemental updater scheduled (24h interval).");
}

// CLI entry: `bun scripts/update-static-daily.ts [--watch]`
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
if (isMain) {
  if (process.argv.includes("--watch")) {
    startDailyGtfsUpdater();
  } else {
    updateGtfsSupplemental({ force: true })
      .then((r) => process.exit(r.skipped ? 0 : r.ok ? 0 : 1))
      .catch((e) => {
        console.error(e);
        process.exit(1);
      });
  }
}
