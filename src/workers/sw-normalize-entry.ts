/**
 * Entry point for the service-worker message-normalizer bundle.
 *
 * Bundled (Vite/Rollup IIFE) into `public/sw-message-normalize.js` by
 * `scripts/build-sw-normalize.mjs`, then loaded via importScripts
 * (workbox.config.cjs) BEFORE sw-sync.js. This is how the SW background-sync
 * path reuses the ONE canonical normalizer (`normalizeMessageForCache`) instead
 * of a hand-maintained copy that could drift — see arch backlog #4b.
 *
 * The bundler stubs out `storage.js` (and thus Dexie): the normalizer only
 * reaches it via `accountKey()`'s default, which the SW never triggers because
 * sw-sync.js always passes an explicit account.
 *
 * Attaching to `globalThis` is enough: inside a service worker `globalThis` IS
 * `self`, so sw-sync.js's `self.normalizeMessageRecord(raw, folder, account)`
 * resolves. `globalThis` also lets the vitest contract test read it.
 */
import { normalizeMessageForCache } from '../utils/sync-helpers';

const target = globalThis as unknown as {
  normalizeMessageRecord?: (
    raw: Parameters<typeof normalizeMessageForCache>[0],
    folder?: string,
    account?: string,
  ) => ReturnType<typeof normalizeMessageForCache>;
};

target.normalizeMessageRecord = (raw, folder, account) =>
  normalizeMessageForCache(raw, folder, account);

// A named export keeps the IIFE bundle from being a pure side-effect module
// (silences "entry has no exports" and gives the global a defined value).
export const swNormalizeLoaded = true;
