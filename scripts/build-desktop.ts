// Builds self-contained desktop executables from the built static site.
// Prereq: `bun run build` produces dist/. These use a pure-Node launcher packed with
// pkg (@yao-pkg/pkg), so there is no Bun runtime that can crash with "Illegal
// instruction" on CPUs lacking AVX2/SSE4.2 — runs on essentially any x86_64.
import { existsSync, mkdirSync, rmSync, copyFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = new URL("../", import.meta.url).pathname;
const OUT = join(ROOT, "desk");

mkdirSync(OUT, { recursive: true });
for (const f of ["mta-tracker", "mta-tracker.exe", "mta-tracker-node", "mta-tracker-node.exe"]) {
  rmSync(join(OUT, f), { force: true });
}

function run(cmd: string, args: string[], label: string) {
  console.log(`\n${label}`);
  const res = spawnSync(cmd, args, { stdio: "inherit", cwd: ROOT });
  if (res.status !== 0) {
    console.error(`Failed: ${label}`);
    process.exit(res.status ?? 1);
  }
}

run("bun", ["run", "build"], "Building static site (vite build)...");
run("npx", ["pkg", "desktop/serve-node.cjs", "-c", "pkg.config.json", "--targets", "node22-linux-x64,node22-win-x64"], "Compiling desktop executables (pkg)...");

// Normalize output names (pkg names them serve-node-linux / serve-node-win.exe).
const map: Record<string, string> = {
  "serve-node-linux": "mta-tracker",
  "serve-node-win.exe": "mta-tracker.exe",
};
for (const [from, to] of Object.entries(map)) {
  const src = join(OUT, from);
  if (existsSync(src)) copyFileSync(src, join(OUT, to));
}

// Ship the Linux installer too.
copyFileSync(join(ROOT, "desktop", "install-linux.sh"), join(OUT, "install-linux.sh"));

const note = `# MTA Live — desktop build

Self-contained desktop executables (Node-based launcher + embedded static site).
No install or runtime needed. Each serves the app locally and opens your
default browser. Runs on any x86_64 CPU — no AVX2/SSE4.2 requirement.

## Windows
  mta-tracker.exe   (x64) — double-click to run

## Linux (Arch / any glibc distro)
File managers rarely launch a bare executable on double-click, so use the installer:

  chmod +x ./install-linux.sh
  ./install-linux.sh ./mta-tracker

This registers an "MTA Live" entry in your application menu (GNOME/KDE/XFCE),
which you can launch by double-click or from the launcher. Or run directly:

  ./mta-tracker

If the browser doesn't open automatically, read the log:
  tail -f ~/.local/share/mta-tracker/mta-tracker.log

Close the window (or Ctrl+C) to stop the app.
Data © MTA, used from its public feeds without a key.
`;
writeFileSync(join(OUT, "README.md"), note);

console.log(`\nWrote executables + README + install-linux.sh to ${OUT}`);
for (const t of ["mta-tracker.exe", "mta-tracker", "install-linux.sh"]) console.log("  -", t);