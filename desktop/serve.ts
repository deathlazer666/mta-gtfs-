// Desktop entrypoint. Compiled with `bun build --compile --asset ./dist` so the entire
// static build is embedded. On launch it serves the app on localhost and opens the browser.
// Double-click friendly on Linux/Windows/macOS: writes a log file and picks a free port.
import { existsSync, readFileSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { homedir } from "node:os";

const VERSION = "1.1.0";
const START = Date.now();

// Locate the embedded (or on-disk) dist directory.
//  - In a compiled executable, `--asset ./dist` places files under import.meta.dir/dist.
//  - Running via `bun run`, fall back to <project root>/dist.
function findDist(): string {
  const candidates = [join(import.meta.dir, "dist"), join(process.cwd(), "dist"), import.meta.dir];
  for (const dir of candidates) if (existsSync(join(dir, "index.html"))) return dir;
  return candidates[0]!;
}

const distDir = findDist();

// Log to a per-user file so a double-click (no visible terminal) still leaves a trace.
const logFile = join(homedir(), ".local", "share", "mta-tracker", "mta-tracker.log");
function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}`;
  try {
    mkdirSync(join(homedir(), ".local", "share", "mta-tracker"), { recursive: true });
    writeFileSync(logFile, line + "\n", { flag: "a" });
  } catch {
    /* ignore */
  }
  console.log(line);
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
};

function contentType(p: string): string {
  const ext = p.slice(p.lastIndexOf(".")).toLowerCase();
  return MIME[ext] || "application/octet-stream";
}

function serveFile(filePath: string): Response {
  try {
    const buf = readFileSync(filePath);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": contentType(filePath),
        "Cache-Control": filePath.endsWith("index.html") ? "no-store" : "max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

function makeServer(port: number): ReturnType<typeof Bun.serve> {
  return Bun.serve({
    port,
    hostname: "127.0.0.1",
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/__health") return Response.json({ ok: true, up: Date.now() - START, version: VERSION });
      const filePath = resolve(url.pathname);
      if (!filePath.startsWith(distDir)) return new Response("Not found", { status: 404 });
      const s = existsSync(filePath) ? statSync(filePath) : null;
      if (s && s.isDirectory()) return serveFile(join(filePath, "index.html"));
      return serveFile(filePath);
    },
  });
}

function resolve(pathname: string): string {
  const rel = decodeURIComponent(pathname).replace(/^\/+/, "");
  if (rel === "" || !rel.includes(".")) return join(distDir, "index.html");
  return join(distDir, rel);
}

function binExists(bin: string): boolean {
  try {
    return spawnSync("which", [bin], { stdio: "ignore" }).status === 0;
  } catch {
    return false;
  }
}

function trySpawn(bin: string, args: string[], via: string): void {
  const child = spawn(bin, args, { stdio: "ignore", detached: true });
  child.on("error", () => {/* keep trying */});
  try { child.unref(); } catch { /* ignore */ }
  log("Opened browser via " + via);
}

// Open the URL in the default browser, probing common methods per OS.
function openUrl(url: string): void {
  try {
    if (process.platform === "win32") {
      trySpawn("cmd", ["/c", "start", "", url], "cmd start");
      return;
    }
    if (process.platform === "darwin") {
      trySpawn("open", [url], "open");
      return;
    }
    // Linux: desktop opener first, then direct browser binaries.
    const runners: [string, string[]][] = [
      ["xdg-open", [url]],
      ["gio", ["open", url]],
      ["gvfs-open", [url]],
      ["firefox", [url]],
      ["google-chrome", [url]],
      ["google-chrome-stable", [url]],
      ["chromium", [url]],
      ["chromium-browser", [url]],
      ["brave-browser", [url]],
      ["microsoft-edge-stable", [url]],
      ["epiphany", [url]],
      ["falkon", [url]],
    ];
    for (const [bin, args] of runners) {
      if (binExists(bin)) {
        trySpawn(bin, args, bin);
        return;
      }
    }
    log("No browser opener found — open manually: " + url);
  } catch (e) {
    log("Browser open failed: " + (e instanceof Error ? e.message : String(e)));
  }
}

log(`Starting MTA Live ${VERSION}...`);
log(`Dist present: ${existsSync(join(distDir, "index.html"))}`);

// Port resolution: --port=N or MTA_PORT/PORT env, default OS-assigned free port.
const argPort = process.argv.slice(2).find((a) => /^--port=/.test(a))?.split("=")[1];
const envPort = process.env["MTA_PORT"] || process.env["PORT"];
const requested = parseInt(argPort ?? envPort ?? "", 10);
const wantPort = Number.isFinite(requested) ? requested : 0;

let server: ReturnType<typeof Bun.serve>;
try {
  server = makeServer(wantPort);
} catch {
  if (wantPort) {
    log(`Port ${wantPort} busy — using a free port instead.`);
  }
  server = makeServer(0); // 0 => OS-assigned
}

const url = `http://127.0.0.1:${server.port}/`;
log("Serving: " + url);
log("Open this URL in a browser if it doesn't open automatically.");

setTimeout(() => openUrl(url), 400);

// Keep the process alive.
setInterval(() => {}, 1 << 30);

export default server;