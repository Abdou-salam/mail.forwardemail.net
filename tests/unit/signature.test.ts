/**
 * Signature helper tests. Pure formatting: HTML escaping, the RFC delimiter,
 * and placement above existing content (new message = empty, reply/forward =
 * the quote). Empty signature must be a no-op so callers can concatenate
 * unconditionally.
 */
import { describe, expect, it } from 'vitest';
import {
  signatureHtml,
  signaturePlain,
  applySignatureHtml,
  applySignaturePlain,
} from '../../src/utils/signature';

describe('signature helpers', () => {
  it('returns empty for blank signature text', () => {
    expect(signatureHtml('')).toBe('');
    expect(signatureHtml('   \n  ')).toBe('');
    expect(signaturePlain('')).toBe('');
    expect(applySignatureHtml('', '<p>hi</p>')).toBe('<p>hi</p>');
    expect(applySignaturePlain('', 'body')).toBe('body');
  });

  it('escapes HTML and converts newlines to <br>', () => {
    const html = signatureHtml('Jane <b>Doe</b>\nA & B');
    expect(html).toContain('Jane &lt;b&gt;Doe&lt;/b&gt;');
    expect(html).toContain('A &amp; B');
    expect(html).toContain('<br>');
    expect(html).toContain('data-fe-signature="true"');
  });

  it('uses the RFC 3676 delimiter in plain text', () => {
    expect(signaturePlain('Jane\nForward Email')).toBe('-- \nJane\nForward Email');
  });

  it('places the signature above existing content with a leading blank line', () => {
    const quote = '<blockquote>original</blockquote>';
    const out = applySignatureHtml('Jane', quote);
    // Leading cursor line, then signature, then the quote.
    expect(out.startsWith('<p><br></p>')).toBe(true);
    expect(out.indexOf('Jane')).toBeLessThan(out.indexOf('blockquote'));
  });

  it('new message (no existing content) is just the cursor line + signature', () => {
    const out = applySignatureHtml('Jane', '');
    expect(out).toBe('<p><br></p><p class="fe-signature" data-fe-signature="true">-- <br>Jane</p>');
  });

  it('plain-text placement keeps the signature above the quote', () => {
    const out = applySignaturePlain('Jane', 'On x, y wrote:\n> hi');
    expect(out.indexOf('-- ')).toBeLessThan(out.indexOf('> hi'));
    expect(out.startsWith('\n\n-- \nJane')).toBe(true);
  });
});
