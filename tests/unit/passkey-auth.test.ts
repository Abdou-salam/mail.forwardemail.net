/**
 * passkey-auth unit tests.
 *
 * The WebAuthn register/authenticate ceremonies need a real authenticator and
 * belong to e2e/manual testing, but the supporting pure logic is unit-testable:
 * feature detection, the base64url challenge format, and the localStorage-backed
 * credential storage helpers.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  isWebAuthnAvailable,
  generateChallenge,
  hasPasskeyCredential,
  getStoredCredential,
  removePasskeyCredential,
} from '../../src/utils/passkey-auth.js';

const CRED_KEY = 'webmail_passkey_credential';

beforeEach(() => localStorage.clear());
afterEach(() => {
  // @ts-expect-error clean up the optional WebAuthn global between tests
  delete window.PublicKeyCredential;
});

describe('isWebAuthnAvailable', () => {
  it('is false without PublicKeyCredential (jsdom default)', () => {
    expect(isWebAuthnAvailable()).toBe(false);
  });
  it('is true when the WebAuthn globals are present', () => {
    // @ts-expect-error minimal stub of the WebAuthn global
    window.PublicKeyCredential = function () {};
    if (typeof navigator.credentials === 'undefined') {
      Object.defineProperty(navigator, 'credentials', { configurable: true, value: {} });
    }
    expect(isWebAuthnAvailable()).toBe(true);
  });
});

describe('generateChallenge', () => {
  it('returns a 32-byte base64url challenge (URL-safe, unpadded)', async () => {
    const c = await generateChallenge();
    expect(typeof c).toBe('string');
    expect(c).not.toContain('='); // unpadded
    expect(c).not.toMatch(/[+/]/); // URL-safe alphabet only
    expect(c).toMatch(/^[A-Za-z0-9_-]+$/);
    // 32 bytes → 43 base64 chars without padding
    expect(c.length).toBe(43);
  });

  it('is random per call', async () => {
    expect(await generateChallenge()).not.toBe(await generateChallenge());
  });
});

describe('credential storage helpers', () => {
  it('reports no credential when storage is empty', () => {
    expect(hasPasskeyCredential()).toBe(false);
    expect(getStoredCredential()).toBeNull();
  });

  it('reads back a stored credential and clears it on remove', () => {
    localStorage.setItem(CRED_KEY, JSON.stringify({ id: 'cred-1', algorithm: 'ES256' }));
    expect(hasPasskeyCredential()).toBe(true);
    expect(getStoredCredential()).toMatchObject({ id: 'cred-1' });

    removePasskeyCredential();
    expect(hasPasskeyCredential()).toBe(false);
    expect(getStoredCredential()).toBeNull();
  });

  it('returns null for a corrupt stored credential instead of throwing', () => {
    localStorage.setItem(CRED_KEY, '{not valid json');
    expect(getStoredCredential()).toBeNull();
  });
});
