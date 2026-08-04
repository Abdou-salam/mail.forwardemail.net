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

let observer: MutationObserver | null = null;

function decorateRow(row: HTMLElement) {
  if (row.dataset.avatarInjected === 'true') return;
  const senderEl = row.querySelector<HTMLElement>('.truncate');
  const senderText = senderEl?.textContent?.trim() || '';
  if (!senderText) return;

  const avatar = document.createElement('div');
  avatar.className = 'fe-row-avatar';
  avatar.style.backgroundColor = getAvatarColor(senderText);
  avatar.textContent = getInitials(senderText);

  // [CUSTOM FIX] Query for the checkbox cell explicitly instead of trusting
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

export function installModernAvatarInjector() {
  if (observer || typeof document === 'undefined') return;

  scan(document);

  observer = new MutationObserver((mutations) => {
    if (document.body.getAttribute('data-ui-style') !== 'modern') return;
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches?.('[data-testid="message-row"]')) decorateRow(node);
        else scan(node);
      });
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}