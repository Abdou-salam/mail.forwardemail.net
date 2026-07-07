#!/usr/bin/env node

/**
 * Validates that SCHEMA_VERSION in public/sw-sync.js matches
 * src/utils/db-constants.ts. A mismatch means the service worker
 * would read/write a different IndexedDB database than the main app.
 *
 * Also fails the build if any file under src/ hardcodes the database name
 * ('webmail-cache-v...') instead of importing DB_NAME from db-constants.ts.
 * Hardcoded copies silently open the WRONG database after a schema bump
 * (and already miss the dev-suffixed name in development builds).
 *
 * Exit codes:
 *   0: versions match and no hardcoded DB names
 *   1: mismatch, hardcoded DB name, or parse failure
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const SW_PATH = resolve(root, 'public/sw-sync.js');
const DB_PATH = resolve(root, 'src/utils/db-constants.ts');

function extractVersion(filePath, label) {
  const src = readFileSync(filePath, 'utf8');
  const match = src.match(/^\s*(?:export\s+)?const\s+SCHEMA_VERSION\s*=\s*(\d+)/m);
  if (!match) {
    console.error(`Could not find SCHEMA_VERSION in ${label} (${filePath})`);
    process.exit(1);
  }
  return Number(match[1]);
}

const swVersion = extractVersion(SW_PATH, 'sw-sync.js');
const dbVersion = extractVersion(DB_PATH, 'db-constants.ts');

if (swVersion !== dbVersion) {
  console.error(
    `SCHEMA_VERSION mismatch: sw-sync.js has ${swVersion}, db-constants.ts has ${dbVersion}.\n` +
      'Both files must use the same version or the service worker will use a different database.',
  );
  process.exit(1);
}

// --- Hardcoded DB-name sweep over src/ -------------------------------------
// Only db-constants.ts may spell out the database name; everything else must
// import DB_NAME. (public/sw-sync.js can't import; it is covered by the
// SCHEMA_VERSION check above.)
const SRC_ROOT = resolve(root, 'src');
const ALLOWED = new Set([resolve(root, 'src/utils/db-constants.ts')]);
const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.svelte']);
// Version-pinned names only. The bare 'webmail-cache' prefix (db-recovery.js's
// delete-all escape hatch) is legitimate since it must match old versions too.
const DB_NAME_LITERAL = /['"`]webmail-cache-v/;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      yield* walk(full);
    } else if (SOURCE_EXTENSIONS.has(full.slice(full.lastIndexOf('.')))) {
      yield full;
    }
  }
}

const offenders = [];
for (const file of walk(SRC_ROOT)) {
  if (ALLOWED.has(file)) continue;
  const src = readFileSync(file, 'utf8');
  if (DB_NAME_LITERAL.test(src)) {
    const line = src.split('\n').findIndex((l) => DB_NAME_LITERAL.test(l)) + 1;
    offenders.push(`${relative(root, file)}:${line}`);
  }
}

if (offenders.length) {
  console.error(
    'Hardcoded IndexedDB database name found (import DB_NAME from src/utils/db-constants.ts instead):\n' +
      offenders.map((o) => `  ${o}`).join('\n'),
  );
  process.exit(1);
}

console.log(`SCHEMA_VERSION OK (${dbVersion}); no hardcoded DB names in src/`);
