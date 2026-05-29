import { describe, it, expect, beforeEach } from 'vitest';
import {
  folderMessageCache,
  MAX_FOLDER_MESSAGE_CACHE,
} from '../../src/stores/folder-message-cache';

// A representative cache entry: a processed page of messages ready for display,
// the same shape mailboxStore stores under each "account:folder:page" key.
const entry = (n: number) => ({
  messages: Array.from({ length: 25 }, (_, i) => ({ id: `m${n}-${i}` })),
  hasNextPage: false,
});

describe('folderMessageCache (bounded in-memory list cache)', () => {
  beforeEach(() => folderMessageCache.clear());

  it('stays bounded under sustained folder/page churn', () => {
    // Simulate a long session: many distinct folders/pages across accounts.
    // A plain Map would grow to MAX_FOLDER_MESSAGE_CACHE * 10 here (a leak).
    for (let i = 0; i < MAX_FOLDER_MESSAGE_CACHE * 10; i++) {
      folderMessageCache.set(`acct:folder${i}:1`, entry(i));
    }
    expect(folderMessageCache.size).toBeLessThanOrEqual(MAX_FOLDER_MESSAGE_CACHE);
  });

  it('evicts the least-recently-used entry first (read promotes recency)', () => {
    for (let i = 0; i < MAX_FOLDER_MESSAGE_CACHE; i++) {
      folderMessageCache.set(`k${i}`, entry(i));
    }
    // Touch k0 so it becomes most-recently-used (the page the user is viewing).
    folderMessageCache.get('k0');
    // One more insert should evict k1 (now the oldest), not the just-read k0.
    folderMessageCache.set('k-new', entry(999));

    expect(folderMessageCache.has('k0')).toBe(true);
    expect(folderMessageCache.has('k1')).toBe(false);
    expect(folderMessageCache.has('k-new')).toBe(true);
    expect(folderMessageCache.size).toBe(MAX_FOLDER_MESSAGE_CACHE);
  });

  it('retains the most-recently-set entries, drops the oldest', () => {
    for (let i = 0; i < MAX_FOLDER_MESSAGE_CACHE * 2; i++) {
      folderMessageCache.set(`p${i}`, entry(i));
    }
    expect(folderMessageCache.has('p0')).toBe(false);
    expect(folderMessageCache.has(`p${MAX_FOLDER_MESSAGE_CACHE * 2 - 1}`)).toBe(true);
  });

  it('re-setting an existing key refreshes recency without growing size', () => {
    for (let i = 0; i < MAX_FOLDER_MESSAGE_CACHE; i++) {
      folderMessageCache.set(`r${i}`, entry(i));
    }
    folderMessageCache.set('r0', entry(0)); // refresh the oldest -> now newest
    folderMessageCache.set('r-extra', entry(1000)); // should evict r1, not r0

    expect(folderMessageCache.size).toBe(MAX_FOLDER_MESSAGE_CACHE);
    expect(folderMessageCache.has('r0')).toBe(true);
    expect(folderMessageCache.has('r1')).toBe(false);
  });

  it('still behaves like a Map for get/has/delete/clear/keys', () => {
    folderMessageCache.set('a:b:1', entry(1));
    expect(folderMessageCache.get('a:b:1')?.messages).toHaveLength(25);
    expect(folderMessageCache.has('a:b:1')).toBe(true);
    expect([...folderMessageCache.keys()]).toContain('a:b:1');

    folderMessageCache.delete('a:b:1');
    expect(folderMessageCache.has('a:b:1')).toBe(false);

    folderMessageCache.set('x', entry(2));
    folderMessageCache.clear();
    expect(folderMessageCache.size).toBe(0);
  });
});
