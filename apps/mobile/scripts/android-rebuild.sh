#!/usr/bin/env bash
# Чистая пересборка Android (pnpm install → prebuild → чистка кэшей сборки → run on device)
# Аргументы пробрасываются в expo run:android, например: --variant release
set -euo pipefail
MOBILE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT_DIR="$(cd "$MOBILE_DIR/../.." && pwd)"
LOG="$MOBILE_DIR/.expo/gradle.log"

echo "▶ pnpm install"
cd "$ROOT_DIR" && pnpm install

echo "▶ expo prebuild (app.json plugins, permissions)"
cd "$MOBILE_DIR" && npx expo prebuild --platform android --no-install

echo "▶ clean build caches"
# не gradlew clean: на New Architecture он падает на CMake/codegen, если .cxx уже нет
rm -rf "$MOBILE_DIR/android/app/build" \
       "$MOBILE_DIR/android/app/.cxx" \
       "$MOBILE_DIR/android/build" \
       "$MOBILE_DIR/android/.gradle"

echo "▶ expo run:android --device"
mkdir -p "$MOBILE_DIR/.expo"
cd "$MOBILE_DIR"
npx expo run:android --device "$@" 2>&1 | tee "$LOG" || {
  echo; echo "✖ Сборка упала. Уникальные ошибки:"
  grep -E "error:|e: |What went wrong" -A2 "$LOG" | grep -v '^--$' | sort -u | head -30
  exit 1
}
