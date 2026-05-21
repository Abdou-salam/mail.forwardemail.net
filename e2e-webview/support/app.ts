// Tauri 2 serves the embedded frontend over a custom scheme. On Windows the
// default is http://tauri.localhost (https only when app.windows.useHttpsScheme
// is set in tauri.conf.json — we don't); macOS/Linux use tauri://localhost.
// Hitting https://tauri.localhost on Windows yields ERR_CONNECTION_REFUSED.
export function appUrl(): string {
  return process.platform === 'win32' ? 'http://tauri.localhost' : 'tauri://localhost';
}

export async function openApp(browser: WebdriverIO.Browser): Promise<void> {
  await browser.url(appUrl());
  await waitForFrontendReady(browser);
}

export async function waitForFrontendReady(
  browser: WebdriverIO.Browser,
  timeoutMs = 20_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ready = (await browser.execute(
      () => document.readyState === 'complete' && document.body?.children.length > 0,
    )) as boolean;
    if (ready) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`frontend did not finish loading within ${timeoutMs}ms`);
}

export async function isTauriWebview(browser: WebdriverIO.Browser): Promise<boolean> {
  return browser.execute(
    () =>
      typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !==
      'undefined',
  ) as Promise<boolean>;
}
