import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { newBrowser, closeBrowser } from '../support/browser.js';
import { resolveAppBinary } from '../support/platform.js';
import { openApp } from '../support/app.js';
import { clearStorage } from '../support/state.js';
import { activateDemo } from '../support/demo.js';

describe('theme toggle', () => {
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

  async function isDark(): Promise<boolean> {
    return browser.execute(
      () =>
        document.body.classList.contains('dark-mode') ||
        document.documentElement.classList.contains('dark'),
    ) as Promise<boolean>;
  }

  function themeToggleButton() {
    return browser.$('[aria-label="Switch to dark mode"], [aria-label="Switch to light mode"]');
  }

  it('flips the body/html theme class on click', async () => {
    const before = await isDark();
    const toggle = await themeToggleButton();
    await toggle.waitForClickable({ timeout: 15_000 });
    await toggle.click();
    await browser.waitUntil(async () => (await isDark()) !== before, {
      timeout: 5_000,
      timeoutMsg: 'theme class did not flip after toggle click',
    });
    expect(await isDark()).toBe(!before);
  });

  it('flips back on a second click', async () => {
    const start = await isDark();
    const toggle1 = await themeToggleButton();
    await toggle1.click();
    await browser.waitUntil(async () => (await isDark()) !== start, { timeout: 5_000 });
    const toggle2 = await themeToggleButton();
    await toggle2.click();
    await browser.waitUntil(async () => (await isDark()) === start, {
      timeout: 5_000,
      timeoutMsg: 'theme did not return to original state on second click',
    });
  });
});
