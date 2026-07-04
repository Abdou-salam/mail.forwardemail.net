import { describe, it, expect } from 'vitest';
import {
  getSafeFilename,
  extractHeaders,
  looksLikeHtml,
  normalizeHeaders,
  buildOriginalViewerPage,
  pickOriginalContent,
} from '../../src/stores/mailbox-actions-helpers';
import { DARK_SURFACE } from '../../src/utils/dark-surface';

describe('getSafeFilename', () => {
  it('replaces unsafe characters with underscores and appends the suffix', () => {
    expect(getSafeFilename('Hello World!', 'eml')).toBe('Hello_World_.eml');
  });

  it('defaults to "message" for empty/whitespace subjects', () => {
    expect(getSafeFilename('', 'eml')).toBe('message.eml');
    expect(getSafeFilename('   ', 'eml')).toBe('message.eml');
    expect(getSafeFilename(undefined, 'txt')).toBe('message.txt');
  });

  it('keeps alphanumerics, dot, hyphen and underscore', () => {
    expect(getSafeFilename('re-2024_v1.2', 'eml')).toBe('re-2024_v1.2.eml');
  });

  it('strips path-unsafe characters including backslash, slash and brackets', () => {
    // The original regex bug let `\` `]` `^` through (and dropped `-`); guard it.
    expect(getSafeFilename('a\\b/c]d^e', 'eml')).toBe('a_b_c_d_e.eml');
  });
});

describe('extractHeaders', () => {
  it('returns everything before the first blank line', () => {
    expect(extractHeaders('From: a@b.com\nSubject: Hi\n\nbody text')).toBe(
      'From: a@b.com\nSubject: Hi',
    );
  });

  it('normalizes CRLF before splitting', () => {
    expect(extractHeaders('From: a@b.com\r\nSubject: Hi\r\n\r\nbody')).toBe(
      'From: a@b.com\nSubject: Hi',
    );
  });

  it('returns the whole trimmed string when there is no blank-line divider', () => {
    expect(extractHeaders('From: a@b.com\nSubject: Hi')).toBe('From: a@b.com\nSubject: Hi');
  });

  it('returns empty for empty input', () => {
    expect(extractHeaders('')).toBe('');
  });
});

describe('looksLikeHtml', () => {
  it('detects html/body tags', () => {
    expect(looksLikeHtml('<html><body>hi</body></html>')).toBe(true);
    expect(looksLikeHtml('prefix <body class="x">')).toBe(true);
  });

  it('is false for plain text or partial words', () => {
    expect(looksLikeHtml('just some text')).toBe(false);
    expect(looksLikeHtml('the htmlish word bodysuit')).toBe(false);
  });
});

describe('normalizeHeaders', () => {
  it('trims a string passthrough', () => {
    expect(normalizeHeaders('  From: a@b.com  ')).toBe('From: a@b.com');
  });

  it('joins an array with newlines', () => {
    expect(normalizeHeaders(['From: a@b.com', 'To: c@d.com'])).toBe('From: a@b.com\nTo: c@d.com');
  });

  it('renders an object, comma-joining array values', () => {
    expect(normalizeHeaders({ From: 'a@b.com', References: ['<1>', '<2>'] })).toBe(
      'From: a@b.com\nReferences: <1>, <2>',
    );
  });

  it('falls back to parsing the raw header block when given a header-like string', () => {
    expect(normalizeHeaders(null, 'From: a@b.com\nSubject: Hi\n\nbody')).toBe(
      'From: a@b.com\nSubject: Hi',
    );
  });

  it('returns empty when the fallback raw has no header-looking lines', () => {
    expect(normalizeHeaders(null, 'just a body with no headers')).toBe('');
  });
});

describe('pickOriginalContent', () => {
  it('prefers raw, then body, then textContent', () => {
    expect(pickOriginalContent({ raw: 'R', body: 'B', textContent: 'T' })).toBe('R');
    expect(pickOriginalContent({ body: 'B', textContent: 'T' })).toBe('B');
    expect(pickOriginalContent({ textContent: 'T' })).toBe('T');
  });

  it('returns empty for null/empty content', () => {
    expect(pickOriginalContent(null)).toBe('');
    expect(pickOriginalContent({})).toBe('');
  });
});

describe('buildOriginalViewerPage', () => {
  it('embeds the message data as JSON and derives the download filename', () => {
    const page = buildOriginalViewerPage({
      raw: 'RAW SOURCE',
      headers: 'H',
      subject: 'My Subject',
    });
    expect(page).toContain('"raw":"RAW SOURCE"');
    expect(page).toContain('"filename":"My_Subject.eml"');
  });

  it('HTML-escapes the subject in the <h1> (no markup injection)', () => {
    const page = buildOriginalViewerPage({ subject: '<img src=x onerror=alert(1)>' });
    expect(page).toContain('<h1>&lt;img src=x onerror=alert(1)&gt;</h1>');
    expect(page).not.toContain('<h1><img');
  });

  it('escapes </ sequences in embedded data so it cannot break out of <script>', () => {
    const page = buildOriginalViewerPage({ raw: '</script><script>alert(1)</script>' });
    // Only the page's own closing </script> tag remains literal; the data's are escaped.
    expect(page.split('</script>').length - 1).toBe(1);
    expect(page).toContain('<\\/script>');
  });

  it('includes dark-surface tokens only when not in light mode', () => {
    const dark = buildOriginalViewerPage({ isLightMode: false });
    const light = buildOriginalViewerPage({ isLightMode: true });
    expect(dark).toContain(`background: ${DARK_SURFACE.surface}`);
    expect(light).not.toContain(`background: ${DARK_SURFACE.surface}`);
  });

  it('embeds raw source into the page data', () => {
    const page = buildOriginalViewerPage({ raw: 'Subject: test\r\n\r\nHello body' });
    expect(page).toContain('Subject: test');
  });

  it('includes decrypted body block when decrypted text is provided', () => {
    const page = buildOriginalViewerPage({ raw: 'headers', decrypted: 'Hello decrypted' });
    expect(page).toContain('"decrypted":"Hello decrypted"');
    expect(page).toContain('decryptedBlock');
    expect(page).toContain('decryptedFrame');
    expect(page).toContain('decryptedPre');
  });

  it('hides decrypted block when no decrypted content is provided', () => {
    const page = buildOriginalViewerPage({ raw: 'headers' });
    expect(page).toContain('"decrypted":""');
    expect(page).toContain('style="display:none;"');
  });
});
