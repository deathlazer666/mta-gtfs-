// Pure-Node desktop entrypoint (CommonJS). Bundled into a single executable with pkg
// so there is no Bun runtime that crashes with "Illegal instruction" on CPUs lacking
// AVX2/SSE4.2. Serves the embedded dist/ and opens the default browser.
"use strict";
const http = require("node:http");
const { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } = require("node:fs");
const { join, dirname, extname } = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const os = require("node:os");

const VERSION = "1.2.0";
const START = Date.now();

// Find dist: pkg embeds it under __dirname (snapshot fs); during dev runs fall back to repo root.
function findDist() {
  const cands = [join(__dirname, "dist"), join(process.cwd(), "dist"), join(dirname(__dirname), "dist")];
  for (const d of cands) if (existsSync(join(d, "index.html"))) return d;
  return cands[0];
}
const distDir = findDist();

// Logs to a user file so a double-click leaves a trace even without a terminal.
const logDir = join(os.homedir(), ".local", "share", "mta-tracker");
const logFile = join(logDir, "mta-tracker.log");
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  try { mkdirSync(logDir, { recursive: true }); writeFileSync(logFile, line + "\n", { flag: "a" }); } catch {}
  try { console.log(line); } catch {}
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
};

function binExists(bin) {
  try { return spawnSync("which", [bin], { stdio: "ignore" }).status === 0; } catch { return false; }
}

function trySpawn(bin, args, via) {
  const child = spawn(bin, args, { stdio: "ignore", detached: true });
  child.on("error", () => {});
  try { child.unref(); } catch {}
  log("Opened browser via " + via);
}

function openUrl(url) {
  try {
    if (process.platform === "win32") { trySpawn("cmd", ["/c", "start", "", url], "cmd start"); return; }
    if (process.platform === "darwin") { trySpawn("open", [url], "open"); return; }
    const runners = [
      ["xdg-open", [url]], ["gio", ["open", url]], ["gvfs-open", [url]],
      ["firefox", [url]], ["google-chrome", [url]], ["google-chrome-stable", [url]],
      ["chromium", [url]], ["chromium-browser", [url]], ["brave-browser", [url]],
      ["microsoft-edge-stable", [url]], ["epiphany", [url]], ["falkon", [url]],
    ];
    for (const [bin, args] of runners) if (binExists(bin)) { trySpawn(bin, args, bin); return; }
    log("No browser opener found — open manually: " + url);
  } catch (e) { log("Browser open failed: " + (e && e.message ? e.message : String(e))); }
}

function serve(fp, res) {
  try {
    const buf = readFileSync(fp);
    const headers = { "Content-Type": MIME[extname(fp)] || "application/octet-stream" };
    if (!fp.endsWith("index.html")) headers["Cache-Control"] = "max-age=3600";
    res.writeHead(200, headers);
    res.end(buf);
  } catch { res.writeHead(404); res.end("Not found"); }
}

function handler(req, res) {
  const u = new URL(req.url, "http://127.0.0.1");
  if (u.pathname === "/__health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, up: Date.now() - START, version: VERSION }));
    return;
  }
  let rel = decodeURIComponent(u.pathname).replace(/^\/+/, "");
  if (rel === "" || !rel.includes(".")) rel = "index.html";
  const file = join(distDir, rel);
  if (!file.startsWith(distDir)) { res.writeHead(404); res.end("Not found"); return; }
  try {
    const st = statSync(file);
    if (st.isDirectory()) { serve(join(file, "index.html"), res); return; }
  } catch { /* fall through */ }
  serve(file, res);
}

log(`Starting MTA Live ${VERSION}...`);
log(`Dist present: ${existsSync(join(distDir, "index.html"))}`);

const argPort = process.argv.slice(2).find((a) => /^--port=/.test(a)) && process.argv.slice(2).find((a) => /^--port=/.test(a)).split("=")[1];
const envPort = process.env["MTA_PORT"] || process.env["PORT"];
const req = parseInt(argPort || envPort || "", 10);
const wantPort = Number.isFinite(req) ? req : 0;

let announced = false;
function afterBind(srv) {
  if (announced) return;
  announced = true;
  const url = `http://127.0.0.1:${srv.address().port}/`;
  log("Serving: " + url);
  log("Open this URL in a browser if it doesn't open automatically.");
  setTimeout(() => openUrl(url), 300);
}

function makeServer(portVal) {
  const srv = http.createServer(handler);
  srv.on("error", (err) => {
    log("Bind error on " + portVal + ": " + err.message);
    // Retry once on OS-assigned port.
    const s2 = http.createServer(handler);
    s2.on("error", (e2) => log("Second bind failed: " + e2.message));
    s2.listen(0, "127.0.0.1", () => afterBind(s2));
  });
  srv.listen(portVal, "127.0.0.1", () => afterBind(srv));
}

// Try requested port (0 = auto). If a fixed port is given and taken, the error handler retries.
makeServer(wantPort);