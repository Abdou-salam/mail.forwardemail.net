#!/usr/bin/env node

/**
 * Forward Email – build-sw-normalize.mjs
 *
 * Bundles the canonical message normalizer into a classic service-worker script
 * so the SW background-sync path uses exactly ONE normalizer (arch backlog #4b).
 *
 * The SW (public/sw-sync.js, loaded by Workbox via importScripts) needs
 * `normalizeMessageForCache`, but that's a TS/ESM module which transitively
 * imports Dexie (via storage.js). We bundle it to a classic IIFE with
 * Vite/Rollup and STUB storage.js out — the normalizer only reaches it through
 * `accountKey()`'s default, which the SW never triggers (sw-sync.js always
 * passes an explicit account) — so Dexie/ESM never enter the service worker.
 *
 * Output: public/sw-message-normalize.js (committed; regenerated here in
 * `prebuild` and guarded against drift by
 * tests/unit/message-normalize-contract.test.ts).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Replace storage.js with a no-op stub so Dexie/db never get pulled into the SW
// bundle. `Local.get` returning null just makes accountKey() fall back to
// 'default' if it were ever called (it isn't, on the SW path).
const stubStorage = {
  name: 'sw-stub-storage',
  enforce: 'pre',
  resolveId(source) {
    if (source === './storage.js' || /\/storage\.js$/.test(source)) {
      return '\0sw-storage-stub';
    }
    return null;
  },
  load(id) {
    if (id === '\0sw-storage-stub') {
      return [
        'export const Local = { get: () => null, set: () => {}, remove: () => {} };',
        'export const Accounts = { list: () => [], get: () => null };',
      ].join('\n');
    }
    return null;
  },
};

const BANNER = `/* GENERATED FILE — do not edit by hand.
 * Source:  src/workers/sw-normalize-entry.ts -> src/utils/sync-helpers.ts (normalizeMessageForCache)
 * Rebuild: pnpm run gen:sw-normalize  (also runs automatically in prebuild)
 *
 * Loaded via importScripts (workbox.config.cjs) BEFORE sw-sync.js; defines the
 * global self.normalizeMessageRecord(raw, folder, account). storage.js/Dexie are
 * stubbed out of this bundle. Parity with the canonical normalizer is enforced
 * by tests/unit/message-normalize-contract.test.ts.
 */`;

const OUT = path.resolve(ROOT, 'public', 'sw-message-normalize.js');

await build({
  configFile: false,
  root: ROOT,
  logLevel: 'warn',
  // publicDir === outDir here (both `public/`); disable the public-copy feature
  // so Vite doesn't warn about (or try to copy) the dir into itself.
  publicDir: false,
  plugins: [stubStorage],
  build: {
    outDir: path.resolve(ROOT, 'public'),
    emptyOutDir: false,
    minify: false,
    sourcemap: false,
    target: 'es2020',
    lib: {
      entry: path.resolve(ROOT, 'src/workers/sw-normalize-entry.ts'),
      formats: ['iife'],
      name: '__swNormalize',
      fileName: () => 'sw-message-normalize.js',
    },
  },
});

// Vite's lib mode drops rollup `output.banner`, so prepend the GENERATED header
// here to keep the committed artifact clearly marked as machine-generated.
writeFileSync(OUT, `${BANNER}\n${readFileSync(OUT, 'utf8')}`, 'utf8');

console.log('[build-sw-normalize] wrote public/sw-message-normalize.js');
