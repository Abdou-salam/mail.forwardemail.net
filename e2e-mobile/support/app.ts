const TAURI_BUNDLE_ID = 'net.forwardemail.mail';

// On a freshly-launched Tauri Android app, getContexts() can return only
// ['NATIVE_APP'] for several seconds while the System WebView spins up. Poll
// instead of using a fixed sleep so we don't pay for the worst case every time.
export async function switchToTauriWebview(
  browser: WebdriverIO.Browser,
  timeoutMs = 30_000,
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const contexts = (await browser.getContexts()) as Array<string | { id: string }>;
    const found = contexts
      .map((c) => (typeof c === 'string' ? c : c.id))
      .find((c) => c.startsWith('WEBVIEW_') && c.includes(TAURI_BUNDLE_ID));
    if (found) {
      await browser.switchContext(found);
      return found;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `Tauri WebView context (WEBVIEW_${TAURI_BUNDLE_ID}) did not appear within ${timeoutMs}ms`,
  );
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
  throw new Error(`frontend did not finish loading inside the WebView (${timeoutMs}ms)`);
}

export async function isTauriWebview(browser: WebdriverIO.Browser): Promise<boolean> {
  return browser.execute(
    () =>
      typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !==
      'undefined',
  ) as Promise<boolean>;
}
