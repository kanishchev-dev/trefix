#!/usr/bin/env bash
# Чистая пересборка iOS после изменения patches/ (pnpm install → pod install → run on device)
set -euo pipefail
MOBILE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT_DIR="$(cd "$MOBILE_DIR/../.." && pwd)"

echo "▶ pnpm install"
cd "$ROOT_DIR" && pnpm install

echo "▶ expo prebuild (app.json plugins, permissions, background modes)"
cd "$MOBILE_DIR" && npx expo prebuild --platform ios --no-install

echo "▶ pod install"
cd "$MOBILE_DIR/ios" && pod install
JSI_REL="$(sed -n 's/.*:path: "\(.*expo-modules-jsi\/apple\)".*/\1/p' Podfile.lock | head -1)"
JSI_APPLE="$(cd "$MOBILE_DIR/ios" && cd "$JSI_REL" && pwd)"
echo "▶ check patch: $JSI_APPLE"
if grep -q "SWIFT_RETURNS_RETAINED RuntimeScheduler" "$JSI_APPLE/Sources/ExpoModulesJSI-Cxx/include/RuntimeScheduler.h" \
  || ! grep -q "swiftLanguageModes: \[.v5\]" "$JSI_APPLE/Package.swift"; then
  echo "✖ Патч expo-modules-jsi не применён"; exit 1
fi

echo "▶ clean DerivedData"
rm -rf ~/Library/Developer/Xcode/DerivedData/Trefix-*

echo "▶ expo run:ios --device"
cd "$MOBILE_DIR"
npx expo run:ios --device "$@" || {
  echo; echo "✖ Сборка упала. Уникальные ошибки:"
  grep -E "error:" .expo/xcodebuild.log | sort -u | head -20
  exit 1
}
