/**
 * Pure helpers used by sync.worker.ts. Extracted into their own module so
 * they can be unit-tested without constructing a real Worker.
 */

export function toUid(value: unknown): number | string {
  const num = Number(value);
  return Number.isFinite(num) ? num : (value as string | number) || 0;
}

export function toKey(account: string, folder: string): string {
  return `${account}::${folder}`;
}

export function accountKey(account: string | null | undefined): string {
  return account || 'default';
}

export function coerceLabelList(value: unknown): string[] {
  const normalizeLabel = (label: unknown) => {
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
}

export function hasFromValue(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export interface DraftLike {
  to?: unknown[];
  cc?: unknown[];
  bcc?: unknown[];
  subject?: string;
  body?: string;
  from?: string;
  account?: string;
  isPlainText?: boolean;
  attachments?: Array<{
    name?: string;
    filename?: string;
    contentType?: string;
    content?: string;
  }>;
  folder?: string;
  serverId?: string | null;
}

export function hasMeaningfulDraft(draft: DraftLike): boolean {
  return !!(
    (draft.to && draft.to.length > 0) ||
    (draft.cc && draft.cc.length > 0) ||
    (draft.bcc && draft.bcc.length > 0) ||
    (draft.subject && draft.subject.trim()) ||
    (draft.body && draft.body.trim())
  );
}

export function buildDraftPayload(draft: DraftLike) {
  return {
    from: draft.from || draft.account || '',
    to: draft.to || [],
    cc: draft.cc || [],
    bcc: draft.bcc || [],
    subject: draft.subject || '',
    html: draft.isPlainText ? undefined : draft.body || '',
    text: draft.isPlainText ? draft.body || '' : undefined,
    attachments: (draft.attachments || []).map((att) => ({
      filename: att.name || att.filename,
      contentType: att.contentType,
      content: att.content,
      encoding: 'base64',
    })),
    has_attachment: Array.isArray(draft.attachments) && draft.attachments.length > 0,
    folder: draft.folder || 'Drafts',
  };
}

export function parseResultList<T = unknown>(
  res:
    | {
        Result?: { List?: T[] } | T[];
      }
    | T[]
    | null
    | undefined,
): T[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  const inner = (res as { Result?: { List?: T[] } | T[] }).Result;
  if (Array.isArray(inner)) return inner;
  if (inner && Array.isArray((inner as { List?: T[] }).List)) {
    return (inner as { List: T[] }).List;
  }
  return [];
}

export function isPgpContent(raw: unknown): boolean {
  if (!raw || typeof raw !== 'string') return false;
  if (raw.includes('-----BEGIN PGP MESSAGE-----')) return true;
  if (raw.includes('multipart/encrypted') && raw.includes('application/pgp-encrypted')) {
    return true;
  }
  return false;
}

export interface HeaderLike {
  id?: string;
  has_attachment?: boolean;
}

export interface CachedBodyLike {
  body?: string | null;
  attachments?: unknown[];
}

/**
 * Determine which messages still need their body fetched.
 * A body is re-fetched if:
 *   - not cached,
 *   - cached body is PGP armored (stale / needs decryption refresh), OR
 *   - message has attachments but none are cached.
 */
export function worklistFromHeaders<H extends HeaderLike>(
  headers: H[],
  bodies: Array<CachedBodyLike | null | undefined>,
  maxMessages?: number,
): H[] {
  const worklist: H[] = [];
  const limit = maxMessages ?? headers.length;
  headers.slice(0, limit).forEach((msg, idx) => {
    const cached = bodies[idx];
    const hasAttachment = msg?.has_attachment;
    const hasStalePgp =
      !!cached?.body && typeof cached.body === 'string' && isPgpContent(cached.body);
    if (!cached?.body || hasStalePgp) {
      worklist.push(msg);
      return;
    }
    if (hasAttachment && !(cached.attachments || []).length) {
      worklist.push(msg);
    }
  });
  return worklist;
}

// ── Backfill loop control ──────────────────────────────────────────────────
// The historical-message backfill is a self-re-queuing loop: the worker runs a
// batch and the controller enqueues the next one until the worker says it's
// done. These two pure helpers own the "should we keep going?" decision on each
// side so the loop can always terminate (and so it's unit-testable).

/** Consecutive zero-progress backfill batches the controller will re-queue
 *  before giving up — defence-in-depth against a worker that keeps returning
 *  `{ done: false }` without making progress. */
export const BACKFILL_NO_PROGRESS_CAP = 3;

/**
 * Whether a backfill batch should report itself "done" so the controller stops
 * re-queuing it. A batch that processed zero pages made no progress — its first
 * fetch threw before the network (unconfigured worker / auth / blip) — so
 * re-queuing would just spin a tight, network-less loop. Report done and let the
 * next metadata sync resume from the saved page. A batch is also done once
 * forward+backfill history is exhausted.
 */
export function backfillBatchDone({
  exhausted = false,
  pagesProcessed = 0,
}: { exhausted?: boolean; pagesProcessed?: number } = {}): boolean {
  return Boolean(exhausted) || pagesProcessed === 0;
}

/**
 * Controller-side decision for the next backfill batch. Re-queues only while the
 * worker reports `!done` AND batches keep processing pages; caps consecutive
 * zero-page batches so a worker that wrongly returns `{ done: false }` can't spin
 * the queue forever. NOTE progress is measured by `pagesProcessed`, not
 * `inserted`: a batch can legitimately walk through already-cached pages
 * (inserted: 0) while still moving toward older uncached history.
 */
export function nextBackfillDecision(
  result: { done?: boolean; pagesProcessed?: number } | null | undefined,
  noProgressStreak = 0,
): { requeue: boolean; noProgressStreak: number } {
  if (!result || result.done) return { requeue: false, noProgressStreak: 0 };
  if ((result.pagesProcessed || 0) > 0) return { requeue: true, noProgressStreak: 0 };
  const streak = noProgressStreak + 1;
  if (streak >= BACKFILL_NO_PROGRESS_CAP) return { requeue: false, noProgressStreak: 0 };
  return { requeue: true, noProgressStreak: streak };
}
