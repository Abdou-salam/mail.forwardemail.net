/**
 * Account switch — clears the viewed-email detail pane.
 *
 * Bug this regresses against:
 *   When switching from account A to account B, the message list and
 *   folder tree refreshed correctly but the reader pane kept rendering
 *   the previously viewed message body. Root cause was a body-loader
 *   subscription that didn't refire before the new selectedMessage was
 *   set, so messageBody/attachments stayed populated.
 *
 *   The fix lands a defensive clear inside Mailbox.svelte's
 *   currentAccount.subscribe handler (selectedMessage.set(null),
 *   messageBody.set(''), attachments.set([])).
 *
 * Why this spec is gated on multi-account support:
 *   Demo mode is single-account by design. There is no public test
 *   fixture today that boots the app with two registered accounts, so
 *   the UI's account-switcher menu in Mailbox.svelte cannot be
 *   exercised end-to-end. Until a multi-account demo seed lands, this
 *   spec skips gracefully so the file lights up automatically once the
 *   fixture exists. The same regression is caught at unit level by
 *   comprehensive-patch.test.js → "account switch clears the
 *   viewed-email state in the currentAccount subscriber".
 */

import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { newBrowser, closeBrowser } from '../support/browser.js';
import { resolveAppBinary } from '../support/platform.js';
import { openApp } from '../support/app.js';
import { clearStorage } from '../support/state.js';
import { activateDemo } from '../support/demo.js';

describe('account switch clears viewed-email pane', () => {
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
  }, 60_000);

  afterAll(closeBrowser);

  beforeEach(async () => {
    await openApp(browser);
    await clearStorage(browser);
    await openApp(browser);
    await activateDemo(browser);
  });

  it('clears the reader pane body when switching to another account', async () => {
    // Open a message so the reader pane has content to clear.
    async function rowCount(): Promise<number> {
      const els = await browser.$$('[data-testid="message-row"]');
      return els.length;
    }
    await browser.waitUntil(async () => (await rowCount()) > 0, { timeout: 15_000 });
    const firstRow = await browser.$('[data-testid="message-row"]');
    await firstRow.click();
    await new Promise((r) => setTimeout(r, 800));
    const reader = await browser.$('[data-testid="reader-pane"]');
    await reader.waitForDisplayed({ timeout: 10_000 });

    // Look for the account-switcher menu items. In demo mode only one
    // account exists, so the menu has nothing else to switch to. Skip
    // until a multi-account fixture is wired into the e2e bootstrap.
    const accountItems = await browser.$$('[data-testid="account-switcher-item"]');
    const itemCount = await accountItems.length;
    if (itemCount < 2) {
      console.log('[account-switch] only one account in demo mode — skipping (see file header)');
      return;
    }

    // Future-multi-account path: click the second account, then assert
    // the previously rendered message body is gone from the reader pane.
    // Intentionally minimal — the goal is "stale body is gone", not
    // "new account's first message rendered" (which a separate spec
    // would own).
    await accountItems[1].click();
    await browser.waitUntil(
      async () => {
        const body = await browser.$('[data-testid="message-body"]');
        const text = (await body.getText()).trim();
        return text === '';
      },
      {
        timeout: 10_000,
        timeoutMsg: "reader-pane still rendered previous account's message body",
      },
    );
  });
});
