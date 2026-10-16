/**
 * Calendar maths for study plans.
 *
 * Everything here is pure and timezone-free: dates are handled as
 * "YYYY-MM-DD" strings parsed at UTC noon, so a shifting local timezone
 * can never roll a session onto the wrong day.
 */

/** Hard ceiling on sessions in one plan — keeps generation fast and bounded. */
export const MAX_SESSIONS = 60;

/**
 * Which weekdays a student studies, given how many days a week they want.
 * Index 0 is Sunday, matching Date#getUTCDay.
 */
const WEEKDAY_PATTERNS: Record<number, number[]> = {
  1: [6], //                   Sat
  2: [2, 6], //                Tue, Sat
  3: [1, 3, 5], //             Mon, Wed, Fri
  4: [1, 2, 4, 5], //          Mon, Tue, Thu, Fri
  5: [1, 2, 3, 4, 5], //       Mon–Fri
  6: [1, 2, 3, 4, 5, 6], //    Mon–Sat
  7: [0, 1, 2, 3, 4, 5, 6], // every day
};

function parse(iso: string): Date {
  // Noon UTC keeps us clear of DST and timezone edges on both sides.
  return new Date(`${iso}T12:00:00.000Z`);
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

export function todayISO(): string {
  return toISODate(new Date());
}

/**
 * Every study date from `startDate` up to and including `examDate`,
 * filtered to the weekdays implied by `daysPerWeek`.
 *
 * The exam day itself is excluded — you revise before the exam, not on it.
 * Falls back to every day in range if the pattern yields nothing (which can
 * happen for a very short range that misses the chosen weekdays).
 */
export function buildSchedule(
  startDate: string,
  examDate: string,
  daysPerWeek: number,
): string[] {
  const pattern = new Set(WEEKDAY_PATTERNS[daysPerWeek] ?? WEEKDAY_PATTERNS[5]);
  const end = parse(examDate);
  const all: string[] = [];
  const matching: string[] = [];

  for (let cursor = parse(startDate); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const iso = toISODate(cursor);
    all.push(iso);
    if (pattern.has(cursor.getUTCDay())) matching.push(iso);
  }

  const dates = matching.length > 0 ? matching : all;
  return dates.slice(0, MAX_SESSIONS);
}

/** How many sessions the chosen range *would* have held, before the cap. */
export function countAvailableSessions(
  startDate: string,
  examDate: string,
  daysPerWeek: number,
): number {
  const pattern = new Set(WEEKDAY_PATTERNS[daysPerWeek] ?? WEEKDAY_PATTERNS[5]);
  const end = parse(examDate);
  let matching = 0;
  let total = 0;

  for (let cursor = parse(startDate); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    total += 1;
    if (pattern.has(cursor.getUTCDay())) matching += 1;
  }
  return matching > 0 ? matching : total;
}

/** "Mon 3 Nov" — compact and unambiguous on a phone. */
export function formatShort(iso: string): string {
  return parse(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** "Monday, 3 November 2025" */
export function formatLong(iso: string): string {
  return parse(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "1h 45m", "45m", "2h" */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
