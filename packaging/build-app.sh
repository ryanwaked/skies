#!/bin/bash
# Rebuild and install /Applications/Skies.app (menu-bar controller + icon).
# Prereqs: CLT swiftc, node + @playwright/test in frontend/ (icon render).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(dirname "$HERE")"
APP="/Applications/Skies.app"
TMP="$(mktemp -d)"

echo "-- render icon (the app icon IS the Skies favicon)"
# Rendering needs @playwright/test (+ its chromium) — an optional, heavy dev
# dep. When it's missing we keep the icon already in the bundle instead of
# failing the whole build; the icon only changes when the favicon does, so
# reusing it is almost always fine.
render_icon() {
  [ -f "$REPO/frontend/node_modules/@playwright/test/package.json" ] || return 1
  cd "$REPO/frontend"
  cat > "$TMP/render.mjs" <<'JS'
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
// Source: the frontend favicon, upscaled from its 180-box to a 1024 box.
const svg = readFileSync(process.argv[2], "utf8")
  .replace('width="180" height="180"', 'width="1024" height="1024"');
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1024, height: 1024 },
  colorScheme: "light", // favicon's default (blue→paper) sky gradient
});
await page.setContent(`<body style="margin:0;background:transparent">${svg}</body>`);
await page.locator("svg").screenshot({ path: process.argv[3], omitBackground: true });
await browser.close();
JS
  # stderr is silenced: a failure here is expected-and-handled (we fall back to
  # the installed icon), so the raw Node stack trace would only be noise.
  node "$TMP/render.mjs" "$REPO/frontend/public/favicon.svg" "$TMP/icon.png" 2>/dev/null || return 1
  mkdir "$TMP/Skies.iconset"
  for s in 16 32 128 256 512; do
    sips -z $s $s "$TMP/icon.png" --out "$TMP/Skies.iconset/icon_${s}x${s}.png" >/dev/null
    d=$((s*2)); sips -z $d $d "$TMP/icon.png" --out "$TMP/Skies.iconset/icon_${s}x${s}@2x.png" >/dev/null
  done
  iconutil -c icns "$TMP/Skies.iconset" -o "$TMP/Skies.icns"
}
if render_icon; then
  echo "   rendered a fresh icon from the favicon"
elif [ -f "$APP/Contents/Resources/Skies.icns" ]; then
  echo "   @playwright/test not installed — keeping the existing bundle icon"
  cp "$APP/Contents/Resources/Skies.icns" "$TMP/Skies.icns"
else
  echo "!! cannot render an icon and none is installed to reuse."
  echo "!! install the renderer once, then re-run:"
  echo "!!   (cd frontend && pnpm add -D @playwright/test && pnpm exec playwright install chromium)"
  exit 1
fi

echo "-- compile menu-bar controller (CLT swiftc; bypass broken swiftly toolchain)"
SDK="$(xcrun --sdk macosx --show-sdk-path)"
env -u TOOLCHAINS /Library/Developer/CommandLineTools/usr/bin/swiftc \
  -O -sdk "$SDK" -target arm64-apple-macosx14.0 \
  -o "$TMP/skies" "$HERE/skies.swift"

echo "-- assemble bundle"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$TMP/skies" "$APP/Contents/MacOS/skies"
cp "$TMP/Skies.icns" "$APP/Contents/Resources/Skies.icns"
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Skies</string>
  <key>CFBundleDisplayName</key><string>Skies</string>
  <key>CFBundleIdentifier</key><string>com.ryanwaked.skies</string>
  <key>CFBundleVersion</key><string>1.1.0</string>
  <key>CFBundleShortVersionString</key><string>1.1.0</string>
  <key>CFBundleExecutable</key><string>skies</string>
  <key>CFBundleIconFile</key><string>Skies</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>LSUIElement</key><true/>
</dict>
</plist>
PLIST
codesign --force --deep -s - "$APP"
touch "$APP"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP"
rm -rf "$TMP"
echo "done: $APP  (remember: app serves marimo/_static — run scripts/buildfrontend.sh after frontend changes)"
