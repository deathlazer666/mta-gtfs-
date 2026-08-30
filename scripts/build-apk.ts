// Lightweight APK build: wraps dist/ in a minimal WebView activity.
// Uses the Android build-tools + platform jar cached in /tmp/android-build.
//
//   bun scripts/build-apk.ts            # -> desk/mta-live-<version>.apk
//
// Requires: dist/ built (bun run build), JDK + Android build-tools present.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, cpSync, rmSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ANDROID = "/tmp/android-build";
const BT = join(ANDROID, "android-14"); // build-tools (aapt2, d8, zipalign, apksigner)
const PLATFORM_JAR = join(ANDROID, "android-34", "android.jar");
const JDK = join(ANDROID, "jdk-17.0.20.1+1");

const pkg = JSON.parse(await Bun.file(join(ROOT, "package.json")).text());
const VERSION = pkg.version ?? "0.0.0";
const VERSION_CODE = String(Math.round(parseFloat(VERSION) * 100)); // 0.1.12 -> 112

const WORK = join(ROOT, "desk", "apk-build");
const OUT = join(ROOT, "desk", `mta-live-${VERSION}.apk`);

// d8/apksigner are shell wrappers that call `java`; make sure the cached JDK is on PATH.
const env = { ...process.env, PATH: `${join(JDK, "bin")}:${process.env.PATH ?? ""}`, JAVA_HOME: JDK };

for (const p of [join(BT, "aapt2"), join(JDK, "bin", "javac"), PLATFORM_JAR]) {
  if (!existsSync(p)) {
    console.error(`Missing tool: ${p}`);
    process.exit(1);
  }
}
if (!existsSync(join(ROOT, "dist", "index.html"))) {
  console.error("dist/ missing — run `bun run build` first.");
  process.exit(1);
}

rmSync(WORK, { recursive: true, force: true });
for (const d of ["obj", "bin", "res", "www", "dex"]) mkdirSync(join(WORK, d), { recursive: true });

// 1. Web assets -> www/
cpSync(join(ROOT, "dist"), join(WORK, "www"), { recursive: true });

// 2. Compile resources
const manifest = join(ROOT, "android", "AndroidManifest.xml");
const rjava = join(WORK, "obj");
let r = spawnSync(join(BT, "aapt2"), ["compile", "--dir", join(ROOT, "android", "res") || ".", "-o", join(WORK, "res.zip")], { stdio: "inherit", env });
// No res dir: skip compile, link with --no-res? We need manifest only.
if (!existsSync(join(ROOT, "android", "res"))) {
  console.log("No res dir — linking manifest-only APK");
  r = spawnSync(join(BT, "aapt2"), [
    "link", "-o", join(WORK, "bin", "base.apk"),
    "--manifest", manifest,
    "-I", PLATFORM_JAR,
    "--java", rjava,
    "--auto-add-overlay",
  ], { stdio: "inherit", env });
} else {
  r = spawnSync(join(BT, "aapt2"), ["compile", "--dir", join(ROOT, "android", "res"), "-o", join(WORK, "res.zip")], { stdio: "inherit", env });
  if (r.status !== 0) process.exit(1);
  r = spawnSync(join(BT, "aapt2"), [
    "link", "-o", join(WORK, "bin", "base.apk"),
    "--manifest", manifest,
    "-I", PLATFORM_JAR,
    "--java", rjava,
    join(WORK, "res.zip"),
  ], { stdio: "inherit", env });
}
if (r.status !== 0) process.exit(1);

// 3. Compile java -> dex
const srcs = readdirSync(join(ROOT, "android", "src"), { recursive: true })
  .filter((f) => String(f).endsWith(".java"))
  .map((f) => join(ROOT, "android", "src", String(f)));
r = spawnSync(join(JDK, "bin", "javac"), [
  "--release", "11",
  "-encoding", "UTF-8",
  "-classpath", PLATFORM_JAR,
  "-d", join(WORK, "obj"),
  ...srcs,
], { stdio: "inherit", env });
if (r.status !== 0) process.exit(1);

r = spawnSync(join(BT, "d8"), [
  "--release",
  "--lib", PLATFORM_JAR,
  "--output", join(WORK, "dex"),
  ...(readdirSync(join(WORK, "obj"), { recursive: true })
    .filter((f) => String(f).endsWith(".class"))
    .map((f) => join(WORK, "obj", String(f)))),
], { stdio: "inherit", env });
if (r.status !== 0) process.exit(1);

// 4. Add dex + assets to APK
cpSync(join(WORK, "dex", "classes.dex"), join(WORK, "classes.dex"));
r = spawnSync(join(BT, "aapt"), ["add", join(WORK, "bin", "base.apk"), "classes.dex"], { cwd: WORK, stdio: "inherit", env });
if (r.status !== 0) process.exit(1);

// add www assets (aapt add needs forward-slash relative paths)
const wwwFiles: string[] = [];
(function walk(dir: string, rel: string) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const r2 = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(join(dir, e.name), r2);
    else wwwFiles.push(r2);
  }
})(join(WORK, "www"), "");
console.log(`Adding ${wwwFiles.length} web assets...`);
for (const f of wwwFiles) {
  const dest = join(WORK, "assets", f);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(join(WORK, "www", f), dest);
}
// aapt add assets: must run from WORK with paths assets/...
r = spawnSync(join(BT, "aapt"), ["add", join(WORK, "bin", "base.apk"), ...wwwFiles.map((f) => `assets/${f}`)], { cwd: WORK, stdio: "ignore", env });
if (r.status !== 0) { console.error("aapt add assets failed"); process.exit(1); }

// 5. Align + sign (debug key auto-generated)
r = spawnSync(join(BT, "zipalign"), ["-f", "4", join(WORK, "bin", "base.apk"), join(WORK, "bin", "aligned.apk")], { stdio: "inherit", env });
if (r.status !== 0) process.exit(1);

const keystore = join(WORK, "debug.keystore");
if (!existsSync(keystore)) {
  r = spawnSync(join(JDK, "bin", "keytool"), [
    "-genkeypair", "-keystore", keystore,
    "-storepass", "android", "-keypass", "android",
    "-alias", "androiddebugkey", "-keyalg", "RSA", "-keysize", "2048",
    "-validity", "10000", "-dname", "CN=MTA Live Debug,O=MTA Live,C=US",
  ], { stdio: "inherit", env });
  if (r.status !== 0) process.exit(1);
}
r = spawnSync(join(BT, "apksigner"), [
  "sign", "--ks", keystore, "--ks-pass", "pass:android",
  "--key-pass", "pass:android", "--out", OUT,
  join(WORK, "bin", "aligned.apk"),
], { stdio: "inherit", env });
if (r.status !== 0) process.exit(1);

console.log(`\nAPK built: ${OUT}`);
