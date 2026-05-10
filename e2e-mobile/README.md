# e2e-mobile

Android (and later iOS) E2E tests for the Tauri app, driven by **Vitest** + the [`webdriverio`](https://www.npmjs.com/package/webdriverio) client + [Appium 2](https://appium.io). Currently scheduled nightly + on `workflow_dispatch` — not on PR, since cold-start emulator boots are slow and intermittently flaky.

## How it differs from `e2e-webview/`

The desktop suite uses `tauri-plugin-webdriver` (a W3C server embedded in the app). On Android we use **Appium with the UiAutomator2 driver** instead, because:

- Tauri's docs explicitly call out mobile-via-Appium as the supported path.
- Android System WebView is already remote-debuggable; Appium's `webview` context switching gives us standard CSS selectors against the DOM with no plugin dependency on the app side.
- The Cargo `webdriver` feature is desktop-only and would not compile for Android targets anyway.

## Local prerequisites (Mac)

1. Java 17 (Temurin recommended).
2. Android SDK + NDK 27.0.12077973 (`ANDROID_HOME` set).
3. Rust target: `rustup target add x86_64-linux-android`.
4. An Android emulator booted (API 34, `google_apis`, `x86_64`).
5. Appium 2 + UiAutomator2 driver installed globally:
   ```sh
   npm install -g appium@^2
   appium driver install uiautomator2
   ```
6. Appium server running externally (`appium --port 4723 &`). Unlike the desktop harness, this suite does _not_ spawn Appium itself — most local dev already has Appium running, and CI starts it inside the emulator-runner action.

## Build the APK

From the repo root:

```sh
pnpm install
pnpm tauri android init
pnpm tauri android build --apk --debug --target x86_64
```

Output: `src-tauri/gen/android/app/build/outputs/apk/x86_64/debug/*.apk`.

## Run the tests

```sh
appium --port 4723 &
APK_PATH="$(realpath src-tauri/gen/android/app/build/outputs/apk/x86_64/debug/*-debug.apk)" \
  pnpm --dir e2e-mobile test
```

## Smoke spec internals

The smoke spec switches to the Tauri WebView context (`WEBVIEW_net.forwardemail.mail`) before any assertion. The switch uses **polling, not a fixed sleep** — on a cold emulator, the WebView context can take 10–30s to appear after `NATIVE_APP`, and a fixed sleep either times out for nothing or wastes the difference on every run.

Once switched, the assertions are the same as desktop: title is set, `__TAURI_INTERNALS__` is defined.

## CI

`.github/workflows/e2e-mobile-android.yml` runs nightly at 06:00 UTC plus `workflow_dispatch`. Single matrix row: API 34, `google_apis`, `x86_64`, Pixel 6 profile. Test step uses `continue-on-error: true` (informational) — release blocking is handled by the desktop release pipeline.
