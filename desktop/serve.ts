// Desktop entrypoint. Compiled with `bun build --compile --asset ./dist` so the entire
// static build is embedded. On launch it serves the app on localhost and opens the browser.
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

// Locate the embedded (or on-disk) dist directory.
// - In a compiled executable, `--asset ./dist` places files under import.meta.dir/dist.
// - Running via `bun run`, fall back to <project root>/dist.
function findDist(): string {
  const candidates = [join(import.meta.dir, "dist"), join(process.cwd(), "dist")];
  for (const dir of candidates) if (existsSync(dir)) return dir;
  return candidates[0];
}

const distDir = findDist();

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

function resolve(pathname: string): string {
  const rel = decodeURIComponent(pathname).replace(/^\/+/, "");
  if (rel === "" || !rel.includes(".")) return join(distDir, "index.html");
  return join(distDir, rel);
}

function openUrl(url: string) {
  const plat = process.platform;
  try {
    if (plat === "win32") spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true, windowsHide: true }).unref();
    else if (plat === "darwin") spawn("open", [url], { stdio: "ignore", detached: true }).unref();
    else {
      for (const b of ["xdg-open", "gio", "gvfs-open"]) {
        if (spawnSync("which", [b]).status === 0) {
          spawn(b, [url], { stdio: "ignore", detached: true }).unref();
          return;
        }
      }
    }
  } catch {
    /* ignore */
  }
}

const port = Number(process.env.PORT) || 4317;
const started = Date.now();

const server = Bun.serve({
  port,
  hostname: "127.0.0.1",
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/__health") {
      return Response.json({ ok: true, up: Date.now() - started, version: "1.0.0" });
    }
    const filePath = resolve(url.pathname);
    if (!filePath.startsWith(distDir)) return new Response("Not found", { status: 404 });
    const s = existsSync(filePath) ? statSync(filePath) : null;
    if (s && s.isDirectory()) return serveFile(join(filePath, "index.html"));
    return serveFile(filePath);
  },
});

const url = `http://127.0.0.1:${server.port}/`;
console.log("");
console.log("  ┌────────────────────────────────────────────┐");
console.log("  │  MTA Live — Subway · Metro-North · LIRR   │");
console.log("  └────────────────────────────────────────────┘");
console.log(`  Serving:  ${url}`);
console.log("  Close this window (or Ctrl+C) to stop the app.\n");

setTimeout(() => openUrl(url), 250);

export default server;