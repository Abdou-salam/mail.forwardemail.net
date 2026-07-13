import { writable, get } from 'svelte/store';

const KEY = 'fe:ui-style';
export type UIStyle = 'classic' | 'modern';

function readInitial(): UIStyle {
  if (typeof localStorage === 'undefined') return 'classic';
  return localStorage.getItem(KEY) === 'modern' ? 'modern' : 'classic';
}

export const uiStyle = writable<UIStyle>(readInitial());

// Side effect: applies immediately on import + on every change.
// Also drives the existing 'fe:card-view' key so the message list
// layout follows the theme switch, reusing Mailbox.svelte's own
// cardView toggle instead of duplicating list-layout logic.
uiStyle.subscribe((value) => {
  if (typeof document === 'undefined') return;
  document.body.setAttribute('data-ui-style', value);
  try {
    localStorage.setItem(KEY, value);
    localStorage.setItem('fe:card-view', value === 'modern' ? 'true' : 'false');
  } catch {
    // ignore storage errors (private mode, etc.)
  }
});

export function setUiStyle(next: UIStyle) {
  uiStyle.set(next);
}

export function toggleUiStyle() {
  uiStyle.update((v) => (v === 'modern' ? 'classic' : 'modern'));
}

export function getUiStyle(): UIStyle {
  return get(uiStyle);
}