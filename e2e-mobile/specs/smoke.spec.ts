import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { newBrowser, closeBrowser } from '../support/browser.js';
import { switchToTauriWebview, waitForFrontendReady, isTauriWebview } from '../support/app.js';

const APK_PATH = process.env.APK_PATH;
if (!APK_PATH) {
  throw new Error(
    'APK_PATH env var is required. Set it to the absolute path of the debug APK before running.',
  );
}

describe('android app smoke', () => {
  let browser: WebdriverIO.Browser;

  beforeAll(async () => {
    browser = await newBrowser({
      hostname: '127.0.0.1',
      port: 4723,
      path: '/',
      logLevel: 'warn',
      capabilities: {
        platformName: 'Android',
        'appium:automationName': 'UiAutomator2',
        'appium:app': APK_PATH,
        'appium:autoGrantPermissions': true,
        'appium:autoWebview': false,
        'appium:newCommandTimeout': 240,
      } as WebdriverIO.Capabilities,
    });
    await switchToTauriWebview(browser);
    await waitForFrontendReady(browser);
  }, 120_000);

  afterAll(closeBrowser);

  it('runs inside the native Android System WebView (Tauri-bridged)', async () => {
    expect(await isTauriWebview(browser)).toBe(true);
  });

  it('loads the frontend with a non-empty title', async () => {
    expect(await browser.getTitle()).toBeTruthy();
  });
});
