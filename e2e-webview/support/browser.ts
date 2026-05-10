import { remote } from 'webdriverio';

type RemoteOptions = Parameters<typeof remote>[0];

let current: WebdriverIO.Browser | undefined;

export async function newBrowser(opts: RemoteOptions): Promise<WebdriverIO.Browser> {
  current = await remote(opts);
  return current;
}

export function currentBrowser(): WebdriverIO.Browser | undefined {
  return current;
}

export async function closeBrowser(): Promise<void> {
  if (!current) return;
  try {
    await current.deleteSession();
  } finally {
    current = undefined;
  }
}
