import { currentPath } from './state.js';

// TEMPORARY diagnostics (remove once the Linux demo-entry stall is fixed).
// The app's own warn() logger is dead-code-eliminated in the production
// frontend the e2e binary embeds, so app-side load failures never reach the
// console. To find why folders/messages intermittently never render on the
// Linux/WebKitGTK runner, install in-page probes: a fetch hook (reveals
// whether a request escaped the demo interceptor to the real api host and
// hung — the prime suspect) plus console/error capture. On readiness-gate
// timeout we dump it all to the test process' stderr so it lands in the CI log.
async function installDemoProbes(browser: WebdriverIO.Browser): Promise<void> {
  await browser
    .execute(() => {
      const w = window as unknown as Record<string, unknown>;
      if (w.__e2eProbed) return;
      w.__e2eProbed = true;
      const consoleLog: string[] = (w.__e2eConsole = []);
      const fetchLog: Record<string, unknown>[] = (w.__e2eFetch = []);
      const stringify = (a: unknown) => {
        if (typeof a === 'string') return a;
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      };
      (['error', 'warn'] as const).forEach((level) => {
        const orig = (console[level] as (...a: unknown[]) => void).bind(console);
        console[level] = (...args: unknown[]) => {
          try {
            consoleLog.push(level + ': ' + args.map(stringify).join(' '));
            if (consoleLog.length > 100) consoleLog.shift();
          } catch {
            /* ignore */
          }
          orig(...args);
        };
      });
      const origFetch = (w.fetch as ((...a: unknown[]) => Promise<Response>) | undefined)?.bind(w);
      if (origFetch) {
        w.fetch = (...args: unknown[]) => {
          const input = args[0] as { url?: string } | string;
          const url = String((typeof input === 'object' && input?.url) || input || '');
          const rec: Record<string, unknown> = { url: url.slice(0, 140), startedAt: Date.now() };
          fetchLog.push(rec);
          if (fetchLog.length > 60) fetchLog.shift();
          return origFetch(...args).then(
            (r: Response) => {
              rec.status = r.status;
              rec.ms = Date.now() - (rec.startedAt as number);
              return r;
            },
            (e: unknown) => {
              rec.error = String(e).slice(0, 140);
              rec.ms = Date.now() - (rec.startedAt as number);
              throw e;
            },
          );
        };
      }
      window.addEventListener('error', (e: ErrorEvent) => {
        try {
          consoleLog.push('window.onerror: ' + (e?.message || String(e)));
        } catch {
          /* ignore */
        }
      });
      window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
        try {
          consoleLog.push('unhandledrejection: ' + (e?.reason?.message || String(e?.reason)));
        } catch {
          /* ignore */
        }
      });
    })
    .catch(() => {
      /* probe install is best-effort */
    });
}

async function dumpDemoProbes(browser: WebdriverIO.Browser): Promise<void> {
  try {
    const diag = await browser.execute(() => {
      const w = window as unknown as Record<string, unknown>;
      const q = (s: string) => document.querySelectorAll(s).length;
      let demoFlag = 'n/a';
      try {
        demoFlag = String(localStorage.getItem('fe_demo_mode'));
      } catch {
        /* ignore */
      }
      const shell = document.querySelector('[data-testid="mailbox-shell"]') as HTMLElement | null;
      const now = Date.now();
      const fetches = (w.__e2eFetch as Record<string, unknown>[]) || [];
      const pendingFetches = fetches
        .filter((f) => f.status == null && f.error == null)
        .map((f) => ({ url: f.url, pendingMs: now - (f.startedAt as number) }));
      return {
        href: location.href,
        pathname: location.pathname,
        hash: location.hash,
        demoFlag,
        folderItems: q('[data-testid="folder-item"]'),
        messageRows: q('[data-testid="message-row"]'),
        loadingSkeletons: q('[class*="animate-pulse"], [data-testid*="skeleton"]'),
        shellPresent: !!shell,
        shellText: shell?.innerText?.replace(/\s+/g, ' ').slice(0, 300),
        // App-side load-orchestration breadcrumbs (see e2eTrace in
        // src/utils/bootstrap-ready.js). This is the decisive signal: it shows
        // which loaders fired, in what order, whether the demo flag + auth were
        // set at call time, and whether `loading` ever cleared.
        trace: (w.__feTrace as string[]) || [],
        fetches,
        pendingFetches,
        console: (w.__e2eConsole as string[]) || [],
      };
    });
    console.error(
      '\n[activateDemo] DEMO READINESS TIMED OUT — diagnostics:\n' +
        JSON.stringify(diag, null, 2) +
        '\n',
    );
  } catch (err) {
    console.error('[activateDemo] failed to collect diagnostics:', err);
  }
}

export async function activateDemo(browser: WebdriverIO.Browser): Promise<void> {
  const tryDemo = await browser.$('[data-testid="try-demo-btn"]');
  await tryDemo.waitForExist({ timeout: 15_000 });
  // Arm probes on the login page; SPA navigation to /mailbox preserves the
  // JS context so they survive the demo transition and capture the load.
  await installDemoProbes(browser);

  // Click via the native DOM rather than WDIO's actionability click.
  // On the macOS-arm64 CI runner the app window spawns very short
  // (~190px tall), leaving the Try Demo button below the viewport even
  // after scrollIntoView — WDIO's waitForClickable then times out with
  // "still not clickable after 15000ms" because it requires the element
  // to be in-viewport and unobscured. A direct element.click() fires the
  // Svelte onclick handler regardless of viewport position, which is all
  // we need to enter demo mode. element.click() is also immune to the
  // transient overlays (sync banners, etc.) that intercept pointer
  // events in WDIO's hit-testing.
  await tryDemo.scrollIntoView({ block: 'center' }).catch(() => {});
  const clicked = (await browser.execute((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return false;
    el.click();
    return true;
  }, '[data-testid="try-demo-btn"]')) as boolean;
  if (!clicked) {
    // Fall back to the standard click if the DOM query missed (e.g. the
    // testid changed) so the failure message points at the real problem.
    await tryDemo.waitForClickable({ timeout: 15_000 });
    await tryDemo.click();
  }

  await browser.waitUntil(async () => (await currentPath(browser)).startsWith('/mailbox'), {
    timeout: 15_000,
    timeoutMsg: 'expected navigation to /mailbox after Try Demo',
  });
  const shell = await browser.$('[data-testid="mailbox-shell"]');
  await shell.waitForDisplayed({ timeout: 15_000 });
  // Re-arm in case navigation was a hard reload (idempotent on the SPA path).
  await installDemoProbes(browser);

  // Wait for demo data to actually render — not just the shell. Slower CI
  // runners (Linux Xvfb especially) take noticeably longer to seed
  // IndexedDB and paint the first page, so individual specs that assert
  // on folders/message rows immediately after activateDemo were racing the
  // seed and flaking with "expected 0 to be greater than 0" or
  // "folder-item … not existing". Centralising the readiness gate here
  // means every spec starts from a populated mailbox. The demo always
  // lands on INBOX with seeded folders + messages, so both selectors are
  // guaranteed to appear.
  try {
    await browser.waitUntil(
      async () => {
        // Count both in a single in-page execute rather than two browser.$$
        // findElements round-trips per poll. On the slow Linux WebKitGTK runner
        // each WebDriver round-trip is expensive, and polling them in a loop
        // compounded the latency that pushed this gate over its timeout.
        const counts = (await browser.execute(() => ({
          folders: document.querySelectorAll('[data-testid="folder-item"]').length,
          rows: document.querySelectorAll('[data-testid="message-row"]').length,
        }))) as { folders: number; rows: number };
        return counts.folders > 0 && counts.rows > 0;
      },
      {
        // Generous ceiling for the slowest CI runner (Linux Xvfb), where the
        // seed+first-paint routinely takes 30-40s. waitUntil resolves the moment
        // the rows appear, so fast runners (Windows/macOS) pay nothing for it.
        timeout: 60_000,
        timeoutMsg: 'demo data did not render (expected folder-item + message-row)',
      },
    );
  } catch (err) {
    // TEMPORARY: dump the in-page probes so the CI log shows *why* the demo
    // data never rendered (escaped fetch hung? load chain never ran?).
    await dumpDemoProbes(browser);
    throw err;
  }
}
