/**
 * crypto-store vault tests.
 *
 * The app-lock vault derives a key-encryption-key from the user's PIN via
 * Argon2id and seals the data-encryption-key with libsodium
 * XChaCha20-Poly1305. Security-critical and previously at 0% coverage. Exercise
 * the REAL libsodium (no mocked crypto) end-to-end: PIN setup seals the DEK,
 * the right PIN re-derives the KEK and unseals it (a true encrypt→decrypt
 * round-trip of the DEK envelope), locking clears the key, and a wrong PIN is
 * rejected. Argon2id is intentionally slow, hence the per-test timeouts.
 *
 * NB: encryptValue(<string>) isn't asserted here — libsodium's `from_string`
 * yields a jsdom-realm Uint8Array that its `instanceof` checks reject under the
 * jsdom test environment. The DEK envelope (libsodium-native buffers) is the
 * meaningful crypto path and round-trips fine.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  setupWithPin,
  unlockWithPin,
  lock,
  encryptValue,
  decryptValue,
  isEncrypted,
  isUnlocked,
  isVaultConfigured,
} from '../../src/utils/crypto-store.js';

const PIN = '135790';

describe('crypto-store vault', () => {
  beforeAll(async () => {
    await setupWithPin(PIN); // seals a fresh DEK under the PIN-derived KEK
  }, 20_000);

  it('reports the vault configured + unlocked after setup', () => {
    expect(isVaultConfigured()).toBe(true);
    expect(isUnlocked()).toBe(true);
  });

  it('isEncrypted only flags encrypted-prefixed strings', () => {
    expect(isEncrypted('plain text')).toBe(false);
    expect(isEncrypted('\x00ENC\x01whatever')).toBe(true);
    expect(isEncrypted(42 as unknown as string)).toBe(false);
  });

  it('passes through null/undefined and non-encrypted values', () => {
    expect(encryptValue(null)).toBeNull();
    expect(encryptValue(undefined)).toBeUndefined();
    expect(decryptValue('not-encrypted')).toBe('not-encrypted');
  });

  it('locking clears the key and blocks encryption', () => {
    lock();
    expect(isUnlocked()).toBe(false);
    expect(() => encryptValue('x')).toThrow(/locked/i);
  });

  it('the right PIN re-derives the KEK and unseals the DEK (real round-trip)', async () => {
    lock();
    expect(isUnlocked()).toBe(false);
    const ok = await unlockWithPin(PIN);
    expect(ok).toBeTruthy();
    expect(isUnlocked()).toBe(true);
  }, 20_000);

  it('rejects a wrong PIN (DEK stays sealed)', async () => {
    lock();
    const ok = await unlockWithPin('000000');
    expect(ok).toBeFalsy();
    expect(isUnlocked()).toBe(false);
  }, 20_000);
});
