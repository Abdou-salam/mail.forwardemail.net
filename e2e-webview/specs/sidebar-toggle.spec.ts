import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { newBrowser, closeBrowser } from '../support/browser.js';
import { resolveAppBinary } from '../support/platform.js';
import { openApp } from '../support/app.js';
import { clearStorage } from '../support/state.js';
import { activateDemo } from '../support/demo.js';

describe('sidebar toggle', () => {
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

  async function shellClass(): Promise<string> {
    const el = await browser.$('[data-testid="mailbox-shell"]');
    return (await el.getAttribute('class')) ?? '';
  }

  async function sidebarClass(): Promise<string> {
    const el = await browser.$('[data-testid="mailbox-sidebar"]');
    return (await el.getAttribute('class')) ?? '';
  }

  it('opens by default on desktop layout', async () => {
    await browser.$('[data-testid="mailbox-shell"]').waitForDisplayed({ timeout: 15_000 });
    expect(await sidebarClass()).toContain('fe-folders-open');
    expect(await shellClass()).not.toContain('fe-shell-collapsed');
  });

  it('collapses when the toggle button is clicked', async () => {
    const toggle = await browser.$('[aria-label="Toggle sidebar"]');
    await toggle.waitForClickable({ timeout: 15_000 });
    await toggle.click();
    await browser.waitUntil(async () => (await shellClass()).includes('fe-shell-collapsed'), {
      timeout: 5_000,
      timeoutMsg: 'shell did not collapse after clicking toggle',
    });
    expect(await sidebarClass()).not.toContain('fe-folders-open');
  });

  it('toggles back open on a second click', async () => {
    const toggle = await browser.$('[aria-label="Toggle sidebar"]');
    await toggle.waitForClickable({ timeout: 15_000 });
    await toggle.click();
    await browser.waitUntil(async () => (await shellClass()).includes('fe-shell-collapsed'), {
      timeout: 5_000,
    });
    await toggle.click();
    await browser.waitUntil(async () => !(await shellClass()).includes('fe-shell-collapsed'), {
      timeout: 5_000,
      timeoutMsg: 'shell did not expand on the second toggle click',
    });
  });
});
