import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { newBrowser, closeBrowser } from '../support/browser.js';
import { resolveAppBinary } from '../support/platform.js';
import { openApp } from '../support/app.js';
import { clearStorage, currentPath } from '../support/state.js';
import { activateDemo } from '../support/demo.js';

describe('settings navigation', () => {
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

  it('navigates from /mailbox into /mailbox/settings on click', async () => {
    expect((await currentPath(browser)).startsWith('/mailbox')).toBe(true);

    const settingsBtn = await browser.$('[aria-label="Settings"]');
    await settingsBtn.waitForClickable({ timeout: 15_000 });
    await settingsBtn.click();

    await browser.waitUntil(async () => (await currentPath(browser)) === '/mailbox/settings', {
      timeout: 10_000,
      timeoutMsg: 'expected pathname to become /mailbox/settings',
    });

    const header = await browser.$('[data-testid="settings-header"]');
    await header.waitForDisplayed({ timeout: 10_000 });
    expect(await header.isDisplayed()).toBe(true);
  });

  it('unmounts the mailbox shell while settings is mounted', async () => {
    const settingsBtn = await browser.$('[aria-label="Settings"]');
    await settingsBtn.click();
    await browser.$('[data-testid="settings-header"]').waitForDisplayed({ timeout: 10_000 });

    const shell = await browser.$('[data-testid="mailbox-shell"]');
    expect(await shell.isExisting()).toBe(false);
  });

  it('returns to the mailbox when the Back button is clicked', async () => {
    const settingsBtn = await browser.$('[aria-label="Settings"]');
    await settingsBtn.click();
    await browser.$('[data-testid="settings-header"]').waitForDisplayed({ timeout: 10_000 });

    const back = await browser.$('[data-testid="settings-header"] [aria-label="Back"]');
    await back.waitForClickable({ timeout: 10_000 });
    await back.click();

    await browser.waitUntil(
      async () => {
        const path = await currentPath(browser);
        return path.startsWith('/mailbox') && path !== '/mailbox/settings';
      },
      { timeout: 10_000, timeoutMsg: 'expected to leave /mailbox/settings on Back click' },
    );

    const shell = await browser.$('[data-testid="mailbox-shell"]');
    await shell.waitForDisplayed({ timeout: 10_000 });
    expect(await shell.isDisplayed()).toBe(true);
  });

  it('preserves the demo session across the settings round-trip', async () => {
    const settingsBtn = await browser.$('[aria-label="Settings"]');
    await settingsBtn.click();
    await browser.$('[data-testid="settings-header"]').waitForDisplayed({ timeout: 10_000 });

    const back = await browser.$('[data-testid="settings-header"] [aria-label="Back"]');
    await back.click();
    await browser.$('[data-testid="mailbox-shell"]').waitForDisplayed({ timeout: 10_000 });

    const flag = await browser.execute(() => localStorage.getItem('fe_demo_mode'));
    expect(flag).toBe('1');
  });
});
