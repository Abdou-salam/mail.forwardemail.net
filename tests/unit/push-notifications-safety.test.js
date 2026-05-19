/**
 * Push Notifications – Safety & Platform Guard Tests
 *
 * Verifies that push notification initialization:
 *   - Is a no-op on non-mobile platforms (desktop, web browser)
 *   - Is a no-op when no auth token is provided
 *   - Is idempotent (calling init twice doesn't double-register)
 *   - Handles errors gracefully without throwing
 *   - Properly cleans up on sign-out
 */

// ── Mocks (factories must be self-contained for vi.mock hoisting) ─────────

vi.mock('../../src/utils/platform.js', () => ({
  isTauriMobile: false,
}));

vi.mock('../../src/utils/background-service.js', () => ({
  registerPushToken: vi.fn(() => Promise.resolve(true)),
  unregisterPushToken: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../src/utils/unified-push.js', () => ({
  isUnifiedPushAvailable: vi.fn(() => Promise.resolve(false)),
  registerUnifiedPush: vi.fn(() => Promise.resolve(null)),
  unregisterUnifiedPush: vi.fn(() => Promise.resolve()),
  initUnifiedPushListener: vi.fn(() => Promise.resolve()),
  isUnifiedPushRegistered: vi.fn(() => false),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock('../../src/utils/storage.js', () => ({
  Local: { get: vi.fn(() => null) },
}));

import {
  initPushNotifications,
  cleanupPushNotifications,
  isPushInitialized,
  handlePushPayload,
} from '../../src/utils/push-notifications.js';
import { registerPushToken, unregisterPushToken } from '../../src/utils/background-service.js';

// ── Tests ─────────────────────────────────────────────────────────────────

describe('push-notifications safety guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset initialized state between tests
    cleanupPushNotifications(null);
  });

  describe('platform guards (isTauriMobile = false)', () => {
    it('returns false on non-mobile platforms (desktop/web)', async () => {
      const result = await initPushNotifications({ authToken: 'test-token' });
      expect(result).toBe(false);
      expect(registerPushToken).not.toHaveBeenCalled();
    });

    it('does not attempt registration without auth token', async () => {
      const result = await initPushNotifications({});
      expect(result).toBe(false);
      expect(registerPushToken).not.toHaveBeenCalled();
    });

    it('does not attempt registration with empty auth token', async () => {
      const result = await initPushNotifications({ authToken: '' });
      expect(result).toBe(false);
      expect(registerPushToken).not.toHaveBeenCalled();
    });

    it('does not attempt registration with no options', async () => {
      const result = await initPushNotifications();
      expect(result).toBe(false);
      expect(registerPushToken).not.toHaveBeenCalled();
    });

    it('does not throw when called multiple times', async () => {
      const result1 = await initPushNotifications({ authToken: 'test' });
      const result2 = await initPushNotifications({ authToken: 'test' });
      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('calls unregisterPushToken on cleanup with auth', async () => {
      await cleanupPushNotifications('my-auth-token');
      expect(unregisterPushToken).toHaveBeenCalledWith('my-auth-token');
    });

    it('does not call unregister without auth token', async () => {
      await cleanupPushNotifications(null);
      expect(unregisterPushToken).not.toHaveBeenCalled();
    });

    it('resets initialized state on cleanup', async () => {
      await cleanupPushNotifications('token');
      expect(isPushInitialized()).toBe(false);
    });

    it('is safe to call cleanup multiple times', async () => {
      await cleanupPushNotifications('token');
      await cleanupPushNotifications('token');
      expect(isPushInitialized()).toBe(false);
    });
  });

  describe('handlePushPayload validation', () => {
    it('returns null for null payload', () => {
      expect(handlePushPayload(null)).toBeNull();
    });

    it('returns null for non-object payload', () => {
      expect(handlePushPayload('string')).toBeNull();
      expect(handlePushPayload(42)).toBeNull();
      expect(handlePushPayload(undefined)).toBeNull();
    });

    it('returns null for payload without type', () => {
      expect(handlePushPayload({ data: { foo: 'bar' } })).toBeNull();
    });

    it('returns null for unknown type', () => {
      expect(handlePushPayload({ type: 'unknown-event' })).toBeNull();
    });

    it('routes new-message with uid to inbox', () => {
      const result = handlePushPayload({ type: 'new-message', uid: '12345' });
      expect(result).toEqual({ action: 'navigate', path: '#INBOX/12345' });
    });

    it('routes new-message without uid to INBOX', () => {
      const result = handlePushPayload({ type: 'new-message' });
      expect(result).toEqual({ action: 'navigate', path: '#INBOX' });
    });

    it('routes new-message with custom mailbox', () => {
      const result = handlePushPayload({
        type: 'new-message',
        uid: '99',
        mailbox: 'Archive',
      });
      expect(result).toEqual({ action: 'navigate', path: '#Archive/99' });
    });

    it('routes calendar-event with id', () => {
      const result = handlePushPayload({
        type: 'calendar-event',
        data: { id: 'evt-1' },
      });
      expect(result).toEqual({ action: 'navigate', path: '/calendar#event=evt-1' });
    });

    it('routes calendar-task with uid', () => {
      const result = handlePushPayload({
        type: 'calendar-task',
        uid: 'task-1',
      });
      expect(result).toEqual({ action: 'navigate', path: '/calendar#task=task-1' });
    });

    it('routes contact-created with id', () => {
      const result = handlePushPayload({
        type: 'contact-created',
        data: { contact_id: 'c-1' },
      });
      expect(result).toEqual({ action: 'navigate', path: '/contacts#contact=c-1' });
    });

    it('routes note-update', () => {
      const result = handlePushPayload({ type: 'note-update' });
      expect(result).toEqual({ action: 'navigate', path: '#notes' });
    });

    it('handles XSS attempts in payload fields safely', () => {
      const result = handlePushPayload({
        type: 'new-message',
        uid: '<script>alert(1)</script>',
        mailbox: 'INBOX',
      });
      expect(result).toHaveProperty('action', 'navigate');
      expect(result.path).toContain('#INBOX/');
    });
  });
});
