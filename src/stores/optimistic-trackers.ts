// Optimistic-update reconciliation trackers extracted from mailboxStore.ts so
// their logic can be unit-tested in isolation. They guard the store against a
// stale server/sync response clobbering a just-applied optimistic mutation:
//
//   - pending DELETES: ids we optimistically removed, so a slow list response
//     that still includes them doesn't re-add them ("deleted message reappears").
//   - pending FLAG mutations: read/star changes we applied locally, re-applied
//     on top of list responses until the server confirms them.
//
// Both auto-expire entries after PENDING_DELETE_TTL (60s — generous to cover
// slow connections / queued sync tasks). The factories take an injectable
// `now`/`ttl` purely so tests can drive expiry deterministically; production
// callers use the defaults and get identical behavior to the inlined originals.

export const PENDING_DELETE_TTL = 60_000;

interface TrackerOptions {
  now?: () => number;
  ttl?: number;
}

export interface PendingFlagMutation {
  ts: number;
  is_unread?: boolean;
  is_unread_index?: number;
  flags?: string[];
  is_starred?: boolean;
}

export function createPendingDeleteTracker({
  now = () => Date.now(),
  ttl = PENDING_DELETE_TTL,
}: TrackerOptions = {}) {
  const pending: Map<string, number> = new Map(); // id -> timestamp

  const prune = () => {
    const t = now();
    for (const [id, ts] of pending) {
      if (t - ts > ttl) pending.delete(id);
    }
  };

  return {
    add(ids: string[]) {
      const t = now();
      for (const id of ids) {
        if (id) pending.set(id, t);
      }
    },
    filter(msgs: Record<string, unknown>[]) {
      if (!pending.size) return msgs;
      prune();
      if (!pending.size) return msgs;
      return msgs.filter((m) => !pending.has(m.id as string));
    },
    getIds(): string[] {
      prune();
      return [...pending.keys()];
    },
    confirm(serverIds: Set<string>) {
      // If a pending-delete ID is absent from the server response, the server
      // has processed it — safe to stop filtering.
      for (const id of pending.keys()) {
        if (!serverIds.has(id)) pending.delete(id);
      }
    },
    clear() {
      pending.clear();
    },
  };
}

export function createPendingFlagTracker({
  now = () => Date.now(),
  ttl = PENDING_DELETE_TTL,
}: TrackerOptions = {}) {
  const pending: Map<string, PendingFlagMutation> = new Map(); // id -> mutation

  const prune = () => {
    const t = now();
    for (const [id, m] of pending) {
      if (t - m.ts > ttl) pending.delete(id);
    }
  };

  return {
    add(id: string, mutation: Omit<PendingFlagMutation, 'ts'>) {
      if (!id) return;
      pending.set(id, { ...mutation, ts: now() });
    },
    apply(msgs: Record<string, unknown>[]) {
      if (!pending.size) return msgs;
      prune();
      if (!pending.size) return msgs;
      return msgs.map((msg) => {
        const p = pending.get(msg.id as string);
        if (!p) return msg;
        const { ts: _ts, ...overrides } = p;
        return { ...msg, ...overrides };
      });
    },
    confirm(serverMsgs: Record<string, unknown>[]) {
      // If the server response matches the optimistic state, the mutation
      // has been processed — safe to stop overriding.
      for (const msg of serverMsgs) {
        const id = msg.id as string;
        const p = pending.get(id);
        if (!p) continue;
        if (p.is_unread !== undefined && msg.is_unread === p.is_unread) {
          pending.delete(id);
        } else if (p.is_starred !== undefined && msg.is_starred === p.is_starred) {
          pending.delete(id);
        }
      }
    },
    clear() {
      pending.clear();
    },
  };
}
