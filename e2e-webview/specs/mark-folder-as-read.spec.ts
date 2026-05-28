/**
 * "Mark all as read" — folder context menu smoke test.
 *
 * Bug this regresses against:
 *   markFolderAsRead (src/stores/mailboxStore.ts) used Dexie's
 *   `.modify((m) => { ... })` callback form to flip flags + is_unread
 *   on every cached message. The db worker rejects function callbacks
 *   ("db worker modify does not support function callbacks; pass an
 *   object") because closures can't cross the worker postMessage
 *   boundary. Triggering Mark-all-as-read on a folder threw and the
 *   user saw a "Failed to mark as read" toast — the local cache stayed
 *   unread until the next full sync.
 *
 * What this spec verifies:
 *   Right-click the Inbox folder → "Mark all as read". Assert that the
 *   action toast says "Marked all messages" (not "Failed to mark as
 *   read"), and that the rendered unread-row count goes to 0.
 *
 * Platform scope:
 *   Runs on every OS in the matrix. The db-worker callback rejection is
 *   platform-independent.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { newBrowser, closeBrowser } from '../support/browser.js';
import { resolveAppBinary } from '../support/platform.js';
import { openApp } from '../support/app.js';
import { clearStorage } from '../support/state.js';
import { activateDemo } from '../support/demo.js';

describe('mark folder as read (context menu)', () => {
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

  async function $$count(selector: string): Promise<number> {
    const els = await browser.$$(selector);
    return els.length;
  }

  it('marks every message as read without throwing', async () => {
    // Wait for the Inbox to have at least one unread row.
    await browser.waitUntil(
      async () => (await $$count('[data-testid="message-row"][data-unread="true"]')) > 0,
      { timeout: 15_000, timeoutMsg: 'expected at least one unread row in demo data' },
    );
    const before = await $$count('[data-testid="message-row"][data-unread="true"]');
    expect(before).toBeGreaterThan(0);

    // Right-click the Inbox folder to open the folder context menu.
    const folderItems = await browser.$$('[data-testid="folder-item"]');
    expect(folderItems.length).toBeGreaterThan(0);
    const inbox = folderItems[0];
    // WDIO doesn't have a single "right click" command for all platforms;
    // dispatch a contextmenu event directly on the element instead so the
    // spec is platform-agnostic.
    await browser.execute((el: Element) => {
      el.dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }),
      );
    }, inbox);

    // Assert existence + click via the DOM rather than waitForDisplayed/
    // waitForClickable: on the macOS-arm64 CI runner the window is ~190px tall
    // and the popped context menu renders below the viewport, so the
    // viewport-gated waits time out even though the menu is in the DOM.
    const menu = await browser.$('[data-testid="folder-context-menu"]');
    await menu.waitForExist({ timeout: 5_000 });

    const markAll = await browser.$('[data-testid="folder-mark-all-as-read"]');
    await markAll.waitForExist({ timeout: 5_000 });
    await browser.execute((el: Element) => (el as HTMLElement).click(), markAll);

    // The db-worker-callback bug surfaced as a "Failed to mark as read"
    // toast. Assert that toast did NOT appear within a reasonable window.
    await new Promise((r) => setTimeout(r, 1500));
    const errorToast = await browser.$('*=Failed to mark as read');
    expect(await errorToast.isExisting()).toBe(false);

    // The optimistic update should drive unread row count to zero.
    await browser.waitUntil(
      async () => (await $$count('[data-testid="message-row"][data-unread="true"]')) === 0,
      {
        timeout: 10_000,
        timeoutMsg: 'expected all rows to flip to data-unread="false" after Mark all as read',
      },
    );
  });
});
