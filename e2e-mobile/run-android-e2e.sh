#!/usr/bin/env bash
#
# Android e2e launcher for reactivecircus/android-emulator-runner.
#
# WHY THIS IS A FILE (and not an inline `script:` block):
# the emulator-runner action's parseScript() SPLITS the `script` input on
# newlines and runs EACH line in its own `sh -c` invocation. That makes
# multi-line shell constructs impossible (an `if ... then` line is parsed
# alone → "Syntax error: end of file unexpected (expecting fi)") and drops
# variables between lines ($APK_PATH wouldn't survive to the Appium launch).
# So the workflow invokes this whole file with a single `bash` command, which
# runs it as one coherent shell — restoring if/for, variable persistence, and
# `set -o pipefail` (bash, unlike the action's dash, supports it).
#
# Runs from the repo root (the action's cwd is GITHUB_WORKSPACE), so all paths
# below are relative to the repo root.
set -euo pipefail

APK_PATH="$(find src-tauri/gen/android/app/build/outputs/apk -name '*.apk' -path '*x86_64*' | head -n1)"
if [ -z "$APK_PATH" ]; then
  echo "::error::No APK found under src-tauri/gen/android/app/build/outputs/apk"
  exit 1
fi
APK_PATH="$(realpath "$APK_PATH")"
echo "Using APK: $APK_PATH"
export APK_PATH

appium --port 4723 > appium.log 2>&1 &
APPIUM_PID=$!
trap 'kill "$APPIUM_PID" 2>/dev/null || true' EXIT

# Wait for Appium to be ready (max 30s).
for _ in $(seq 1 30); do
  if curl -sf http://127.0.0.1:4723/status > /dev/null; then break; fi
  sleep 1
done

cd e2e-mobile
pnpm test
