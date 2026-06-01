import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { newBrowser, closeBrowser } from '../support/browser.js';
import { resolveAppBinary } from '../support/platform.js';
import { openApp } from '../support/app.js';
import { clearStorage, currentPath } from '../support/state.js';
import { activateDemo } from '../support/demo.js';

describe('demo mode', () => {
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
  });

  it('navigates from login to /mailbox after Try Demo', async () => {
    await activateDemo(browser);
    expect((await currentPath(browser)).startsWith('/mailbox')).toBe(true);
  });

  it('renders the mailbox shell with sidebar and message list pane', async () => {
    await activateDemo(browser);
    const sidebar = await browser.$('[data-testid="mailbox-sidebar"]');
    const messages = await browser.$('[data-testid="message-list-pane"]');
    expect(await sidebar.isExisting()).toBe(true);
    expect(await messages.isExisting()).toBe(true);
  });

  it('sets the demo session flag in storage', async () => {
    await activateDemo(browser);
    const flag = await browser.execute(
      () => localStorage.getItem('fe_demo_mode') ?? sessionStorage.getItem('fe_demo_mode'),
    );
    expect(flag).toBeTruthy();
  });

  it('navigates to the Calendar view from the sidebar', async () => {
    await activateDemo(browser);
    const calendar = await browser.$('[aria-label="Calendar"]');
    await calendar.waitForClickable({ timeout: 15_000 });
    await calendar.click();
    const header = await browser.$('[data-testid="calendar-header"]');
    // Calendar is the heaviest lazy-mounted view (month grid + data load). On
    // the slowest runner (macos-15-intel — ~3× the arm64 build time, heavily
    // loaded) it has rendered just past the old 15s window: failure
    // screenshots showed the full calendar already painted. Give it the same
    // slow-runner headroom as the 60s readiness gate; the header is otherwise
    // static and appears on mount.
    await header.waitForDisplayed({ timeout: 30_000 });
    expect(await header.isDisplayed()).toBe(true);
  });
});
