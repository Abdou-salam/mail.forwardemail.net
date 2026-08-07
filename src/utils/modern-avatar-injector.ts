/**
 * [CUSTOM] Injects sender avatars into message rows for the "Moderne" theme
 * without touching MessageRow.svelte (a shared file between Classic and
 * Modern). Observes the DOM for [data-testid="message-row"] elements and
 * prepends a colored initials avatar, computed from the sender text
 * MessageRow.svelte already renders (the first ".truncate" span).
 *
 * Trade-off vs. a prop-based approach: this reads already-rendered text
 * instead of the underlying message data, so it's a bit more fragile to
 * markup changes — but it means zero diff on the shared upstream component.
 */
import { getInitials, getAvatarColor } from '../svelte/mailbox/utils/avatar-helpers.js';

const AVATAR_CLASS = 'fe-row-avatar';

// [CUSTOM FIX] Use a window-level flag instead of a module-scoped variable.
// A module-scoped `let observer` gets reset whenever this module is
// re-evaluated (e.g. Vite HMR during development), which silently created a
// second, independent MutationObserver on top of the first — each one
// injecting its own avatar into the same rows, producing the duplicate
// avatars seen on mobile. A flag on `window` survives module re-execution.
declare global {
  interface Window {
    __feModernAvatarObserver?: MutationObserver;
  }
}

function removeAvatar(row: HTMLElement) {
  row.querySelectorAll(`.${AVATAR_CLASS}`).forEach((el) => el.remove());
  delete row.dataset.avatarInjected;
  delete row.dataset.avatarRetries;
  row.classList.remove('fe-row-has-avatar'); // [CUSTOM FIX] was never cleared, leaving stale state
}

function decorateRow(row: HTMLElement) {
  // [CUSTOM FIX] Mailbox.svelte already renders its own native avatar on
  // mobile — a <button aria-label="Select"/"Deselect"> that doubles as both
  // the selection toggle and the sender avatar (see the "Mobile: avatar +
  // two-line layout" block). That's a completely separate rendering path
  // from MessageRow.svelte, so our selector-based skip in
  // installModernAvatarInjector still matches these rows — without this
  // check we'd stack a second avatar on top of the native one. If it's
  // present, leave the row alone entirely.
  const hasNativeMobileAvatar = row.querySelector(
    'button[aria-label="Select"], button[aria-label="Deselect"]',
  );
  if (hasNativeMobileAvatar) {
    removeAvatar(row); // in case we'd previously injected one before this check existed
    return;
  }

  // Defensive: always start from a clean slate so a row can never end up
  // with more than one avatar, regardless of how decorateRow got called
  // twice (duplicate observer, re-entrant mutation batches, etc.).
  removeAvatar(row);

  const senderEl = row.querySelector<HTMLElement>('.truncate');
  const senderText = senderEl?.textContent?.trim() || '';
  if (!senderText) {
    // [CUSTOM FIX] The row was just (re)mounted but Svelte hasn't written
    // the sender text into it yet. Retry on the next frame instead of
    // bailing out silently, capped to avoid looping forever on a row that
    // genuinely has no sender text.
    const retries = Number(row.dataset.avatarRetries || '0');
    if (retries < 5) {
      row.dataset.avatarRetries = String(retries + 1);
      requestAnimationFrame(() => decorateRow(row));
    }
    return;
  }
  delete row.dataset.avatarRetries;

  const avatar = document.createElement('div');
  avatar.className = AVATAR_CLASS;
  avatar.style.backgroundColor = getAvatarColor(senderText);
  avatar.textContent = getInitials(senderText);

  // [CUSTOM FIX] Locate the checkbox cell via plain JS traversal instead of
  // :scope > div:has([data-slot="checkbox"]). :has() may be unsupported or
  // unreliable in some Tauri webview engines (WebView2 on older Windows
  // builds, some WebKitGTK versions on Linux) — a querySelector call that
  // silently fails/throws there breaks avatar insertion for the whole row
  // with no visible error. Array.prototype.find has no such dependency.
  const checkboxCell = Array.from(row.children).find(
    (child) => child instanceof HTMLElement && child.querySelector('[data-slot="checkbox"]'),
  ) as HTMLElement | undefined;
  row.insertBefore(avatar, checkboxCell?.nextSibling ?? row.firstChild);

  row.dataset.avatarInjected = 'true';
  row.classList.add('fe-row-has-avatar');
}

function scan(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('[data-testid="message-row"]').forEach(decorateRow);
}

// [CUSTOM FIX] Safety net: some DOM updates during bulk actions (Select
// all → Deselect all, "Mark selected as unread", etc.) don't surface as
// mutations our MutationObserver can reliably attribute to a specific row
// — confirmed via instrumented logging, where 70+ observed mutations all
// targeted checkbox buttons and the list container, never a row's own text
// content, yet avatars still went missing afterward. Rather than keep
// chasing the exact DOM event involved, periodically re-check visible rows
// and repair any that are missing their avatar. Cheap: only touches rows
// currently in the viewport, and only acts when something is actually
// wrong (no-op on every tick where nothing needs fixing).
let healInterval: ReturnType<typeof setInterval> | null = null;

function selfHealVisibleRows() {
  if (document.body.getAttribute('data-ui-style') !== 'modern') return;
  document.querySelectorAll<HTMLElement>('[data-testid="message-row"]').forEach((row) => {
    const rect = row.getBoundingClientRect();
    const isVisible = rect.bottom > 0 && rect.top < window.innerHeight && rect.height > 0;
    if (!isVisible) return;

    const hasNativeMobileAvatar = row.querySelector(
      'button[aria-label="Select"], button[aria-label="Deselect"]',
    );
    if (hasNativeMobileAvatar) return;

    const hasAvatar = !!row.querySelector(`.${AVATAR_CLASS}`);
    const senderText = row.querySelector('.truncate')?.textContent?.trim();
    if (!hasAvatar && senderText) {
      decorateRow(row);
    }
  });
}

// [CUSTOM FIX] Strips every injected avatar from the page. Called whenever
// the theme switches away from "modern" — without this, avatars injected
// while modern was active stayed in the DOM forever, including after
// switching back to "Classique".
export function removeModernAvatars() {
  if (typeof document === 'undefined') return;
  if (healInterval) {
    clearInterval(healInterval);
    healInterval = null;
  }
  document
    .querySelectorAll<HTMLElement>('[data-testid="message-row"]')
    .forEach((row) => removeAvatar(row));
}

export function installModernAvatarInjector() {
  if (typeof document === 'undefined') return;
  if (window.__feModernAvatarObserver) {
    // Already installed (possibly by a prior HMR pass) — just re-scan in
    // case rows were added while this ran, rather than creating a second
    // observer.
    if (document.body.getAttribute('data-ui-style') === 'modern') scan(document);
    if (!healInterval) healInterval = setInterval(selfHealVisibleRows, 400);
    return;
  }

  if (document.body.getAttribute('data-ui-style') === 'modern') scan(document);

  const observer = new MutationObserver((mutations) => {
    if (document.body.getAttribute('data-ui-style') !== 'modern') return;

    const rowsToRedecorate = new Set<HTMLElement>();

    for (const m of mutations) {
      if (m.type === 'childList') {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.classList?.contains(AVATAR_CLASS)) return; // ignore our own insertions
          if (node.matches?.('[data-testid="message-row"]')) {
            rowsToRedecorate.add(node);
            return;
          }
          scan(node);
          const ancestorRow = node.closest?.('[data-testid="message-row"]');
          if (ancestorRow) rowsToRedecorate.add(ancestorRow as HTMLElement);
        });
        continue;
      }

      // characterData mutations: Svelte updates an *existing* row's
      // sender-text node in place (no element added/removed) in some
      // virtualized-list reuse scenarios. Without this branch, those
      // text-only updates were invisible to us entirely.
      const target = m.target instanceof HTMLElement ? m.target : m.target.parentElement;
      const ancestorRow = target?.closest?.('[data-testid="message-row"]');
      if (ancestorRow) rowsToRedecorate.add(ancestorRow as HTMLElement);
    }

    rowsToRedecorate.forEach((row) => decorateRow(row));
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  window.__feModernAvatarObserver = observer;

  // Start the self-healing safety net (see selfHealVisibleRows above).
  if (healInterval) clearInterval(healInterval);
  healInterval = setInterval(selfHealVisibleRows, 400);
}