/**
 * Forward Email – Cross-platform File Picker
 *
 * On Tauri desktop, <input type="file"> triggers WebKit's runOpenPanel
 * which crashes the app (Tauri's WKWebView delegate panics → abort).
 * This utility uses Tauri's native dialog.open() API instead, returning
 * standard File objects so existing handlers work without changes.
 *
 * On web, returns null to let the caller fall through to normal
 * <input type="file"> behavior.
 */

import { isTauriDesktop } from './platform.js';

// macOS 26 (Tahoe) crashes the bundled tauri-plugin-dialog file picker:
// rfd 0.16's NSOpenPanel binding is non-nullable, but +openPanel started
// returning nil on Tahoe and the objc2 retain assertion panics → SIGABRT.
// Detect macOS and route through our custom Rust command instead, which
// uses msg_send! with a nullable return type and an alloc/init fallback.
const isMacOS =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || '');

export const isMacOSPlatform = isMacOS;

/**
 * True on macOS 26 "Tahoe" or later — the versions where the bundled plugin
 * dialog's rfd path can SIGABRT, so we must not fall back to it. The WKWebView
 * UA is frozen at "10_15_7", so read the real version via plugin-os. Robust to
 * the product-vs-Darwin ambiguity: Tahoe reports product major 26 but Darwin
 * major 25, and there is no macOS product 16–25, so `major >= 25` means Tahoe+
 * either way, while Sequoia (product 15 / Darwin 24) stays below the line. On
 * any detection failure, assume Tahoe — skipping a maybe-crashing fallback is
 * the safer default.
 */
async function isMacOSTahoeOrLater(): Promise<boolean> {
  try {
    const { version } = await import('@tauri-apps/plugin-os');
    const major = parseInt(String(version()).split('.')[0], 10);
    return !Number.isFinite(major) || major >= 25;
  } catch {
    return true;
  }
}

/**
 * Pick files using Tauri's native dialog on desktop.
 * Returns File[] on success, null if cancelled or not on Tauri desktop.
 */
export async function pickFiles({
  accept,
  multiple = false,
}: {
  accept?: string;
  multiple?: boolean;
} = {}): Promise<File[] | null> {
  if (!isTauriDesktop) return null;

  const { readFile } = await import('@tauri-apps/plugin-fs');

  let paths: string[];
  if (isMacOS) {
    const { invoke } = await import('@tauri-apps/api/core');
    try {
      const result = await invoke<string[]>('pick_files_macos', { multiple });
      if (!result || result.length === 0) return null;
      paths = result;
    } catch (err) {
      // pick_files_macos couldn't construct an NSOpenPanel. On macOS < 26 the
      // bundled plugin dialog is safe and is what actually works there, so fall
      // back to it — removing this fallback regressed the picker on non-Tahoe
      // Macs where the custom command returns nil but the plugin succeeds. On
      // macOS 26 (Tahoe) the plugin's rfd open() can SIGABRT, so do NOT call it
      // there; surface a typed error the caller handles instead.
      if (await isMacOSTahoeOrLater()) {
        const e = new Error('The macOS file picker is unavailable on this system.');
        (e as Error & { code?: string }).code = 'FILE_PICKER_UNAVAILABLE';
        (e as Error & { cause?: unknown }).cause = err;
        throw e;
      }
      console.warn('[file-picker] pick_files_macos failed; falling back to plugin dialog:', err);
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ multiple, filters: buildFilters(accept) });
      if (!selected) return null;
      paths = Array.isArray(selected) ? selected : [selected];
    }
  } else {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({ multiple, filters: buildFilters(accept) });
    if (!selected) return null;
    paths = Array.isArray(selected) ? selected : [selected];
  }

  const files = await Promise.all(
    paths.map(async (filePath) => {
      const bytes = await readFile(filePath);
      const name = filePath.replace(/^.*[\\/]/, '');
      return new File([bytes], name, { type: mimeFromName(name) });
    }),
  );

  return files;
}

function buildFilters(accept?: string) {
  if (!accept) return [];
  const extensions: string[] = [];
  for (const part of accept.split(',')) {
    const t = part.trim();
    if (t.startsWith('.')) {
      extensions.push(t.slice(1));
    } else if (t === 'image/*') {
      extensions.push('png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico');
    } else if (t === 'text/vcard') {
      extensions.push('vcf');
    } else if (t === 'text/calendar') {
      extensions.push('ics');
    }
  }
  return extensions.length ? [{ name: 'Files', extensions }] : [];
}

function mimeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    vcf: 'text/vcard',
    ics: 'text/calendar',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    pdf: 'application/pdf',
    txt: 'text/plain',
  };
  return (ext && map[ext]) || 'application/octet-stream';
}
