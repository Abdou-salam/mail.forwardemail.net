// Pure helpers extracted from mailboxStore.ts so they can be unit-tested
// without loading the store's I/O graph (Dexie/db, sync worker, Remote, other
// stores). These are message-identity / list-merge / value-coercion helpers
// with no module state and no side effects. Anything touching db/Remote/stores
// (e.g. mergeMissingLabels/mergeMissingFrom) stays in mailboxStore.ts.
//
// Params are intentionally left loosely typed to match the originals verbatim
// (mailboxStore.ts is pervasively untyped) — this is a behavior-preserving
// extraction, not a retype.

// Validate a value the way Dexie validates a primary key, used as a fallback
// guard before writing to IndexedDB. Strings, finite numbers, Dates, and
// arrays of those are valid keys; null/undefined/objects/NaN are not.
export const isValidDexieKeyFallback = (key) => {
  if (key == null) return false;
  if (Array.isArray(key)) return key.every(isValidDexieKeyFallback);
  if (key instanceof Date) return true;
  const type = typeof key;
  if (type === 'string') return true;
  if (type === 'number') return Number.isFinite(key);
  return false;
};

// Normalize a labels value (array or comma-separated string) into a clean
// string[] — trims entries, drops empties and the literal "[]" placeholder.
export const coerceLabelList = (value) => {
  const normalizeLabel = (label) => {
    const normalized = String(label ?? '').trim();
    if (!normalized || /^\[\s*\]$/.test(normalized)) return '';
    return normalized;
  };
  if (Array.isArray(value)) {
    return value.map((label) => normalizeLabel(label)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((label) => normalizeLabel(label))
      .filter(Boolean);
  }
  return [];
};

export const hasFromValue = (value) => typeof value === 'string' && value.trim().length > 0;

// Derive a stable, collision-safe identity for a message used to dedup list
// pages. Prefer the server-assigned id/uid; fall back to the Message-ID header
// scoped by folder so forwarded copies sharing a Message-ID aren't collapsed.
export const getMessageKey = (msg) => {
  // Prefer server-assigned id/uid which is unique per message per folder.
  // Fallback to Message-ID header scoped by folder to avoid collapsing
  // forwarded emails that share the same Message-ID as the original.
  const uid = msg?.id ?? msg?.uid ?? msg?.Uid ?? msg?.uidnext;
  if (uid != null) return uid;
  const messageId =
    msg?.message_id ?? msg?.messageId ?? msg?.['Message-ID'] ?? msg?.header_message_id;
  if (messageId) {
    const folder = msg?.folder ?? '';
    return `${folder}:${messageId}`;
  }
  return null;
};

// Merge two message-list pages, preserving order (existing first, then
// incoming) and dropping duplicates by getMessageKey. Messages with no
// derivable key are always kept (can't dedup what we can't identify).
//
// `max` (optional, >0): bound the merged result to its last `max` entries by
// dropping from the HEAD. Infinite scroll appends older pages at the tail, so
// the head holds rows the user has scrolled well past; capping the live window
// keeps the in-memory array — and the DOM rows derived from it — from growing
// for the entire life of a folder session. The dropped head is restored by any
// page-1 replace-load (folder reselect, refresh, filter change). `max <= 0`
// (the default) means no cap.
export const mergeMessagePages = (existing = [], incoming = [], max = 0) => {
  const merged = [];
  const seen = new Set();
  const append = (list) => {
    (list || []).forEach((msg) => {
      const key = getMessageKey(msg);
      if (key == null) {
        merged.push(msg);
        return;
      }
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(msg);
    });
  };
  append(existing);
  append(incoming);
  if (max > 0 && merged.length > max) {
    return merged.slice(-max);
  }
  return merged;
};

// Reads cached message records by compound key ([account, id] or alternate
// identifiers). Injected so these backfills can be unit-tested without Dexie;
// in the store it's wired to `db.messages.bulkGet`.
type MessageBulkGet = (keys: unknown[]) => Promise<Array<Record<string, unknown> | undefined>>;

// Backfill labels onto list messages that arrived without them by reading the
// cached copy from IndexedDB — first by [account, id], then by alternate
// identifiers (uid/message_id/header_message_id). Returns the input list
// unchanged when there's nothing to look up or on any error.
export const mergeMissingLabels = async (
  bulkGet: MessageBulkGet,
  account,
  list,
  labelPresence = [],
) => {
  try {
    const lookup = [];
    const indices = [];
    const fallbackKeys = [];
    const fallbackIndex = new Map();
    list.forEach((msg, idx) => {
      const incoming = coerceLabelList(msg.labels);
      if (!labelPresence[idx] || incoming.length === 0) {
        lookup.push([account, msg.id]);
        indices.push(idx);
      }
    });
    if (!lookup.length) return list;
    const existing = await bulkGet(lookup);
    indices.forEach((msgIdx) => {
      const msg = list[msgIdx] || {};
      const id = msg?.id;
      const candidates = [msg?.uid, msg?.message_id, msg?.header_message_id].filter(Boolean);
      for (const candidate of candidates) {
        if (candidate === id) continue;
        fallbackIndex.set(`${msgIdx}:${candidate}`, fallbackKeys.length);
        fallbackKeys.push([account, candidate]);
      }
    });
    const fallbackRecords = fallbackKeys.length ? await bulkGet(fallbackKeys) : [];
    if (!existing?.length) return list;
    const next = list.slice();
    existing.forEach((record, i) => {
      const idx = indices[i];
      if (idx === undefined) return;
      const existingLabels = coerceLabelList(record?.labels);
      if (existingLabels.length) {
        next[idx] = { ...next[idx], labels: existingLabels };
        return;
      }
      const msg = list[idx] || {};
      const candidates = [msg?.uid, msg?.message_id, msg?.header_message_id].filter(Boolean);
      for (const candidate of candidates) {
        const key = `${idx}:${candidate}`;
        if (!fallbackIndex.has(key)) continue;
        const fallback = fallbackRecords[fallbackIndex.get(key)];
        const fallbackLabels = coerceLabelList(fallback?.labels);
        if (fallbackLabels.length) {
          next[idx] = { ...next[idx], labels: fallbackLabels };
          break;
        }
      }
    });
    return next;
  } catch {
    return list;
  }
};

// Backfill the `from` address onto list messages that arrived without one,
// same cache-lookup strategy as mergeMissingLabels.
export const mergeMissingFrom = async (bulkGet: MessageBulkGet, account, list = []) => {
  try {
    const lookup = [];
    const indices = [];
    const fallbackKeys = [];
    const fallbackIndex = new Map();
    list.forEach((msg, idx) => {
      if (!hasFromValue(msg?.from)) {
        lookup.push([account, msg.id]);
        indices.push(idx);
      }
    });
    if (!lookup.length) return list;
    const existing = await bulkGet(lookup);
    indices.forEach((msgIdx) => {
      const msg = list[msgIdx] || {};
      const id = msg?.id;
      const candidates = [msg?.uid, msg?.message_id, msg?.header_message_id].filter(Boolean);
      for (const candidate of candidates) {
        if (candidate === id) continue;
        fallbackIndex.set(`${msgIdx}:${candidate}`, fallbackKeys.length);
        fallbackKeys.push([account, candidate]);
      }
    });
    const fallbackRecords = fallbackKeys.length ? await bulkGet(fallbackKeys) : [];
    if (!existing?.length) return list;
    const next = list.slice();
    existing.forEach((record, i) => {
      const idx = indices[i];
      if (idx === undefined) return;
      if (hasFromValue(record?.from)) {
        next[idx] = { ...next[idx], from: record.from };
        return;
      }
      const msg = list[idx] || {};
      const candidates = [msg?.uid, msg?.message_id, msg?.header_message_id].filter(Boolean);
      for (const candidate of candidates) {
        const key = `${idx}:${candidate}`;
        if (!fallbackIndex.has(key)) continue;
        const fallback = fallbackRecords[fallbackIndex.get(key)];
        if (hasFromValue(fallback?.from)) {
          next[idx] = { ...next[idx], from: fallback.from };
          break;
        }
      }
    });
    return next;
  } catch {
    return list;
  }
};
