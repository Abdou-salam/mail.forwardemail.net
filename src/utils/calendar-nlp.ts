/**
 * calendar-nlp.ts — tiny natural-language parser for the calendar quick-add
 * title field. Extracts a date ("today"/"tomorrow") and a time/time-range from
 * what the user types and returns the cleaned title with those tokens removed.
 *
 * Why this is its own (tested) module: the time matcher used to accept a BARE
 * number as a time (the meridiem and the `:MM` were both optional), so titles
 * that merely START with digits — a year ("2025 planning"), a count ("5k run"),
 * "1 on 1" — had their leading number misread as a start time and stripped from
 * the title. A number is now only treated as a time when it carries a clear
 * signal: a meridiem (3pm) or a colon (14:30).
 */

export interface ParsedNaturalLanguage {
  title: string;
  date?: string;
  startTime?: string;
  startMeridiem?: string;
  endTime?: string;
  endMeridiem?: string;
}

const toISODate = (d: Date): string => d.toISOString().split('T')[0];

export function parseNaturalLanguage(
  input: string,
  now: Date = new Date(),
): ParsedNaturalLanguage | null {
  if (!input) return null;

  const result: ParsedNaturalLanguage = { title: input };

  const tomorrowMatch = input.match(/\btomorrow\b/i);
  const todayMatch = input.match(/\btoday\b/i);

  if (tomorrowMatch) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    result.date = toISODate(tomorrow);
    result.title = input.replace(/\btomorrow\b/i, '').trim();
  } else if (todayMatch) {
    result.date = toISODate(now);
    result.title = input.replace(/\btoday\b/i, '').trim();
  }

  // Require a clear time signal. Two ordered alternatives, both capturing groups
  // in the same order [full, h1, m1, mer1, h2, m2, mer2] so the destructuring
  // below is shared:
  //   1. meridiem form — "3pm", "3:30 pm", "9am-10am" (am/pm REQUIRED on start)
  //   2. colon form    — "14:30", "9:45-10:15"        (a colon, am/pm optional)
  // A bare number with neither ("2025", "5") matches nothing and stays in the title.
  const timeMatch =
    input.match(
      /(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?:\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i,
    ) || input.match(/(\d{1,2}):(\d{2})\s*(am|pm)?(?:\s*[-–]\s*(\d{1,2}):(\d{2})\s*(am|pm)?)?/i);

  if (timeMatch) {
    const [, h1, m1 = '00', mer1, h2, m2 = '00', mer2] = timeMatch;

    let startH = parseInt(h1, 10);
    const startM = m1;
    let startMer = (mer1 || '').toUpperCase();

    if (!startMer) {
      startMer = startH >= 7 && startH <= 11 ? 'AM' : startH >= 12 ? 'PM' : 'AM';
    }

    if (startH > 12) {
      startMer = startH >= 12 ? 'PM' : 'AM';
      startH = startH > 12 ? startH - 12 : startH;
    }

    result.startTime = `${String(startH).padStart(2, '0')}:${startM}`;
    result.startMeridiem = startMer;

    if (h2) {
      let endH = parseInt(h2, 10);
      const endM = m2;
      let endMer = (mer2 || mer1 || '').toUpperCase();

      if (!endMer) {
        endMer = endH >= 12 ? 'PM' : startMer;
      }

      if (endH > 12) {
        endMer = 'PM';
        endH = endH - 12;
      }

      result.endTime = `${String(endH).padStart(2, '0')}:${endM}`;
      result.endMeridiem = endMer;
    }

    result.title = result.title.replace(timeMatch[0], '').trim();
  }

  result.title = result.title.replace(/\s+/g, ' ').trim();

  return result;
}
