import { describe, it, expect } from 'vitest';
import { parseNaturalLanguage } from '../../src/utils/calendar-nlp';

const NOW = new Date('2026-06-15T12:00:00Z');

describe('parseNaturalLanguage — bare numbers stay in the title (the reported bug)', () => {
  it('does NOT treat a leading year as a time', () => {
    const r = parseNaturalLanguage('2025 planning', NOW);
    expect(r?.title).toBe('2025 planning');
    expect(r?.startTime).toBeUndefined();
  });

  it('does NOT treat a count like "5k run" as a time', () => {
    const r = parseNaturalLanguage('5k run', NOW);
    expect(r?.title).toBe('5k run');
    expect(r?.startTime).toBeUndefined();
  });

  it('does NOT treat "1 on 1" as a time', () => {
    const r = parseNaturalLanguage('1 on 1', NOW);
    expect(r?.title).toBe('1 on 1');
    expect(r?.startTime).toBeUndefined();
  });

  it('does NOT treat "1:1" (single-digit minute) as a time', () => {
    const r = parseNaturalLanguage('1:1 sync', NOW);
    expect(r?.title).toBe('1:1 sync');
    expect(r?.startTime).toBeUndefined();
  });
});

describe('parseNaturalLanguage — real time signals still parse', () => {
  it('parses a meridiem time and strips it', () => {
    const r = parseNaturalLanguage('Lunch 3pm', NOW);
    expect(r?.title).toBe('Lunch');
    expect(r?.startTime).toBe('03:00');
    expect(r?.startMeridiem).toBe('PM');
  });

  it('parses an h:mm meridiem time', () => {
    const r = parseNaturalLanguage('Lunch 3:30pm', NOW);
    expect(r?.startTime).toBe('03:30');
    expect(r?.startMeridiem).toBe('PM');
    expect(r?.title).toBe('Lunch');
  });

  it('parses a meridiem range', () => {
    const r = parseNaturalLanguage('standup 9am-10am', NOW);
    expect(r?.title).toBe('standup');
    expect(r?.startTime).toBe('09:00');
    expect(r?.startMeridiem).toBe('AM');
    expect(r?.endTime).toBe('10:00');
    expect(r?.endMeridiem).toBe('AM');
  });

  it('parses a 24-hour colon time (no meridiem)', () => {
    const r = parseNaturalLanguage('sync 14:30', NOW);
    expect(r?.title).toBe('sync');
    expect(r?.startTime).toBe('02:30');
    expect(r?.startMeridiem).toBe('PM');
  });

  it('parses a colon range without meridiems', () => {
    const r = parseNaturalLanguage('review 9:45-10:15', NOW);
    expect(r?.title).toBe('review');
    expect(r?.startTime).toBe('09:45');
    expect(r?.endTime).toBe('10:15');
  });
});

describe('parseNaturalLanguage — dates', () => {
  it('extracts tomorrow and removes both tokens, keeping the rest of the title', () => {
    const r = parseNaturalLanguage('meeting tomorrow 2pm', NOW);
    expect(r?.date).toBe('2026-06-16');
    expect(r?.startTime).toBe('02:00');
    expect(r?.startMeridiem).toBe('PM');
    expect(r?.title).toBe('meeting');
  });

  it('extracts today', () => {
    const r = parseNaturalLanguage('review today', NOW);
    expect(r?.date).toBe('2026-06-15');
    expect(r?.title).toBe('review');
  });

  it('leaves a year-only title untouched (no date, no time)', () => {
    const r = parseNaturalLanguage('Q1 2026 roadmap', NOW);
    expect(r?.title).toBe('Q1 2026 roadmap');
    expect(r?.date).toBeUndefined();
    expect(r?.startTime).toBeUndefined();
  });

  it('returns null for empty input', () => {
    expect(parseNaturalLanguage('', NOW)).toBeNull();
  });
});
