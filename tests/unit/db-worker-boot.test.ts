/**
 * db.worker boot heartbeat — producer side.
 *
 * The worker must post {type:'booted'} the moment its script runs (before the
 * potentially-slow IndexedDB open in `init`). db-worker-client uses that signal
 * to tell "worker never started" (fall back to the main-thread engine fast)
 * from "worker alive but IndexedDB slow" (keep waiting). If someone removes the
 * heartbeat the client would silently lose that distinction, so pin the
 * contract here. The client-side two-phase consumption is validated on a real
 * signed/dev rebuild (a full mock-worker init test would be timing-brittle).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('db.worker boot heartbeat', () => {
  let postSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules(); // force the worker module body to re-run on import
    postSpy = vi.spyOn(self, 'postMessage').mockImplementation(() => {});
  });

  afterEach(() => {
    postSpy.mockRestore();
  });

  it('posts {type:"booted"} as soon as the worker script loads', async () => {
    await import('../../src/workers/db.worker.ts');
    expect(postSpy).toHaveBeenCalledWith({ type: 'booted' });
  });
});
