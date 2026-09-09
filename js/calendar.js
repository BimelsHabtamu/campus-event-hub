/* ============================================================
   calendar.js — month grid calendar
   ------------------------------------------------------------
   Pure calendar math + a container render contract. The view is
   mounted into #calendar-view by views.js in Stage 1.
   ============================================================ */

/**
 * Build the 6x7 slot grid (always 42 cells) for a month.
 * Cells before day 1 belong to the previous month, after the last
 * day to the next month — with `inMonth:false` so views can dim them.
 * @param {number} year
 * @param {number} month 1..12
 * @returns {{ year: number, month: number, day: number, inMonth: boolean }[]}
 */
export function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrev = new Date(year, month - 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay(); // 0 = Sunday

  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const offset = i - startWeekday;
    let y = year;
    let m = month;
    let ref;
    if (offset < 0) {
      m = month - 1;
      if (m === 0) { m = 12; y -= 1; }
      ref = daysInPrev + 1 + offset;
    } else if (offset >= daysInMonth) {
      m = month + 1;
      if (m === 13) { m = 1; y += 1; }
      ref = offset - daysInMonth + 1;
    } else {
      ref = offset + 1;
    }
    cells.push({ year: y, month: m, day: ref, inMonth: offset >= 0 && offset < daysInMonth });
  }
  return cells;
}

/** Calendar at the reference "today". @returns {{ year: number, month: number }} */
export function getCurrentMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/**
 * Move a month reference forward/backward by delta steps.
 * @param {{year:number, month:number}} ref
 * @param {number} delta
 * @returns {{year:number, month:number}}
 */
export function shiftMonth(ref, delta) {
  const date = new Date(ref.year, ref.month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

/**
 * Group the event list by a "YYYY-MM-DD" key.
 * TODO (Stage 1): implemented to seed the calendar's day cells.
 * @param {any[]} events
 * @returns {Record<string, any[]>}
 */
export function groupEventsByDay(events) {
  return events.reduce((groups, event) => {
    const d = new Date(event.startDateTime);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    (groups[key] ??= []).push(event);
    return groups;
  }, {});
}