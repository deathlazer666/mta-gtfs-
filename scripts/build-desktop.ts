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

Single-file, self-contained desktop executable for the MTA real-time tracker.
No install or runtime needed — double-click to run. It serves the app locally and
opens your default browser.

## Windows
  mta-tracker.exe   (x64)

## Linux (Arch / any glibc distro)
  ./mta-tracker     (x64)

Close the small window (or Ctrl+C) to stop the app.
Data © MTA, used from its public feeds without a key.
`;
const { writeFileSync } = await import("node:fs");
writeFileSync(join(OUT, "README.md"), note);
console.log(`\nWrote executables + README to ${OUT}`);
for (const t of targets) console.log("  -", t.outfile.replace(ROOT, "./"));