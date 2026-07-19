import { addYears, addDays, differenceInDays, format, startOfDay } from 'date-fns';

export const MAX_WEEKS = 53;

/** @param {string} iso YYYY-MM-DD in local time (avoids UTC parse shift) */
export function parseLocalDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return startOfDay(new Date(y, m - 1, d));
}

/**
 * Build life years from birth anniversaries.
 * Each year runs [Nth birthday, (N+1)th birthday) — addYears handles Feb 29.
 * 365-day spans get 52 real weeks; 366-day (leap) spans get 53.
 * Rows always pad to MAX_WEEKS with dimmed absent slots.
 */
export function buildLifeYears(birth, yearCount, now) {
  const years = [];
  let globalIndex = 0;
  let currentGlobalIndex = -1;

  for (let age = 0; age < yearCount; age++) {
    const start = addYears(birth, age);
    const end = addYears(birth, age + 1);
    const dayCount = differenceInDays(end, start);
    const weekCount = Math.max(1, dayCount >= 366 ? 53 : 52);

    const weeks = [];
    for (let w = 0; w < weekCount; w++) {
      const weekStart = addDays(start, w * 7);
      const weekEnd = w === weekCount - 1 ? end : addDays(start, (w + 1) * 7);
      let status = 'future';
      if (now >= weekEnd) status = 'past';
      else if (now >= weekStart && now < weekEnd) {
        status = 'current';
        currentGlobalIndex = globalIndex;
      }

      weeks.push({ index: globalIndex, status });
      globalIndex += 1;
    }

    for (let w = weekCount; w < MAX_WEEKS; w++) {
      weeks.push({ index: `a-${age}-${w}`, status: 'absent' });
    }

    years.push({ age, start, end, weekCount, weeks });
  }

  return { years, maxWeeks: MAX_WEEKS, currentGlobalIndex, totalWeeks: globalIndex };
}

/**
 * @param {ReturnType<typeof buildLifeYears>['years']} yearRows
 */
export function buildLifetimeWeeks(yearRows) {
  /** @type {Array<{
   *   index: number,
   *   age: number,
   *   weekOfYear: number,
   *   start: Date,
   *   end: Date,
   *   startMs: number,
   *   endMs: number,
   *   status: string,
   *   rangeLabel: string,
   * }>} */
  const list = [];
  for (const year of yearRows) {
    for (let w = 0; w < year.weekCount; w++) {
      const week = year.weeks[w];
      if (typeof week.index !== 'number') continue;
      const start = addDays(year.start, w * 7);
      const end =
        w === year.weekCount - 1 ? year.end : addDays(year.start, (w + 1) * 7);
      list.push({
        index: week.index,
        age: year.age,
        weekOfYear: w,
        start,
        end,
        startMs: start.getTime(),
        endMs: end.getTime(),
        status: week.status,
        rangeLabel: `${format(start, 'MMM d')} – ${format(addDays(end, -1), 'MMM d, yyyy')}`,
      });
    }
  }
  return list;
}

/**
 * @param {Array<{ startMs: number, endMs: number, index: number }>} weeks
 * @param {number} ts
 */
export function findWeekListIndexForTs(weeks, ts) {
  let lo = 0;
  let hi = weeks.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const week = weeks[mid];
    if (ts < week.startMs) hi = mid - 1;
    else if (ts >= week.endMs) lo = mid + 1;
    else return mid;
  }
  return -1;
}

/**
 * @param {number[]} offsets
 * @param {number} y
 */
export function findWeekListIndexAtOffset(offsets, y) {
  let lo = 0;
  let hi = offsets.length - 2;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (y < offsets[mid]) hi = mid - 1;
    else if (y >= offsets[mid + 1]) lo = mid + 1;
    else return mid;
  }
  return Math.max(0, Math.min(offsets.length - 2, lo));
}
