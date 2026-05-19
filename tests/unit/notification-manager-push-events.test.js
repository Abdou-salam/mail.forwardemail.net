/**
 * Notification Manager – Push Event Listener Tests
 *
 * Verifies that the 'fe:push-notification' DOM event listener added by
 * connectNotifications() correctly routes push payloads through the same
 * handlers as WebSocket events.
 */

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('../../src/utils/platform.js', () => ({
  isTauri: false,
}));
vi.mock('../../src/utils/notification-bridge.js', () => ({
  notify: vi.fn(() => Promise.resolve()),
  requestPermission: vi.fn(() => Promise.resolve('granted')),
}));
vi.mock('../../src/utils/tauri-bridge.js', () => ({
  setBadgeCount: vi.fn(),
}));
vi.mock('../../src/utils/favicon-badge.js', () => ({
  updateFaviconBadge: vi.fn(),
}));
vi.mock('../../src/utils/remote.js', () => ({
  Remote: { request: vi.fn() },
}));
vi.mock('../../src/utils/sync-helpers.ts', () => ({
  extractFromField: vi.fn(() => ''),
}));
vi.mock('../../src/stores/mailboxStore', () => ({
  mailboxStore: {
    state: {
      folders: { subscribe: (fn) => (fn([]), () => {}) },
    },
    actions: {
      getSentFolderPath: () => 'Sent',
      getDraftsFolderPath: () => 'Drafts',
    },
  },
}));
vi.mock('../../src/utils/websocket-client', () => ({
  WS_EVENTS: {
    NEW_MESSAGE: 'newMessage',
    FLAGS_UPDATED: 'flagsUpdated',
    MESSAGES_EXPUNGED: 'messagesExpunged',
    MAILBOX_CREATED: 'mailboxCreated',
    MAILBOX_DELETED: 'mailboxDeleted',
    MAILBOX_RENAMED: 'mailboxRenamed',
    CALENDAR_EVENT_CREATED: 'calendarEventCreated',
    CALENDAR_EVENT_UPDATED: 'calendarEventUpdated',
    CONTACT_CREATED: 'contactCreated',
    CONTACT_UPDATED: 'contactUpdated',
    NEW_RELEASE: 'newRelease',
  },
}));
vi.mock('../../src/utils/demo-mode.js', () => ({
  isDemoMode: vi.fn(() => false),
}));
vi.mock('../../src/utils/storage.js', () => ({
  Local: { get: vi.fn(() => 'user@example.com') },
}));
vi.mock('../../src/utils/mime-utils.js', () => ({
  decodeMimeHeader: vi.fn((v) => v),
}));
vi.mock('../../src/utils/address.ts', () => ({
  extractEmail: vi.fn((v) => (typeof v === 'string' ? v : '')),
}));

import {
  connectNotifications,
  requestNotificationPermission,
  getBadgeCount,
  setBadgeCount,
} from '../../src/utils/notification-manager.js';
import { notify } from '../../src/utils/notification-bridge.js';

// ── Helpers ───────────────────────────────────────────────────────────────

function createMockWsClient() {
  const listeners = {};
  return {
    on(event, handler) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
      return () => {
        listeners[event] = listeners[event].filter((h) => h !== handler);
      };
    },
    emit(event, data) {
      for (const handler of listeners[event] || []) handler(data);
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('notification-manager push event listener', () => {
  let wsClient;
  let cleanup;

  beforeEach(async () => {
    vi.clearAllMocks();
    await setBadgeCount(0);
    await requestNotificationPermission();
    wsClient = createMockWsClient();
    cleanup = connectNotifications(wsClient);
  });

  afterEach(() => {
    if (cleanup) cleanup();
  });

  it('registers a window event listener for fe:push-notification', () => {
    const spy = vi.spyOn(window, 'removeEventListener');
    cleanup();
    cleanup = null;
    // Cleanup should remove the push event listener
    expect(spy).toHaveBeenCalledWith('fe:push-notification', expect.any(Function));
    spy.mockRestore();
  });

  it('routes push newMessage events through handleNewMessage', async () => {
    window.dispatchEvent(
      new CustomEvent('fe:push-notification', {
        detail: {
          event: 'newMessage',
          mailbox: 'INBOX',
          message: {
            uid: 'push-123',
            from: { text: 'Push Sender <push@example.com>' },
            subject: 'Push notification test',
          },
        },
      }),
    );

    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalled();
    });

    const call = notify.mock.calls[0][0];
    expect(call.title).toContain('Push Sender');
    expect(call.body).toContain('Push notification test');
  });

  it('routes push flagsUpdated events to update badge', async () => {
    await setBadgeCount(5);

    window.dispatchEvent(
      new CustomEvent('fe:push-notification', {
        detail: {
          event: 'flagsUpdated',
          action: 'add',
          flags: ['\\Seen'],
        },
      }),
    );

    // Badge should decrement
    await vi.waitFor(() => {
      expect(getBadgeCount()).toBe(4);
    });
  });

  it('routes push mailboxCreated events', async () => {
    window.dispatchEvent(
      new CustomEvent('fe:push-notification', {
        detail: {
          event: 'mailboxCreated',
          path: 'NewFolder',
        },
      }),
    );

    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalled();
    });

    const call = notify.mock.calls[0][0];
    expect(call.title).toBe('Folder Created');
    expect(call.body).toContain('NewFolder');
  });

  it('routes push calendarEventCreated events', async () => {
    window.dispatchEvent(
      new CustomEvent('fe:push-notification', {
        detail: {
          event: 'calendarEventCreated',
          summary: 'Team Meeting',
          id: 'cal-push-1',
        },
      }),
    );

    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalled();
    });

    const call = notify.mock.calls[0][0];
    expect(call.title).toBe('Calendar Event Created');
    expect(call.body).toContain('Team Meeting');
  });

  it('ignores push events with missing event field', () => {
    window.dispatchEvent(
      new CustomEvent('fe:push-notification', {
        detail: { data: 'no event field' },
      }),
    );

    expect(notify).not.toHaveBeenCalled();
  });

  it('ignores push events with non-string event field', () => {
    window.dispatchEvent(
      new CustomEvent('fe:push-notification', {
        detail: { event: 123 },
      }),
    );

    expect(notify).not.toHaveBeenCalled();
  });

  it('ignores push events with unknown event type', () => {
    window.dispatchEvent(
      new CustomEvent('fe:push-notification', {
        detail: { event: 'unknownEvent' },
      }),
    );

    expect(notify).not.toHaveBeenCalled();
  });

  it('ignores push events with null detail', () => {
    window.dispatchEvent(
      new CustomEvent('fe:push-notification', {
        detail: null,
      }),
    );

    expect(notify).not.toHaveBeenCalled();
  });

  it('removes push listener on cleanup', () => {
    cleanup();
    cleanup = null;

    // After cleanup, dispatching should not trigger notifications
    window.dispatchEvent(
      new CustomEvent('fe:push-notification', {
        detail: {
          event: 'mailboxCreated',
          path: 'ShouldNotNotify',
        },
      }),
    );

    expect(notify).not.toHaveBeenCalled();
  });
});
