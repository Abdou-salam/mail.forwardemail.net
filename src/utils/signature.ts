/**
 * Email signature helpers.
 *
 * Signatures are stored as plain text (per account, see settingsStore
 * LocalSettings.getSignature). Compose inserts them into a fresh new / reply /
 * forward at open time so the user can see and edit them, mirroring Gmail.
 * They are NOT re-inserted when a saved draft is reopened (the draft body
 * already contains whatever was composed), which avoids duplicate signatures.
 */

// RFC 3676 signature delimiter. Lets receiving clients recognize and collapse
// the signature when quoting a reply.
const DELIMITER = '-- ';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render the signature as an HTML block for the rich-text editor. Returns an
 * empty string when there's no signature text so callers can concatenate
 * unconditionally.
 */
export function signatureHtml(text: string): string {
  const trimmed = (text || '').replace(/\s+$/, '');
  if (!trimmed) return '';
  const body = escapeHtml(trimmed).replace(/\n/g, '<br>');
  // data-fe-signature marks the block so a future feature could strip or
  // swap it; the fe-signature class is available for styling.
  return `<p class="fe-signature" data-fe-signature="true">${DELIMITER}<br>${body}</p>`;
}

/**
 * Render the signature for plain-text mode with the standard delimiter.
 */
export function signaturePlain(text: string): string {
  const trimmed = (text || '').replace(/\s+$/, '');
  if (!trimmed) return '';
  return `${DELIMITER}\n${trimmed}`;
}

/**
 * Prepend the signature above any existing content (empty for a new message,
 * the quoted original for a reply/forward), leaving a blank line at the top
 * for the cursor. Returns existingContent unchanged when there's no signature.
 */
export function applySignatureHtml(text: string, existingHtml: string): string {
  const sig = signatureHtml(text);
  if (!sig) return existingHtml || '';
  const lead = '<p><br></p>';
  return existingHtml ? `${lead}${sig}<p><br></p>${existingHtml}` : `${lead}${sig}`;
}

export function applySignaturePlain(text: string, existingText: string): string {
  const sig = signaturePlain(text);
  if (!sig) return existingText || '';
  return existingText ? `\n\n${sig}\n\n${existingText}` : `\n\n${sig}`;
}
