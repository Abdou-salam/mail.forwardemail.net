/**
 * Forward Email – Cross-platform Download Utility
 *
 * Handles file downloads on both web (blob URL + anchor click) and
 * Tauri desktop (native save dialog + writeFile plugin).
 */

import { isTauri } from './platform.js';
import { isMacOSPlatform } from './file-picker';

type SaveDialogOptions = {
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
};

/**
 * Cross-platform save dialog with a macOS Tahoe workaround.
 *
 * On macOS we route through the `save_file_macos` Rust command because the
 * bundled tauri-plugin-dialog uses rfd 0.16 → NSSavePanel::savePanel, which
 * SIGABRTs when the OS returns nil (macOS 26 / Tahoe). On every other
 * platform we keep using the plugin's save() — that path is unaffected and
 * carries filter UX (extension dropdown) the wrapper cannot replicate.
 *
 * Returns the absolute path the user chose, or null on cancel.
 */
export async function saveFileDialog(opts: SaveDialogOptions = {}): Promise<string | null> {
  if (isMacOSPlatform) {
    const { invoke } = await import('@tauri-apps/api/core');
    const path = await invoke<string | null>('save_file_macos', {
      defaultFilename: opts.defaultPath ?? null,
    });
    return path || null;
  }
  const { save } = await import('@tauri-apps/plugin-dialog');
  const path = await save({
    defaultPath: opts.defaultPath,
    filters: opts.filters,
  });
  return path || null;
}

/**
 * Download content as a file.
 *
 * @param content - String or binary data to download
 * @param filename - Suggested filename
 * @param mime - MIME type (default: 'text/plain')
 * @returns true if the download was initiated
 */
export function downloadFile(
  content: string | ArrayBuffer | Uint8Array,
  filename: string,
  mime: string = 'text/plain',
): boolean {
  if (isTauri) {
    downloadFileTauri(content, filename).catch((err) =>
      console.warn('[downloadFile] Tauri save failed:', err),
    );
    return true;
  }

  try {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('[downloadFile] failed:', err);
    return false;
  }
}

// IPC payloads above this size have been observed to crash macOS WKWebView
// when passed to writeFile in a single call.
const TAURI_WRITE_CHUNK_SIZE = 512 * 1024;

async function downloadFileTauri(
  content: string | ArrayBuffer | Uint8Array,
  filename: string,
): Promise<void> {
  // Defer dialog to next tick — opening NSSavePanel from inside the
  // originating click handler can crash the webview process on macOS.
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  const { writeFile } = await import('@tauri-apps/plugin-fs');

  const filePath = await saveFileDialog({ defaultPath: filename });
  if (!filePath) return;

  const data =
    typeof content === 'string' ? new TextEncoder().encode(content) : new Uint8Array(content);

  if (data.byteLength <= TAURI_WRITE_CHUNK_SIZE) {
    await writeFile(filePath, data);
    return;
  }

  for (let offset = 0; offset < data.byteLength; offset += TAURI_WRITE_CHUNK_SIZE) {
    const chunk = data.subarray(offset, Math.min(offset + TAURI_WRITE_CHUNK_SIZE, data.byteLength));
    await writeFile(filePath, chunk, { append: offset > 0 });
  }
}
