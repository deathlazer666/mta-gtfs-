# MTA Live

A real-time map of the entire NYC MTA heavy-rail network — **NYC Subway**, **Metro-North Railroad** (MNR), and **Long Island Rail Road** (LIRR) — built directly on MTA's official public feeds. No API key required.

## Live features

- 🗺️ **Live train map** with a tracker for every moving train. Subway & Metro-North trains are positioned by interpolating between their predicted stops (their feeds carry no GPS); LIRR uses true vehicle GPS positions.
- 🚉 **Stop & destination names** from the MTA's **Supplemented GTFS** (updated hourly), so trains show readable station names and destination headsigns instead of opaque IDs.
- ⚠️ **Service Issues** panel, live from the MTA GTFS-RT alerts feed — delays, service changes, and advisories for all three agencies.
- 🚦 Click any train for its next stops + ETA, status, and speed; toggle agencies and hide layovers.

## How it works

- All feeds are fetched **client-side** and decoded with a small, self-contained GTFS-RT wire-format decoder (`src/lib/protobuf.ts`, `src/lib/gtfsrt.ts`) — no reverse-GEO / rounding issues, nothing server-side.
- **Real-time feeds** (GTFS-RT, refreshed every 15s):
  - Subway: `api-endpoint.mta.info …/nyct/gtfs` + `-ace -bdfm -g -jz -l -nqrw -si`
  - Rail: `…/lirr/gtfs-lirr`, `…/mnr/gtfs-mnr`
  - Alerts: `…/camsys/all-alerts`
- **Static GTFS** (stop names, route colors, LIRR headsigns) is condensed to compact JSON under `src/data/` by the script below.

## Scripts

```bash
bun install        # install deps
bun run dev        # dev server (0.0.0.0)
bun run build      # production build -> dist/
bun run typecheck  # tsc --noEmit
bun run generate:static
```

If the MTA updates its schedules, regenerate the static bundles:

```bash
bun scripts/generate-static.ts
```

Data & logos are © MTA; feeds are public and free to use without a key.

## Desktop executables

You can ship this as a no-install desktop app. `bun run build:desktop` bundles the
built site (and a copy of the Bun runtime) into standalone, self-contained
executables for Windows and Linux:

```bash
bun run build:desktop   # builds dist/, then compiles desk/mta-tracker.exe + desk/mta-tracker
```

Outputs land in `desk/`:

- `mta-tracker.exe` — Windows x64
- `mta-tracker` — Linux x64 (works on Arch, any glibc distro)

Each double-click / runs a tiny local server, opens your default browser to
`http://127.0.0.1:4317/`, and serves the whole app (including the live MTA
feeds) with no other dependencies. Close the window (or Ctrl+C) to stop. On
Linux run `chmod +x desk/mta-tracker && ./desk/mta-tracker`.

The launcher is `desktop/serve.ts`; it embeds everything via Bun's `--asset`
cross-compile (Windows build is done from any OS — see `scripts/build-desktop.ts`).