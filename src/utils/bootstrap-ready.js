// TEMPORARY (remove with the Linux demo-entry stall diagnosis): a tiny,
// side-effect-free milestone tracer. The app's warn() logger is dead-code-
// eliminated in the production frontend the e2e binary embeds, so app-side
// load-orchestration milestones never reach the console. Record them on a
// global the e2e harness can dump on readiness-gate timeout to see exactly
// where demo-entry loading stalls (which loader fired, in what order, with
// the demo flag set, and whether it cleared `loading`).
export function e2eTrace(label) {
  try {
    const g = globalThis;
    const arr = g.__feTrace || (g.__feTrace = []);
    arr.push(Date.now() + ' ' + label);
    if (arr.length > 300) arr.shift();
  } catch {
    // ignore — tracing must never affect behavior
  }
}

let resolveReady = null;

export const bootstrapReady = new Promise((resolve) => {
  resolveReady = resolve;
});

export function markBootstrapReady() {
  e2eTrace('markBootstrapReady');
  if (resolveReady) {
    resolveReady();
    resolveReady = null;
  }
}

// Separate gate that resolves after app lock is dismissed and credentials
// are available.  Mailbox (and other components that make API calls) must
// await this before issuing requests.
let resolveAppReady = null;
export const appReady = new Promise((resolve) => {
  resolveAppReady = resolve;
});

export function markAppReady() {
  e2eTrace('markAppReady');
  if (resolveAppReady) {
    resolveAppReady();
    resolveAppReady = null;
  }
}
