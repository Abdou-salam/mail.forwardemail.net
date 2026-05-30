// Robust click helpers for the native Tauri WebView.
//
// WDIO's element.click() requires the element to pass an actionability gate:
// in-viewport, unobscured, stable (not animating). On the macOS-arm64 CI
// runner the app window can spawn very short, leaving list rows below the fold,
// and transient overlays (sync banners, settling skeletons) intermittently
// intercept pointer events — so waitForClickable() times out even though the
// element is present and its handler works. A native element.click() fires the
// Svelte onclick handler regardless of viewport position or overlays, which is
// all these assertions need. This mirrors activateDemo()'s native Try-Demo
// click. See support/demo.ts for the original rationale.

// Structural element type: both WebdriverIO.Element and the awaited
// ChainablePromiseElement that `$()` returns satisfy this, so callers don't
// have to juggle the two WDIO element types.
/* eslint-disable @typescript-eslint/no-explicit-any */
type ClickableEl = {
  scrollIntoView: (opts?: any) => Promise<unknown>;
  waitForClickable: (opts?: any) => Promise<unknown>;
  click: () => Promise<unknown>;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Click an element via the native DOM (immune to viewport/overlay/stability
 * gates), falling back to WDIO's actionability click if the node can't be
 * resolved (e.g. it genuinely isn't in the DOM) so failures still point at the
 * real problem.
 */
export async function nativeClick(browser: WebdriverIO.Browser, el: ClickableEl): Promise<void> {
  // Best-effort: bring it into view so any follow-up assertions that DO need
  // visibility (e.g. reading computed state) see a scrolled-in element.
  await el.scrollIntoView({ block: 'center' }).catch(() => {});
  const clicked = (await browser.execute(
    (node: unknown) => {
      const node_ = node as HTMLElement | null;
      if (!node_ || typeof node_.click !== 'function') return false;
      node_.click();
      return true;
    },
    el as unknown as object,
  )) as boolean;
  if (!clicked) {
    await el.waitForClickable({ timeout: 10_000 });
    await el.click();
  }
}
