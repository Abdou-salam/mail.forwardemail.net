import { describe, expect, it, vi } from 'vitest';
import {
  isValidDexieKeyFallback,
  coerceLabelList,
  hasFromValue,
  getMessageKey,
  mergeMessagePages,
  mergeMissingLabels,
  mergeMissingFrom,
} from '../../src/stores/mailbox-store-helpers';

// Mock bulkGet: returns the cached record for each [account, key] tuple in the
// same order as the keys (Dexie's bulkGet contract), undefined when absent.
const mockBulkGet = (records: Record<string, unknown>) =>
  vi.fn((keys: unknown[]) =>
    Promise.resolve((keys as [string, string][]).map(([, key]) => records[key])),
  );

describe('isValidDexieKeyFallback', () => {
  it('accepts strings, finite numbers, and Dates', () => {
    expect(isValidDexieKeyFallback('abc')).toBe(true);
    expect(isValidDexieKeyFallback('')).toBe(true);
    expect(isValidDexieKeyFallback(0)).toBe(true);
    expect(isValidDexieKeyFallback(-1)).toBe(true);
    expect(isValidDexieKeyFallback(1.5)).toBe(true);
    expect(isValidDexieKeyFallback(new Date())).toBe(true);
  });

  it('rejects null/undefined, non-finite numbers, booleans, and plain objects', () => {
    expect(isValidDexieKeyFallback(null)).toBe(false);
    expect(isValidDexieKeyFallback(undefined)).toBe(false);
    expect(isValidDexieKeyFallback(NaN)).toBe(false);
    expect(isValidDexieKeyFallback(Infinity)).toBe(false);
    expect(isValidDexieKeyFallback(true)).toBe(false);
    expect(isValidDexieKeyFallback({})).toBe(false);
  });

  it('validates arrays recursively (compound keys)', () => {
    expect(isValidDexieKeyFallback(['account', 123])).toBe(true);
    expect(isValidDexieKeyFallback([])).toBe(true); // [].every === true
    expect(isValidDexieKeyFallback(['account', null])).toBe(false);
    expect(isValidDexieKeyFallback(['account', ['nested', 1]])).toBe(true);
    expect(isValidDexieKeyFallback(['account', NaN])).toBe(false);
  });
});

describe('coerceLabelList', () => {
  it('trims and filters an array of labels', () => {
    expect(coerceLabelList([' Work ', 'Home', ''])).toEqual(['Work', 'Home']);
  });

  it('splits a comma-separated string', () => {
    expect(coerceLabelList('Work, Home ,, Travel')).toEqual(['Work', 'Home', 'Travel']);
  });

  it('drops the literal "[]" placeholder (any inner whitespace)', () => {
    expect(coerceLabelList(['[]', '[ ]', 'Work'])).toEqual(['Work']);
    expect(coerceLabelList('[]')).toEqual([]);
  });

  it('coerces non-string array entries and drops null/empty', () => {
    expect(coerceLabelList([5, null, undefined, 'ok'])).toEqual(['5', 'ok']);
  });

  it('returns [] for non-array/non-string input', () => {
    expect(coerceLabelList(null)).toEqual([]);
    expect(coerceLabelList(undefined)).toEqual([]);
    expect(coerceLabelList(42)).toEqual([]);
    expect(coerceLabelList({})).toEqual([]);
  });
});

describe('hasFromValue', () => {
  it('is true only for a non-blank string', () => {
    expect(hasFromValue('a@b.com')).toBe(true);
    expect(hasFromValue('   x  ')).toBe(true);
  });

  it('is false for blank strings and non-strings', () => {
    expect(hasFromValue('')).toBe(false);
    expect(hasFromValue('   ')).toBe(false);
    expect(hasFromValue(null)).toBe(false);
    expect(hasFromValue(undefined)).toBe(false);
    expect(hasFromValue(123)).toBe(false);
  });
});

describe('getMessageKey', () => {
  it('prefers id, then uid/Uid/uidnext', () => {
    expect(getMessageKey({ id: 'a', uid: 'b' })).toBe('a');
    expect(getMessageKey({ uid: 'b' })).toBe('b');
    expect(getMessageKey({ Uid: 'c' })).toBe('c');
    expect(getMessageKey({ uidnext: 'd' })).toBe('d');
  });

  it('treats id 0 as a real key (nullish, not falsy, semantics)', () => {
    expect(getMessageKey({ id: 0 })).toBe(0);
  });

  it('falls back to folder-scoped Message-ID when no id/uid', () => {
    expect(getMessageKey({ message_id: '<x@host>', folder: 'INBOX' })).toBe('INBOX:<x@host>');
    expect(getMessageKey({ messageId: '<y@host>' })).toBe(':<y@host>'); // no folder
    expect(getMessageKey({ 'Message-ID': '<z@host>', folder: 'Sent' })).toBe('Sent:<z@host>');
    expect(getMessageKey({ header_message_id: '<h@host>', folder: 'A' })).toBe('A:<h@host>');
  });

  it('scopes Message-ID by folder so forwarded copies do not collapse', () => {
    const a = getMessageKey({ message_id: '<same@host>', folder: 'INBOX' });
    const b = getMessageKey({ message_id: '<same@host>', folder: 'Archive' });
    expect(a).not.toBe(b);
  });

  it('returns null when nothing identifies the message', () => {
    expect(getMessageKey({})).toBeNull();
    expect(getMessageKey(null)).toBeNull();
    expect(getMessageKey(undefined)).toBeNull();
  });
});

describe('mergeMessagePages', () => {
  it('concatenates with existing first, dropping incoming duplicates by key', () => {
    const existing = [{ id: 'a' }, { id: 'b' }];
    const incoming = [{ id: 'b' }, { id: 'c' }];
    expect(mergeMessagePages(existing, incoming)).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  });

  it('keeps the existing copy when a key collides (first write wins)', () => {
    const existing = [{ id: 'a', from: 'old' }];
    const incoming = [{ id: 'a', from: 'new' }];
    expect(mergeMessagePages(existing, incoming)).toEqual([{ id: 'a', from: 'old' }]);
  });

  it('always keeps messages with no derivable key', () => {
    const a = { subject: 'one' };
    const b = { subject: 'two' };
    expect(mergeMessagePages([a], [b])).toEqual([a, b]);
  });

  it('dedups within a single page too', () => {
    expect(mergeMessagePages([{ id: 'a' }, { id: 'a' }], [])).toEqual([{ id: 'a' }]);
  });

  it('handles empty/omitted arguments', () => {
    expect(mergeMessagePages()).toEqual([]);
    expect(mergeMessagePages([], [])).toEqual([]);
    expect(mergeMessagePages([{ id: 'a' }])).toEqual([{ id: 'a' }]);
  });

  it('does not cap when max is omitted or non-positive', () => {
    const existing = [{ id: 'a' }, { id: 'b' }];
    const incoming = [{ id: 'c' }, { id: 'd' }];
    const all = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    expect(mergeMessagePages(existing, incoming)).toEqual(all);
    expect(mergeMessagePages(existing, incoming, 0)).toEqual(all);
    expect(mergeMessagePages(existing, incoming, -5)).toEqual(all);
  });

  it('caps to the last `max` entries, dropping the head (newest, scrolled-past)', () => {
    // existing = pages already loaded (head), incoming = the page just scrolled
    // into view (tail). Capping keeps the tail window the user is looking at.
    const existing = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const incoming = [{ id: 'd' }, { id: 'e' }];
    expect(mergeMessagePages(existing, incoming, 2)).toEqual([{ id: 'd' }, { id: 'e' }]);
    expect(mergeMessagePages(existing, incoming, 4)).toEqual([
      { id: 'b' },
      { id: 'c' },
      { id: 'd' },
      { id: 'e' },
    ]);
  });

  it('does not cap when the merged length is within max', () => {
    const existing = [{ id: 'a' }];
    const incoming = [{ id: 'b' }];
    expect(mergeMessagePages(existing, incoming, 5)).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('caps after de-duplication, not before', () => {
    // 'b' is a duplicate, so the deduped merge is [a, b, c] (length 3); a cap of
    // 2 then keeps the last two of the DEDUPED list.
    const existing = [{ id: 'a' }, { id: 'b' }];
    const incoming = [{ id: 'b' }, { id: 'c' }];
    expect(mergeMessagePages(existing, incoming, 2)).toEqual([{ id: 'b' }, { id: 'c' }]);
  });
});

describe('mergeMissingLabels', () => {
  it('does not hit the cache when every message has trusted labels', async () => {
    const bulkGet = mockBulkGet({});
    const list = [{ id: '1', labels: ['a'] }];
    const out = await mergeMissingLabels(bulkGet, 'acct', list, [true]);
    expect(out).toBe(list); // unchanged, same reference
    expect(bulkGet).not.toHaveBeenCalled();
  });

  it('backfills labels from the cached record (keyed by [account, id])', async () => {
    const bulkGet = mockBulkGet({ '1': { labels: ['work', 'home'] } });
    const out = await mergeMissingLabels(bulkGet, 'acct', [{ id: '1' }], [false]);
    expect(out).toEqual([{ id: '1', labels: ['work', 'home'] }]);
    expect(bulkGet).toHaveBeenCalledWith([['acct', '1']]);
  });

  it('falls back to an alternate identifier (uid) when the id record has no labels', async () => {
    const bulkGet = mockBulkGet({ '1': { labels: [] }, U1: { labels: ['fromUid'] } });
    const out = await mergeMissingLabels(bulkGet, 'acct', [{ id: '1', uid: 'U1' }], [false]);
    expect(out).toEqual([{ id: '1', uid: 'U1', labels: ['fromUid'] }]);
  });

  it('treats a falsy labelPresence as "incoming labels not authoritative" and prefers the cache', async () => {
    // labelPresence omitted -> [] -> every entry looked up; cache labels win.
    const bulkGet = mockBulkGet({ '1': { labels: ['cached'] } });
    const out = await mergeMissingLabels(bulkGet, 'acct', [{ id: '1', labels: ['incoming'] }]);
    expect(out).toEqual([{ id: '1', labels: ['cached'] }]);
  });

  it('leaves the message untouched when the cache has nothing useful', async () => {
    const bulkGet = mockBulkGet({}); // record undefined
    const out = await mergeMissingLabels(bulkGet, 'acct', [{ id: '1' }], [false]);
    expect(out).toEqual([{ id: '1' }]);
  });

  it('returns the original list on a bulkGet error', async () => {
    const bulkGet = vi.fn(() => Promise.reject(new Error('db dead')));
    const list = [{ id: '1' }];
    const out = await mergeMissingLabels(bulkGet, 'acct', list, [false]);
    expect(out).toBe(list);
  });

  it('only looks up the messages that are missing/untrusted labels', async () => {
    const bulkGet = mockBulkGet({ '2': { labels: ['x'] } });
    const list = [{ id: '1', labels: ['a'] }, { id: '2' }];
    const out = await mergeMissingLabels(bulkGet, 'acct', list, [true, false]);
    expect(out).toEqual([
      { id: '1', labels: ['a'] },
      { id: '2', labels: ['x'] },
    ]);
    expect(bulkGet).toHaveBeenCalledWith([['acct', '2']]); // not id '1'
  });
});

describe('mergeMissingFrom', () => {
  it('does not hit the cache when every message has a from', async () => {
    const bulkGet = mockBulkGet({});
    const list = [{ id: '1', from: 'a@b.com' }];
    const out = await mergeMissingFrom(bulkGet, 'acct', list);
    expect(out).toBe(list);
    expect(bulkGet).not.toHaveBeenCalled();
  });

  it('backfills from from the cached record', async () => {
    const bulkGet = mockBulkGet({ '1': { from: 'alice@x.com' } });
    const out = await mergeMissingFrom(bulkGet, 'acct', [{ id: '1', from: '' }]);
    expect(out).toEqual([{ id: '1', from: 'alice@x.com' }]);
  });

  it('falls back to an alternate identifier when the id record has no from', async () => {
    const bulkGet = mockBulkGet({ '1': { from: '   ' }, M1: { from: 'bob@x.com' } });
    const out = await mergeMissingFrom(bulkGet, 'acct', [{ id: '1', message_id: 'M1' }]);
    expect(out).toEqual([{ id: '1', message_id: 'M1', from: 'bob@x.com' }]);
  });

  it('returns the original list on a bulkGet error', async () => {
    const bulkGet = vi.fn(() => Promise.reject(new Error('db dead')));
    const list = [{ id: '1', from: '' }];
    const out = await mergeMissingFrom(bulkGet, 'acct', list);
    expect(out).toBe(list);
  });
});
