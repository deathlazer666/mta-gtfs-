// Builds self-contained desktop executables from the built static site.
// Prereq: `bun run build` produces dist/. Then this compiles Bun single-file
// executables for Windows (bun-windows-x64) and Linux (bun-linux-x64), embedding
// the entire dist/ tree so no install is needed.
import { mkdirSync, rmSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = new URL("../", import.meta.url).pathname;
const OUT = join(ROOT, "desk");
const DIST = join(ROOT, "dist");

const targets = [
  { target: "bun-windows-x64", outfile: join(OUT, "mta-tracker.exe") },
  { target: "bun-linux-x64", outfile: join(OUT, "mta-tracker") },
];

mkdirSync(OUT, { recursive: true });
rmSync(join(OUT), { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const t of targets) {
  console.log(`\nCompiling ${t.target} ...`);
  const res = spawnSync(
    "bun",
    [
      "build",
      join(ROOT, "desktop", "serve.ts"),
      "--compile",
      "--target", t.target,
      `--asset=${DIST}`,
      "--outfile", t.outfile,
      "--minify",
    ],
    { stdio: "inherit", cwd: ROOT },
  );
  if (res.status !== 0) {
    console.error(`Failed to compile ${t.target}`);
    process.exit(res.status ?? 1);
  }
}

// Write a README alongside the binaries.
const note = `# MTA Live — desktop build

Self-contained desktop executables for the MTA real-time tracker. No install or
runtime needed. Each serves the app locally and opens your default browser.

## Windows
  mta-tracker.exe   (x64) — double-click to run

## Linux (Arch / any glibc distro)
File managers rarely launch a bare executable on double-click, so use the installer:

  chmod +x ./install-linux.sh
  ./install-linux.sh <path-to-mta-tracker>     # e.g. ./install-linux.sh ./mta-tracker

This registers an "MTA Live" entry in your application menu (GNOME/KDE/XFCE),
which you can then launch by double-click or from the launcher.

Alternatively, run it directly from a terminal:

  ./mta-tracker

If the browser doesn't open automatically, read the log:
  tail -f ~/.local/share/mta-tracker/mta-tracker.log

Close the window (or Ctrl+C) to stop the app.
Data © MTA, used from its public feeds without a key.
`;
const { writeFileSync } = await import("node:fs");
writeFileSync(join(OUT, "README.md"), note);
// Ship the Linux installer too.
copyFileSync(join(ROOT, "desktop", "install-linux.sh"), join(OUT, "install-linux.sh"));
console.log(`\nWrote executables + README + install-linux.sh to ${OUT}`);
for (const t of targets) console.log("  -", t.outfile.replace(ROOT, "./"));
console.log("  -", "install-linux.sh");