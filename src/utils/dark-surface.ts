/**
 * Neutral dark-mode palette for injected / standalone HTML.
 *
 * The email reader iframe (a sandboxed `srcdoc`), the "PGP detected" dialog, and
 * the raw-source viewer (a blob page) all render outside the app's stylesheet
 * scope, so they CANNOT read the app's CSS custom properties. These constants
 * MIRROR the neutral dark tokens in `src/styles/tokens.css` (`.dark`) so those
 * surfaces stay consistent with the rest of dark mode.
 *
 * The app's dark theme was neutralised (commit 62ea80d) from a blue "slate"
 * ramp (#0f172a, #1e293b, #334155 …) to pure greys; these injected surfaces
 * were missed and kept rendering bluish. Keep this table in sync with the
 * `.dark` block in tokens.css — it is the single source of truth for them.
 */
export const DARK_SURFACE = {
  /** Page background — `--surface-base` */
  base: '#0a0a0a',
  /** Default content surface — `--surface-default` */
  surface: '#141414',
  /** Panels / cards / the reader pane — `--surface-card` / `--color-panel` */
  panel: '#1a1a1a',
  /** Elevated surfaces: modals, chips, buttons — `--surface-overlay` / `--surface-modal` */
  overlay: '#242424',
  /** Default border — `--border-default` */
  border: '#333333',
  /** Stronger border — `--border-strong` */
  borderStrong: '#404040',
  /** Primary text — `--text-primary` (`--slate-200`) */
  text: '#e2e8f0',
  /** Muted / secondary text — `--text-secondary` (`--slate-400`) */
  textMuted: '#94a3b8',
  /** Subtle / hover text — `--slate-300` */
  textSubtle: '#cbd5e1',
  /** Link text — `--text-link` (`--blue-400`) */
  link: '#60a5fa',
} as const;
