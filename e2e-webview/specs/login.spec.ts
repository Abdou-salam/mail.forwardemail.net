import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { newBrowser, closeBrowser } from '../support/browser.js';
import { resolveAppBinary } from '../support/platform.js';
import { openApp } from '../support/app.js';
import { clearStorage, currentPath } from '../support/state.js';

describe('login', () => {
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

  it('renders the login screen on cold start', async () => {
    // Assert existence, not isDisplayed(): on the macOS-arm64 CI runner the
    // window spawns ~190px tall and Try Demo sits below the password +
    // Stay-signed-in checkbox, leaving it outside the viewport. isDisplayed()
    // is viewport-gated and would falsely fail; the button being mounted is
    // what proves the login screen rendered.
    const tryDemo = await browser.$('[data-testid="try-demo-btn"]');
    await tryDemo.waitForExist({ timeout: 10_000 });
    expect(await tryDemo.isExisting()).toBe(true);
  });

  it('has email and password inputs visible', async () => {
    const email = await browser.$('input[type="email"]');
    const password = await browser.$('input[type="password"]');
    await email.waitForDisplayed({ timeout: 10_000 });
    expect(await email.isDisplayed()).toBe(true);
    expect(await password.isDisplayed()).toBe(true);
  });

  it('does not auto-navigate to /mailbox without a session', async () => {
    // waitForExist (not Displayed) — the button can be below the tiny arm64
    // viewport. We only need the login screen mounted before reading the path.
    await browser.$('[data-testid="try-demo-btn"]').waitForExist({ timeout: 10_000 });
    const path = await currentPath(browser);
    expect(path.startsWith('/mailbox')).toBe(false);
  });
});
