// Pure helpers extracted from mailService.ts so they can be unit-tested without
// loading the store's heavy I/O graph (Dexie, db worker, Remote, attachment
// cache). These cover two concerns: PGP-armor detection on raw message bodies,
// and the attachment download path (filename sanitization + byte decoding).
// Keep them side-effect-free — anything touching the network, disk, DOM, or
// store state belongs back in mailService.ts.

/**
 * Trim a raw body down to just its inline PGP MESSAGE block. Returns the input
 * unchanged when no complete armor block is present.
 */
export function extractPgpArmor(raw: string): string {
  if (!raw || typeof raw !== 'string') return raw;
  const beginIdx = raw.indexOf('-----BEGIN PGP MESSAGE-----');
  const endIdx = raw.indexOf('-----END PGP MESSAGE-----');
  if (beginIdx >= 0 && endIdx > beginIdx) {
    return raw.substring(beginIdx, endIdx + '-----END PGP MESSAGE-----'.length);
  }
  return raw;
}

/**
 * Detect if raw content is a PGP-encrypted message (inline PGP or PGP/MIME).
 */
export function isPgpEncrypted(raw: string): boolean {
  if (!raw || typeof raw !== 'string') return false;
  if (raw.includes('-----BEGIN PGP MESSAGE-----')) return true;
  // PGP/MIME: Content-Type: multipart/encrypted; protocol="application/pgp-encrypted"
  if (raw.includes('multipart/encrypted') && raw.includes('application/pgp-encrypted')) {
    return true;
  }
  return false;
}

const WINDOWS_RESERVED_FILENAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
]);

/**
 * Make an attachment filename safe to write to disk: strip control chars and
 * path separators, collapse whitespace, drop trailing dots/spaces, and guard
 * against empty names and Windows reserved device names (CON, NUL, COM1…).
 */
export function sanitizeDownloadFilename(filename: string): string {
  const withoutControlChars = Array.from(String(filename || 'attachment'))
    .map((char) => {
      const code = char.charCodeAt(0);
      return (code >= 0 && code <= 31) || code === 127 ? '_' : char;
    })
    .join('');

  const sanitized = withoutControlChars
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');

  if (!sanitized || sanitized === '.' || sanitized === '..') {
    return 'attachment';
  }

  const lastDot = sanitized.lastIndexOf('.');
  const hasExtension = lastDot > 0 && lastDot < sanitized.length - 1;
  const baseName = (hasExtension ? sanitized.slice(0, lastDot) : sanitized)
    .replace(/[. ]+$/g, '')
    .trim();
  const extension = hasExtension ? sanitized.slice(lastDot) : '';

  const normalizedBaseName = baseName || 'attachment';
  const safeBaseName = WINDOWS_RESERVED_FILENAMES.has(normalizedBaseName.toUpperCase())
    ? `${normalizedBaseName}_`
    : normalizedBaseName;

  return `${safeBaseName}${extension}`;
}

export function buildSaveDialogFilters(filename: string): { name: string; extensions: string[] }[] {
  const extension = filename.split('.').pop()?.toLowerCase();
  if (!extension || extension === filename.toLowerCase()) {
    return [];
  }

  return [
    {
      name: `${extension.toUpperCase()} file`,
      extensions: [extension],
    },
  ];
}

export function decodeBase64ToBytes(value: string): Uint8Array {
  const decoder =
    typeof atob === 'function'
      ? atob
      : (encoded: string) => Buffer.from(encoded, 'base64').toString('binary');
  const binary = decoder(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function bytesFromDataUrl(href: string): Uint8Array | null {
  if (typeof href !== 'string' || !href.startsWith('data:')) return null;
  const commaIndex = href.indexOf(',');
  if (commaIndex === -1) {
    throw new Error('Attachment data URL is malformed');
  }

  const metadata = href.slice(5, commaIndex);
  const payload = href.slice(commaIndex + 1);
  if (/;base64(?:;|$)/i.test(metadata)) {
    return decodeBase64ToBytes(payload.trim());
  }

  return new TextEncoder().encode(decodeURIComponent(payload));
}

// Convert an attachment's `content` field (which may be a base64 string,
// an ArrayBuffer, a typed array, or a { data: number[] } shape) into a
// raw Uint8Array without going through a giant intermediate data URL.
export function contentToBytes(content: unknown): Uint8Array | null {
  if (content == null) return null;
  if (content instanceof Uint8Array) return content;
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  if (ArrayBuffer.isView(content)) {
    const view = content as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  if (Array.isArray(content)) return new Uint8Array(content);
  if (typeof content === 'object' && Array.isArray((content as { data?: unknown }).data)) {
    return new Uint8Array((content as { data: number[] }).data);
  }
  if (typeof content === 'string') {
    const cleaned = content.replace(/\s+/g, '');
    const looksLikeBase64 = /^[A-Za-z0-9/+]+={0,2}$/.test(cleaned);
    if (looksLikeBase64) return decodeBase64ToBytes(cleaned);
    return new TextEncoder().encode(content);
  }
  return null;
}
