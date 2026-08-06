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
}

function decorateRow(row: HTMLElement) {
  // [CUSTOM FIX] Mailbox.svelte already renders its own native avatar on
  // mobile — a <button aria-label="Select"/"Deselect"> that doubles as both
  // the selection toggle and the sender avatar (see the "Mobile: avatar +
  // two-line layout" block). That's a completely separate rendering path
  // from MessageRow.svelte, so our selector-based skip in installModernAvatarInjector
  // still matches these rows — without this check we'd stack a second avatar
  // on top of the native one. If it's present, leave the row alone entirely.
  const hasNativeMobileAvatar = row.querySelector(
    'button[aria-label="Select"], button[aria-label="Deselect"]'
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
  if (!senderText) return;

  const avatar = document.createElement('div');
  avatar.className = AVATAR_CLASS;
  avatar.style.backgroundColor = getAvatarColor(senderText);
  avatar.textContent = getInitials(senderText);

  // [CUSTOM FIX] Locate the checkbox cell explicitly instead of trusting
  // firstElementChild — the row is recycled by VirtualList.svelte, so its
  // child order can be momentarily inconsistent during that recycling.
  const checkboxCell = row.querySelector(':scope > div:has([data-slot="checkbox"])');
  row.insertBefore(avatar, checkboxCell?.nextSibling ?? row.firstChild);

  row.dataset.avatarInjected = 'true';
  row.classList.add('fe-row-has-avatar');
}
function scan(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('[data-testid="message-row"]').forEach(decorateRow);
}

// [CUSTOM FIX] Strips every injected avatar from the page. Called whenever
// the theme switches away from "modern" — without this, avatars injected
// while modern was active stayed in the DOM forever, including after
// switching back to "Classique".
export function removeModernAvatars() {
  if (typeof document === 'undefined') return;
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
    return;
  }

  if (document.body.getAttribute('data-ui-style') === 'modern') scan(document);
const observer = new MutationObserver((mutations) => {
  if (document.body.getAttribute('data-ui-style') !== 'modern') return;
  for (const m of mutations) {
    m.addedNodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;

      // [CUSTOM FIX] Ignore mutations caused by our OWN avatar insertion/
      // removal — without this guard, decorateRow()'s insertBefore/remove
      // calls are themselves observed mutations, which re-triggered
      // decorateRow() again via the ancestorRow lookup below, which
      // mutated the DOM again, forever. That infinite mutation loop is
      // what froze the page (blank, unresponsive UI).
      if (node.classList?.contains(AVATAR_CLASS)) return;

      if (node.matches?.('[data-testid="message-row"]')) {
        decorateRow(node);
        return;
      }
      scan(node);

      const ancestorRow = node.closest?.('[data-testid="message-row"]');
      if (ancestorRow) decorateRow(ancestorRow as HTMLElement);
    });
  }
});

  observer.observe(document.body, { childList: true, subtree: true });
  window.__feModernAvatarObserver = observer;
}