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
 * The ONE combination where the bundled plugin dialog's rfd path SIGABRTs on the
 * NSOpenPanel nil-return: Apple Silicon (aarch64) macOS 26 "Tahoe" or later.
 * That's the only place we must use our custom `pick_files_macos` command (which
 * trades the SIGABRT for a graceful nil).
 *
 * Everywhere else the plugin dialog is the working, crash-free path, so we use
 * it directly:
 *   - Intel (x86_64, any version): plugin works; our custom command instead
 *     returns nil (seen on Intel Sonoma 14.7.3 AND Intel Tahoe) and its
 *     `app.activate()` blanks the compose window — so never call it there.
 *   - Apple Silicon BEFORE Tahoe (Sonoma/Sequoia): plugin works as it always
 *     has — routing these to the custom command would be a new regression.
 *
 * UA is frozen at "10_15_7", so read arch/version via plugin-os. `major >= 25`
 * covers Tahoe under product (26) or Darwin (25) numbering. On detection
 * failure, assume this combo so we never risk the rfd SIGABRT.
 */
async function isAppleSiliconTahoe(): Promise<boolean> {
  try {
    const { version, arch } = await import('@tauri-apps/plugin-os');
    if (arch() !== 'aarch64') return false;
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
  if (isMacOS && (await isAppleSiliconTahoe())) {
    // Apple Silicon Tahoe ONLY: the plugin's rfd path SIGABRTs on the
    // NSOpenPanel nil-return, so go through our nullable custom command. It may
    // itself return nil (no panel constructible) — surface a typed error the
    // caller handles instead of letting the raw native string become an
    // unhandled rejection.
    const { invoke } = await import('@tauri-apps/api/core');
    try {
      const result = await invoke<string[]>('pick_files_macos', { multiple });
      if (!result || result.length === 0) return null;
      paths = result;
    } catch (err) {
      const e = new Error('The macOS file picker is unavailable on this system.');
      (e as Error & { code?: string }).code = 'FILE_PICKER_UNAVAILABLE';
      (e as Error & { cause?: unknown }).cause = err;
      throw e;
    }
  } else {
    // Everything else — Intel macOS (any version), Apple Silicon before Tahoe,
    // and all other desktop platforms: the bundled plugin dialog is the working,
    // crash-free path. On Intel the custom command returns nil and its
    // app.activate() blanks the compose window, so we deliberately don't call it.
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
