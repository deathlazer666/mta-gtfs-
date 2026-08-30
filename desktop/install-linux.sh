#!/usr/bin/env bash
# Installs the MTA Live desktop app so it appears in the application menu and can
# be launched by double-click (GNOME, KDE, XFCE, etc.).
#
# Usage:
#   ./install-linux.sh            # installs desk/mta-tracker (or mta-tracker-linux-x64) for this user
#   ./install-linux.sh --uninstall
#
# Installs to ~/.local (no root needed): binary in ~/.local/bin,
# desktop entry in ~/.local/share/applications, icon in ~/.local/share/icons.
set -euo pipefail

SRC="${1:-}"
if [ -z "$SRC" ]; then
  if [ -f "$PWD/desk/mta-tracker" ]; then SRC="$PWD/desk/mta-tracker";
  elif [ -f "$PWD/mta-tracker" ]; then SRC="$PWD/mta-tracker";
  elif [ -f "$PWD/mta-tracker-linux-x64" ]; then SRC="$PWD/mta-tracker-linux-x64";
  else echo "Usage: ./install-linux.sh <path-to-mta-tracker-binary>"; exit 1; fi
fi
SRC="$(realpath "$SRC")"
if [ ! -x "$SRC" ]; then
  echo "Making binary executable: $SRC"
  chmod +x "$SRC"
fi

PREFIX="$HOME/.local"
BINDIR="$PREFIX/bin"
APPDIR="$PREFIX/share/applications"
ICONDIR="$PREFIX/share/icons/hicolor/scalable/apps"
DEST="$BINDIR/mta-tracker"

do_uninstall() {
  rm -f "$DEST" "$APPDIR/mta-tracker.desktop" "$ICONDIR/mta-tracker.svg"
  echo "Removed MTA Live. Rebuilding menu cache if available..."
  if command -v gtk-update-icon-cache >/dev/null 2>&1; then gtk-update-icon-cache -f "$PREFIX/share/icons/hicolor" 2>/dev/null || true; fi
  if command -v update-desktop-database >/dev/null 2>&1; then update-desktop-database "$APPDIR" 2>/dev/null || true; fi
  echo "Done."
  exit 0
}

if [ "${1:-}" = "--uninstall" ]; then do_uninstall; fi

mkdir -p "$BINDIR" "$APPDIR" "$ICONDIR"
cp -f "$SRC" "$DEST"
chmod +x "$DEST"

# Square transit icon (inline, no dependency on the repo's public/ dir).
cat > "$ICONDIR/mta-tracker.svg" <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#0b0f14"/>
  <rect x="6" y="6" width="52" height="34" rx="6" fill="#1c2733" stroke="#2f4a63" stroke-width="2"/>
  <circle cx="20" cy="23" r="9" fill="#ee352e"/>
  <text x="20" y="28" font-family="sans-serif" font-weight="bold" font-size="13" text-anchor="middle" fill="#fff">1</text>
  <circle cx="44" cy="23" r="7" fill="#0039a6"/><circle cx="44" cy="23" r="7" fill="none" stroke="#6cbe45" stroke-width="2"/>
  <circle cx="20" cy="52" r="6" fill="#00985f"/>
  <text x="20" y="56" font-family="sans-serif" font-weight="bold" font-size="9" text-anchor="middle" fill="#fff">L</text>
  <rect x="38" y="46" width="12" height="12" rx="3" fill="#6cbe45"/>
  <text x="44" y="56" font-family="sans-serif" font-weight="bold" font-size="9" text-anchor="middle" fill="#fff">M</text>
</svg>
EOF

cat > "$APPDIR/mta-tracker.desktop" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=MTA Live
GenericName=Train Tracker
Comment=Real-time map of NYC Subway, Metro-North & LIRR
Exec=$DEST
Icon=mta-tracker
Terminal=false
Categories=Utility;Geography;
StartupNotify=false
Keywords=mta;subway;train;transit;nyc;rail
EOF

echo "Installed MTA Live to:"
echo "  binary : $DEST"
echo "  menu   : $APPDIR/mta-tracker.desktop"
echo ""
echo "It should now appear in your application menu as 'MTA Live'."
echo "If it doesn't right away, refresh (KDE: 'kbuildsycoca5'; XFCE/XFCE4 restart; GNOME usually picks it up)."
echo ""
echo "Run it now? Then start it with:"
echo "  $DEST"
echo ""
echo "Logs (if the browser doesn't open):"
echo "  tail -f \$HOME/.local/share/mta-tracker/mta-tracker.log"

# Refresh caches so the menu entry appears immediately.
if command -v update-desktop-database >/dev/null 2>&1; then update-desktop-database "$APPDIR" 2>/dev/null || true; fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then gtk-update-icon-cache -f "$PREFIX/share/icons/hicolor" 2>/dev/null || true; fi
if [ -n "${XDG_RUNTIME_DIR:-}" ] && command -v ssh-askpass >/dev/null 2>&1; then :; fi