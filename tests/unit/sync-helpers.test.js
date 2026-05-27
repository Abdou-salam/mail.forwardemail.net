import { describe, expect, it } from 'vitest';
import {
  normalizeMessageForCache,
  mergeFlagsAndMetadata,
  didMetadataChange,
  extractFromField,
} from '../../src/utils/sync-helpers.ts';

describe('sync helpers', () => {
  it('normalizes server message with flags', () => {
    const raw = {
      Uid: 123,
      folder: 'INBOX',
      Subject: 'Hello',
      From: { Display: 'Sender', Email: 'sender@example.com' },
      flags: ['\\Seen', '\\Flagged'],
      has_attachment: true,
      modseq: 5,
      labels: ['work', 'urgent'],
    };

    const normalized = normalizeMessageForCache(raw, 'INBOX', 'acct');

    expect(String(normalized.id)).toBe('123');
    expect(normalized.folder).toBe('INBOX');
    expect(normalized.is_unread).toBe(false);
    expect(normalized.is_starred).toBe(true);
    expect(normalized.modseq).toBe(5);
    expect(normalized.has_attachment).toBe(true);
    expect(normalized.labels).toEqual(['work', 'urgent']);
  });

  it('normalizes keyword maps from the server into labels', () => {
    const raw = {
      id: 'msg-kw',
      uid: 456,
      folder: 'INBOX',
      Subject: 'Keyword label message',
      From: { Display: 'Sender', Email: 'sender@example.com' },
      keywords: {
        work: true,
        urgent: 1,
        ignored: false,
      },
    };

    const normalized = normalizeMessageForCache(raw, 'INBOX', 'acct');

    expect(normalized.labels).toEqual(['work', 'urgent']);
  });

  it('filters out structural keyword keys and system flags from labels', () => {
    const raw = {
      id: 'msg-sys',
      uid: 789,
      folder: 'INBOX',
      Subject: 'System keywords',
      From: { Display: 'Sender', Email: 'sender@example.com' },
      keywords: {
        data: true,
        type: true,
        content: true,
        work: true,
        '\\Seen': true,
        $Forwarded: true,
      },
    };

    const normalized = normalizeMessageForCache(raw, 'INBOX', 'acct');

    expect(normalized.labels).toEqual(['work']);
  });

  it('filters system labels when provided as an array', () => {
    const raw = {
      id: 'msg-arr',
      uid: 321,
      folder: 'INBOX',
      Subject: 'Mixed labels',
      From: { Display: 'Sender', Email: 'sender@example.com' },
      labels: ['data', 'type', 'project-x', '\\Inbox'],
    };

    const normalized = normalizeMessageForCache(raw, 'INBOX', 'acct');

    expect(normalized.labels).toEqual(['project-x']);
  });

  it('detects metadata changes for flags and unread state', () => {
    const existing = {
      id: 1,
      flags: ['\\Seen'],
      is_unread: false,
      is_starred: false,
      modseq: 1,
    };

    const incoming = {
      ...existing,
      flags: ['\\Seen', '\\Flagged'],
      is_starred: true,
      modseq: 2,
    };

    const merged = mergeFlagsAndMetadata(existing, incoming);
    expect(merged.changed).toBe(true);
    expect(merged.record.is_starred).toBe(true);
    expect(merged.record.modseq).toBe(2);
  });

  it('returns false when metadata unchanged', () => {
    const existing = {
      id: 1,
      flags: ['\\Seen'],
      is_unread: false,
      is_starred: false,
      modseq: 3,
    };

    const candidate = {
      ...existing,
    };

    expect(didMetadataChange(candidate, existing)).toBe(false);
  });
});

describe('extractFromField fallbacks', () => {
  it('returns empty string when no source has from-like data', () => {
    expect(extractFromField({})).toBe('');
  });

  it('uses Sender: header when From: is absent', () => {
    const raw = {
      nodemailer: {
        headers: { sender: 'Mailing List <list@example.com>' },
      },
    };
    expect(extractFromField(raw)).toContain('list@example.com');
  });

  it('falls back to Return-Path header', () => {
    const raw = {
      nodemailer: {
        headers: { 'return-path': '<bounces@notify.example.com>' },
      },
    };
    expect(extractFromField(raw)).toBe('bounces@notify.example.com');
  });

  it('falls back to envelope.from on nodemailer', () => {
    const raw = {
      nodemailer: { envelope: { from: 'envelope@example.com' } },
    };
    expect(extractFromField(raw)).toBe('envelope@example.com');
  });

  it('falls back to Message-ID domain when nothing else is available', () => {
    const raw = { message_id: '<abc.def@auto.example.com>' };
    expect(extractFromField(raw)).toBe('<unknown@auto.example.com>');
  });

  it('prefers structured nodemailer.from over fallback chain', () => {
    const raw = {
      nodemailer: {
        from: { name: 'Real Person', address: 'real@example.com' },
        envelope: { from: 'envelope@example.com' },
      },
    };
    expect(extractFromField(raw)).toContain('real@example.com');
  });

  it('normalizes empty mailparser object via fallback', () => {
    const raw = {
      from: { value: [], text: '' },
      nodemailer: { envelope: { from: 'bounce@example.com' } },
    };
    expect(extractFromField(raw)).toBe('bounce@example.com');
  });
});

// Regression guard for the "sync stamped every email with this morning's
// time" bug. normalizeMessageForCache used to fall back to Date.now() when
// the server payload had no date field, which made bulk-sync passes look
// like every message arrived at the moment of sync. dateMs must be 0
// (sentinel for "unknown") in that case, and created_at must beat the
// sender's clock when both are present.
describe('normalizeMessageForCache date handling', () => {
  it('returns dateMs = 0 when no date fields are present (no Date.now() fallback)', () => {
    const before = Date.now();
    const raw = {
      Uid: 1,
      Subject: 'No date field',
      From: { Email: 's@example.com' },
    };
    const normalized = normalizeMessageForCache(raw, 'INBOX', 'acct');
    const after = Date.now();
    // Crucial: dateMs must NOT have been stamped with "now".
    expect(normalized.dateMs).toBe(0);
    expect(normalized.dateMs).toBeLessThan(before);
    expect(normalized.dateMs).toBeLessThan(after);
  });

  it('prefers server created_at over header date', () => {
    const created = new Date('2025-06-01T12:00:00Z').getTime();
    const header = new Date('2025-06-01T13:30:00Z').getTime();
    const raw = {
      Uid: 2,
      Subject: 'Created_at wins',
      From: { Email: 's@example.com' },
      created_at: new Date(created).toISOString(),
      header_date: new Date(header).toISOString(),
    };
    const normalized = normalizeMessageForCache(raw, 'INBOX', 'acct');
    expect(normalized.dateMs).toBe(created);
  });

  it('uses date field when created_at is absent', () => {
    const ts = new Date('2024-11-15T08:00:00Z').getTime();
    const raw = {
      Uid: 3,
      Subject: 'Date only',
      From: { Email: 's@example.com' },
      date: new Date(ts).toISOString(),
    };
    const normalized = normalizeMessageForCache(raw, 'INBOX', 'acct');
    expect(normalized.dateMs).toBe(ts);
  });

  it('returns dateMs = 0 when date is unparseable', () => {
    const raw = {
      Uid: 4,
      Subject: 'Bad date',
      From: { Email: 's@example.com' },
      date: 'not-a-real-date',
    };
    const normalized = normalizeMessageForCache(raw, 'INBOX', 'acct');
    expect(normalized.dateMs).toBe(0);
  });
});
