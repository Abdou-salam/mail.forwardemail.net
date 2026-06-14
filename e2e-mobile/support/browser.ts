import { remote } from 'webdriverio';

type RemoteOptions = Parameters<typeof remote>[0];

let current: WebdriverIO.Browser | undefined;

export async function newBrowser(opts: RemoteOptions): Promise<WebdriverIO.Browser> {
  current = await remote(opts);
  return current;
}

export function currentBrowser(): WebdriverIO.Browser | undefined {
  return current;
}

export async function closeBrowser(): Promise<void> {
  if (!current) return;
  try {
    await current.deleteSession();
  } catch {
    // The session may already be dead (e.g. the UiAutomator2 instrumentation
    // crashed mid-test), so DELETE /session fails with UND_ERR_CLOSED. Teardown
    // is best-effort — never let it mask or compound the real test failure.
  } finally {
    current = undefined;
  }
}
