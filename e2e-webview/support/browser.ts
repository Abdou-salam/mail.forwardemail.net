import { remote } from 'webdriverio';
import { execFile } from 'node:child_process';

type RemoteOptions = Parameters<typeof remote>[0];

let current: WebdriverIO.Browser | undefined;

/**
 * Windows-only safety net against native-dialog session poisoning.
 *
 * A spec that opens a native file/save dialog can't dismiss it through
 * WebDriver — `Escape` is delivered to the WebView, not the OS dialog — so on
 * Windows the app stays alive behind the modal with its in-app webdriver server
 * still bound to :4445. The next spec's `newBrowser` then fails with
 * "Plugin expected on port 4445" / "No window could be found", and every
 * subsequent spec cascades. Force-killing the app frees the port and tears down
 * the stuck dialog, so each spec gets a clean instance.
 *
 * No-op on macOS/Linux: they dismiss the dialog reliably, those CI rows don't
 * exhibit the cascade, and a name-based kill there could take out a developer's
 * `tauri dev` instance during a local run.
 */
async function forceKillApp(): Promise<void> {
  if (process.platform !== 'win32') return;
  await new Promise<void>((resolve) => {
    try {
      // /F force, /T kill the process tree. The e2e build is the debug binary
      // `forwardemail-desktop.exe` (see support/platform.ts).
      execFile('taskkill', ['/F', '/T', '/IM', 'forwardemail-desktop.exe'], () => resolve());
    } catch {
      resolve();
    }
  });
}

export async function newBrowser(opts: RemoteOptions): Promise<WebdriverIO.Browser> {
  // Reclaim any app a previous spec left running before launching a fresh one,
  // so a still-bound :4445 can't fail this session.
  await forceKillApp();
  current = await remote(opts);
  return current;
}

export function currentBrowser(): WebdriverIO.Browser | undefined {
  return current;
}

export async function closeBrowser(): Promise<void> {
  if (!current) return;
  const browser = current;
  current = undefined;
  // Bound deleteSession: a stuck native modal can make it hang. Attach a catch
  // so the eventual (post-kill) rejection isn't unhandled, then force-kill as
  // the real cleanup.
  const deleted = browser.deleteSession().catch(() => {});
  await Promise.race([deleted, new Promise<void>((resolve) => setTimeout(resolve, 8000))]);
  await forceKillApp();
}
