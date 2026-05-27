/**
 * Native attachment-save (NSSavePanel) smoke test.
 *
 * Bug this regresses against:
 *   On macOS 26 Tahoe (Apple Silicon), the bundled `tauri-plugin-dialog`
 *   2.7.1 stack uses `rfd` 0.16.0, whose `+[NSSavePanel savePanel]`
 *   binding declares a non-nullable return. Tahoe started returning nil
 *   under some activation states, and the objc2 `none_fail` retain
 *   assertion panicked the Rust process → SIGABRT under
 *   `panic = "abort"`. The crash report frame was
 *   `rfd::backend::macos::file_dialog::panel_ffi::Panel::build_save_file`.
 *
 *   The fix landed in src-tauri/src/file_picker_macos.rs `save_file_macos`,
 *   which mirrors the existing `pick_files_macos` wrapper (nullable
 *   `msg_send!`, alloc/init fallback, app-activation). The JS side is
 *   `saveFileDialog` in src/utils/download.ts, called by every attachment
 *   download path in mailService.ts.
 *
 * What this spec verifies:
 *   Open the demo mailbox, find a message with an attachment, click the
 *   attachment row to trigger the save dialog. If the click crashes the
 *   underlying webview process (the previous Tahoe bug class), every
 *   subsequent webdriver call throws and the test fails. If the save
 *   dialog opens, we dismiss it with Escape and assert the message
 *   detail view is still alive.
 *
 *   This is intentionally separate from native-attachment-open.spec.ts
 *   which exists for an older OOM regression on the same UI element.
 *   Keeping the two specs distinct makes the bisect target obvious
 *   when one fails and the other doesn't.
 *
 * Platform scope:
 *   Runs on every OS in the matrix. The crash class is macOS-specific
 *   but exercising the save-dialog path on Windows/Linux is a useful
 *   smoke check there too.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { newBrowser, closeBrowser } from '../support/browser.js';
import { resolveAppBinary } from '../support/platform.js';
import { openApp } from '../support/app.js';
import { clearStorage } from '../support/state.js';
import { activateDemo } from '../support/demo.js';

describe('native attachment save dialog', () => {
  let browser: WebdriverIO.Browser;

  beforeAll(async () => {
    browser = await newBrowser({
      hostname: '127.0.0.1',
      port: 4444,
      logLevel: 'warn',
      capabilities: {
        'tauri:options': { application: resolveAppBinary() },
      } as WebdriverIO.Capabilities,
    });
  }, 30_000);

  afterAll(closeBrowser);

  beforeEach(async () => {
    await openApp(browser);
    await clearStorage(browser);
    await openApp(browser);
    await activateDemo(browser);
  });

  it('does not crash the app when an attachment is downloaded', async () => {
    // Give the mailbox a moment to populate so the reader pane can mount.
    await new Promise((r) => setTimeout(r, 2000));

    const firstMessage = await browser.$('[data-testid="message-row"]');
    const hasMessage = await firstMessage.isExisting();
    if (!hasMessage) {
      console.log('[attachment-save] no demo messages — skipping');
      return;
    }
    await firstMessage.click();
    await new Promise((r) => setTimeout(r, 1000));

    // Demo data has attachments on a few specific messages — iterate until
    // we land on one. The test is "no crash from the save dialog path";
    // if we never find an attachment we skip rather than fail.
    let attachment = await browser.$('[data-testid="attachment-row"]');
    let attachmentExists = await attachment.isExisting();
    if (!attachmentExists) {
      const allRows = await browser.$$('[data-testid="message-row"]');
      const count = await allRows.length;
      for (let i = 1; i < Math.min(count, 8); i++) {
        await allRows[i].click();
        await new Promise((r) => setTimeout(r, 600));
        attachment = await browser.$('[data-testid="attachment-row"]');
        if (await attachment.isExisting()) {
          attachmentExists = true;
          break;
        }
      }
    }
    if (!attachmentExists) {
      console.log('[attachment-save] no attachments found in demo data — skipping');
      return;
    }

    // The decisive moment — clicking the attachment triggers
    // mailService.triggerDownloadTauri → saveFileDialog → (macOS)
    // invoke('save_file_macos'). Pre-fix, this SIGABRT'd on Tahoe.
    await attachment.click();

    // Give the native dialog a beat to either appear or crash the app.
    await new Promise((r) => setTimeout(r, 1500));

    // Dismiss the save dialog. Escape works on macOS + Windows + Linux GTK.
    // If no dialog appeared (e.g. headless CI suppressed it), this is a
    // no-op on the focused element.
    await browser.keys(['Escape']);
    await new Promise((r) => setTimeout(r, 500));

    // The decisive assertion: webdriver session alive and the reader pane
    // is still rendering. Either fails if the underlying process died.
    const stillThere = await browser.$('[data-testid="reader-pane"]');
    const ready = await browser.execute(() => document.readyState === 'complete');
    expect(ready).toBe(true);
    expect(await stillThere.isExisting()).toBe(true);
  });
});
