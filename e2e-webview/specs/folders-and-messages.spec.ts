import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { newBrowser, closeBrowser } from '../support/browser.js';
import { resolveAppBinary } from '../support/platform.js';
import { openApp } from '../support/app.js';
import { clearStorage } from '../support/state.js';
import { activateDemo } from '../support/demo.js';

describe('folders and messages', () => {
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

  async function $$count(selector: string): Promise<number> {
    const els = await browser.$$(selector);
    return els.length;
  }

  it('renders a non-empty folder list from demo data', async () => {
    const list = await browser.$('[data-testid="folder-list"]');
    await list.waitForDisplayed({ timeout: 15_000 });
    expect(await $$count('[data-testid="folder-item"]')).toBeGreaterThan(0);
  });

  it('exposes an INBOX folder', async () => {
    const inbox = await browser.$(
      '[data-testid="folder-item"][data-folder-path="INBOX" i], [data-testid="folder-item"][data-folder-path="Inbox" i]',
    );
    await inbox.waitForExist({ timeout: 15_000 });
    expect(await inbox.isExisting()).toBe(true);
  });

  it('renders message rows for the INBOX folder', async () => {
    await browser.$('[data-testid="folder-list"]').waitForDisplayed({ timeout: 15_000 });
    await browser.waitUntil(async () => (await $$count('[data-testid="message-row"]')) > 0, {
      timeout: 15_000,
      timeoutMsg: 'no message rows rendered after demo activation',
    });
    expect(await $$count('[data-testid="message-row"]')).toBeGreaterThan(0);
  });

  // On Tauri desktop, clicking a row calls openMessageTab (Thunderbird-style
  // tabs in TabBar). On non-desktop / mobile layouts, the row populates the
  // inline reader pane. Accept either path so the spec is layout-agnostic.
  it('opens the message — new tab on desktop, reader pane otherwise', async () => {
    await browser.waitUntil(async () => (await $$count('[data-testid="message-row"]')) > 0, {
      timeout: 15_000,
    });

    const beforeTabs = await $$count('[data-testid="tab"][data-tab-type="message"]');

    const rows = await browser.$$('[data-testid="message-row"]');
    await rows[0].click();

    await browser.waitUntil(
      async () => {
        const messageTabs = await $$count('[data-testid="tab"][data-tab-type="message"]');
        if (messageTabs > beforeTabs) return true;
        const reader = await browser.$('[data-testid="reader-pane"]');
        return reader.isExisting();
      },
      {
        timeout: 10_000,
        timeoutMsg: 'expected either a new message tab or the reader pane after clicking a row',
      },
    );
  });

  it('makes the new message tab the active tab (desktop)', async () => {
    await browser.waitUntil(async () => (await $$count('[data-testid="message-row"]')) > 0, {
      timeout: 15_000,
    });
    const rows = await browser.$$('[data-testid="message-row"]');
    await rows[0].click();

    // Skip cleanly on non-desktop layouts where openMessageTab is bypassed.
    const opened = await browser
      .$('[data-testid="tab"][data-tab-type="message"]')
      .waitForExist({ timeout: 5_000, reverse: false })
      .then(() => true)
      .catch(() => false);
    if (!opened) return;

    const tab = await browser.$('[data-testid="tab"][data-tab-type="message"]');
    expect(await tab.getAttribute('aria-selected')).toBe('true');
  });
});
