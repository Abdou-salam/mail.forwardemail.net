import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { newBrowser, closeBrowser } from '../support/browser.js';
import { resolveAppBinary } from '../support/platform.js';
import { openApp, isTauriWebview } from '../support/app.js';

describe('app smoke', () => {
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
  });

  it('loads the frontend with a non-empty title', async () => {
    expect(await browser.getTitle()).toBeTruthy();
  });

  it('runs inside the native Tauri WebView (not vanilla Chromium)', async () => {
    expect(await isTauriWebview(browser)).toBe(true);
  });
});
