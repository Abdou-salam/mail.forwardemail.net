import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { newBrowser, closeBrowser } from '../support/browser.js';
import { resolveAppBinary } from '../support/platform.js';
import { openApp } from '../support/app.js';
import { clearStorage } from '../support/state.js';
import { activateDemo } from '../support/demo.js';

describe('folder navigation', () => {
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

  async function locationHash(): Promise<string> {
    return (await browser.execute(() => decodeURIComponent(location.hash))) as string;
  }

  it('lands on INBOX by default', async () => {
    await browser.$('[data-testid="folder-list"]').waitForDisplayed({ timeout: 15_000 });
    await browser.waitUntil(async () => (await locationHash()).toLowerCase().includes('inbox'), {
      timeout: 10_000,
      timeoutMsg: 'expected default folder hash to include INBOX',
    });
  });

  it('updates the URL hash when clicking the Sent folder', async () => {
    const sent = await browser.$('[data-testid="folder-item"][data-folder-path="Sent"]');
    await sent.waitForExist({ timeout: 15_000 });
    const button = await sent.$('button');
    await button.click();
    await browser.waitUntil(async () => (await locationHash()).includes('Sent'), {
      timeout: 10_000,
      timeoutMsg: 'expected hash to include Sent after clicking the folder',
    });
  });

  it('updates the URL hash when clicking the Drafts folder', async () => {
    const drafts = await browser.$('[data-testid="folder-item"][data-folder-path="Drafts"]');
    await drafts.waitForExist({ timeout: 15_000 });
    const button = await drafts.$('button');
    await button.click();
    await browser.waitUntil(async () => (await locationHash()).includes('Drafts'), {
      timeout: 10_000,
      timeoutMsg: 'expected hash to include Drafts after clicking the folder',
    });
  });
});
