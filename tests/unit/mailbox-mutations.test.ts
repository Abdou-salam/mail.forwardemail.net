/**
 * mailboxStore mutation tests — data-integrity paths.
 *
 * deleteMessage applies an OPTIMISTIC removal from the store + IDB, then syncs
 * to the server, and on failure queues a retry mutation. Getting this wrong
 * loses or resurrects mail. Pin the four branches: optimistic remove, online
 * success (no queue), offline (queue, no network), server-error (queue retry),
 * and the 404-as-success special case (no queue).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get, writable } from 'svelte/store';

const h = vi.hoisted(() => ({
  online: true,
  remoteRequest: vi.fn().mockResolvedValue({}),
  queueMutation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/utils/demo-mode', () => ({
  isDemoMode: () => false,
  interceptDemoRequest: () => ({ handled: false }),
}));
vi.mock('../../src/utils/network-status', () => ({ isOnline: () => h.online }));
vi.mock('../../src/utils/remote', () => ({
  Remote: { request: (...a: unknown[]) => h.remoteRequest(...a) },
}));
vi.mock('../../src/utils/mutation-queue', () => ({
  queueMutation: (...a: unknown[]) => h.queueMutation(...a),
  getQueuedMessageIds: vi.fn().mockResolvedValue(new Set()),
}));
vi.mock('../../src/utils/db', () => {
  const delChain = { delete: vi.fn().mockResolvedValue(undefined) };
  return {
    db: {
      messages: { where: () => ({ equals: () => delChain }) },
      messageBodies: { where: () => ({ equals: () => delChain }) },
      folders: { where: () => ({ equals: () => ({ toArray: async () => [] }) }) },
      transaction: vi.fn().mockResolvedValue(undefined),
    },
  };
});
// shared boilerplate to make the store module importable
vi.mock('../../src/stores/mailboxActions', () => ({ selectedConversation: writable(null) }));
vi.mock('../../src/utils/auth', () => ({ getAuthHeader: vi.fn(() => 'auth') }));
vi.mock('../../src/utils/storage', () => ({
  Local: { get: vi.fn(() => 'me@test.com'), set: vi.fn(), remove: vi.fn() },
  Session: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
  Accounts: { getAll: () => [], getActive: () => null, setActive: vi.fn() },
}));
vi.mock('../../src/utils/sync-worker-client.js', () => ({
  sendSyncRequest: vi.fn().mockRejectedValue(new Error('no worker')),
  onSyncTaskComplete: vi.fn(),
}));
vi.mock('../../src/utils/cache-manager', () => ({ cacheManager: { get: vi.fn(), set: vi.fn() } }));
vi.mock('../../src/utils/sync-settings', () => ({ getSyncSettings: vi.fn(() => ({})) }));
vi.mock('../../src/utils/perf-logger.ts', () => ({
  createPerfTracer: () => ({ stage: vi.fn(), end: vi.fn() }),
}));
vi.mock('../../src/utils/logger.ts', () => ({ warn: vi.fn(), log: vi.fn(), error: vi.fn() }));
vi.mock('../../src/utils/sync-helpers', () => ({
  getMessageApiId: (m: { id?: string; apiId?: string }) => m?.apiId ?? m?.id ?? null,
  normalizeMessageForCache: (m: unknown) => m,
}));
vi.mock('../../src/stores/searchStore', () => ({
  searchStore: {
    actions: {
      indexMessages: vi.fn(),
      removeFromIndex: vi.fn().mockResolvedValue(undefined),
      setIncludeBody: vi.fn(),
    },
  },
}));
vi.mock('../../src/stores/settingsStore', () => ({
  getEffectiveSettingValue: vi.fn(() => undefined),
  effectiveLayoutMode: writable('list'),
}));
vi.mock('../../src/stores/settingsRegistry', () => ({
  normalizeLayoutMode: (m: string) => m ?? 'list',
}));

import { mailboxStore } from '../../src/stores/mailboxStore';
import { messages, selectedMessage } from '../../src/stores/messageStore';

// A message already in Trash so deleteMessage takes the DELETE-API path
// (otherwise it delegates to a move-to-Trash).
const trashMsg = () => ({
  id: 'm1',
  apiId: 'api-1',
  account: 'me@test.com',
  folder: 'TRASH',
  is_unread: false,
});

beforeEach(() => {
  h.online = true;
  h.remoteRequest.mockReset().mockResolvedValue({});
  h.queueMutation.mockClear();
  messages.set([trashMsg(), { id: 'm2', account: 'me@test.com', folder: 'TRASH' }] as never);
  selectedMessage.set(trashMsg() as never);
});

// `messages` is a deferredWritable: when the array SHRINKS (a removal) the set
// is deferred to requestAnimationFrame (a macOS-WebKit use-after-free
// workaround), so flush one frame before reading it.
const flushRaf = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));

describe('deleteMessage (permanent / already in Trash)', () => {
  it('optimistically removes the message and clears selection', async () => {
    await mailboxStore.actions.deleteMessage(trashMsg(), { permanent: true });
    await flushRaf();
    expect((get(messages) as Array<{ id: string }>).map((m) => m.id)).toEqual(['m2']);
    expect(get(selectedMessage)).toBeNull();
  });

  it('online success calls MessageDelete and does NOT queue', async () => {
    await mailboxStore.actions.deleteMessage(trashMsg(), { permanent: true });
    expect(h.remoteRequest).toHaveBeenCalledWith(
      'MessageDelete',
      {},
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(h.queueMutation).not.toHaveBeenCalled();
  });

  it('offline queues the delete and skips the network', async () => {
    h.online = false;
    await mailboxStore.actions.deleteMessage(trashMsg(), { permanent: true });
    expect(h.remoteRequest).not.toHaveBeenCalled();
    expect(h.queueMutation).toHaveBeenCalledWith(
      'delete',
      expect.objectContaining({ messageId: 'api-1', permanent: true }),
    );
  });

  it('a server error queues the delete for retry', async () => {
    h.remoteRequest.mockRejectedValue(Object.assign(new Error('500'), { status: 500 }));
    await mailboxStore.actions.deleteMessage(trashMsg(), { permanent: true });
    expect(h.queueMutation).toHaveBeenCalledWith('delete', expect.anything());
  });

  it('a 404 is treated as already-deleted (no queue)', async () => {
    h.remoteRequest.mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }));
    await mailboxStore.actions.deleteMessage(trashMsg(), { permanent: true });
    expect(h.remoteRequest).toHaveBeenCalled();
    expect(h.queueMutation).not.toHaveBeenCalled();
  });
});
