/**
 * db-crypto unit tests.
 *
 * The at-rest envelope layer for the IndexedDB cache: whole-record AES-GCM
 * sealing with per-table plaintext allowlists (queried index fields), legacy
 * plaintext passthrough, and fail-closed writes while the vault is locked.
 * Context-agnostic by design (runs in the db worker or on the main thread),
 * so it is tested directly against WebCrypto with no mocks.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { webcrypto } from 'node:crypto';
import {
  configureDbCrypto,
  sealRecord,
  openRecord,
  sealRecords,
  openRecords,
  recordIsSensitive,
  changesTouchSensitiveFields,
  isDbCryptoActive,
  DbLockedError,
} from '../../src/utils/db-crypto';

beforeAll(() => {
  // jsdom lacks crypto.subtle; use Node's WebCrypto implementation.
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  }
});

const KEY = new Uint8Array(32).fill(7);

const message = () => ({
  account: 'a@example.com',
  id: 'm1',
  folder: 'INBOX',
  date: 1700000000000,
  is_unread: true,
  subject: 'Quarterly numbers',
  from: 'boss@example.com',
  snippet: 'Please review before…',
});

describe('db-crypto', () => {
  beforeEach(async () => {
    await configureDbCrypto({ required: false, rawKey: null });
  });

  it('is inert when unconfigured: records pass through untouched', async () => {
    const rec = message();
    expect(isDbCryptoActive()).toBe(false);
    expect(await sealRecord('messages', rec)).toBe(rec);
    expect(await openRecord('messages', rec)).toBe(rec);
  });

  it('seals sensitive fields and preserves queried index fields', async () => {
    await configureDbCrypto({ required: true, rawKey: KEY });
    const sealed = (await sealRecord('messages', message())) as Record<string, unknown>;

    // Index fields the app actually queries stay plaintext…
    expect(sealed.account).toBe('a@example.com');
    expect(sealed.id).toBe('m1');
    expect(sealed.folder).toBe('INBOX');
    expect(sealed.date).toBe(1700000000000);
    expect(sealed.is_unread).toBe(true);
    // …content fields do not.
    expect(sealed.subject).toBeUndefined();
    expect(sealed.from).toBeUndefined();
    expect(sealed.snippet).toBeUndefined();
    expect(sealed._enc).toMatchObject({ v: 1 });

    const opened = await openRecord('messages', sealed);
    expect(opened).toEqual(message());
  });

  it('round-trips messageBodies including large body content', async () => {
    await configureDbCrypto({ required: true, rawKey: KEY });
    const body = {
      account: 'a@example.com',
      id: 'm1',
      folder: 'INBOX',
      body: '<html>' + 'secret '.repeat(5000) + '</html>',
      textContent: 'secret text',
      attachments: [{ filename: 'doc.pdf', size: 1234 }],
      updatedAt: 1,
    };
    const sealed = (await sealRecord('messageBodies', body)) as Record<string, unknown>;
    expect(sealed.body).toBeUndefined();
    expect(sealed.textContent).toBeUndefined();
    expect(sealed.attachments).toBeUndefined();
    expect(await openRecord('messageBodies', sealed)).toEqual(body);
  });

  it('passes legacy plaintext records through reads unchanged', async () => {
    await configureDbCrypto({ required: true, rawKey: KEY });
    const legacy = message();
    expect(await openRecord('messages', legacy)).toBe(legacy);
  });

  it('fails closed: sensitive writes throw while required and locked', async () => {
    await configureDbCrypto({ required: true, rawKey: null });
    await expect(sealRecord('messages', message())).rejects.toBeInstanceOf(DbLockedError);
    // Non-sensitive tables are unaffected.
    const folder = { account: 'a', path: 'INBOX', unread_count: 3 };
    expect(await sealRecord('folders', folder)).toBe(folder);
  });

  it('strips (never leaks) sealed fields when reading while locked', async () => {
    await configureDbCrypto({ required: true, rawKey: KEY });
    const sealed = (await sealRecord('messages', message())) as Record<string, unknown>;
    await configureDbCrypto({ required: true, rawKey: null });

    const opened = (await openRecord('messages', sealed)) as Record<string, unknown>;
    expect(opened.id).toBe('m1');
    expect(opened.subject).toBeUndefined();
    expect(opened._enc).toBeUndefined();
  });

  it('only seals meta records under sensitive key prefixes', async () => {
    await configureDbCrypto({ required: true, rawKey: KEY });

    const queue = { key: 'mutation_queue_a@example.com', value: [{ authHeader: 'Basic x' }] };
    const sealedQueue = (await sealRecord('meta', queue)) as Record<string, unknown>;
    expect(sealedQueue.value).toBeUndefined();
    expect(sealedQueue._enc).toBeDefined();
    expect(await openRecord('meta', sealedQueue)).toEqual(queue);

    // Plain infrastructure keys (probe, flags, migrations) stay readable.
    const flag = { key: 'app_lock_enabled', value: true, updatedAt: 1 };
    expect(await sealRecord('meta', flag)).toBe(flag);
    expect(recordIsSensitive('meta', flag)).toBe(false);
    expect(recordIsSensitive('meta', queue)).toBe(true);
  });

  it('re-putting an already-sealed record is a no-op (no double encryption)', async () => {
    await configureDbCrypto({ required: true, rawKey: KEY });
    const sealed = await sealRecord('messages', message());
    expect(await sealRecord('messages', sealed)).toBe(sealed);
  });

  it('merges plaintext siblings into an existing envelope (cursor-modify shape)', async () => {
    await configureDbCrypto({ required: true, rawKey: KEY });
    const sealed = (await sealRecord('messages', message())) as Record<string, unknown>;
    // A cursor-path modify writes a sensitive field NEXT TO the envelope.
    const mutated = { ...sealed, subject: 'Updated subject' };
    const resealed = (await sealRecord('messages', mutated)) as Record<string, unknown>;
    expect(resealed.subject).toBeUndefined();
    const opened = (await openRecord('messages', resealed)) as Record<string, unknown>;
    expect(opened.subject).toBe('Updated subject');
    expect(opened.from).toBe('boss@example.com'); // other sealed fields kept
  });

  it('changesTouchSensitiveFields distinguishes plaintext-only change sets', async () => {
    expect(changesTouchSensitiveFields('messages', { is_unread: false, flags: [] })).toBe(false);
    expect(changesTouchSensitiveFields('messages', { subject: 'x' })).toBe(true);
    expect(changesTouchSensitiveFields('folders', { anything: 'x' })).toBe(false);
  });

  it('sealRecords / openRecords handle arrays with gaps (bulkGet shape)', async () => {
    await configureDbCrypto({ required: true, rawKey: KEY });
    const sealedList = await sealRecords('messages', [message(), undefined as unknown as object]);
    const openedList = (await openRecords('messages', sealedList)) as Array<unknown>;
    expect(openedList[0]).toEqual(message());
    expect(openedList[1]).toBeUndefined();
  });

  it('rejects keys that are not 32 bytes', async () => {
    await expect(configureDbCrypto({ required: true, rawKey: new Uint8Array(16) })).rejects.toThrow(
      /32 bytes/,
    );
  });
});
