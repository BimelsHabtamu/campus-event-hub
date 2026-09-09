/* ============================================================
   utils.js — pure helper functions (date, string, DOM)
   Shared by all views. No side effects.
   ============================================================ */

/**
 * Create a string-safe DOM id from arbitrary text.
 * @param {string} value
 * @returns {string}
 */
export function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Format an ISO date string as a readable "Today/Yesterday/Weekday, Month day" label.
 * @param {string} isoString
 * @returns {string}
 */
export function formatDateLabel(isoString) {
  // TODO (Stage 1): friendly relative labels
  return new Date(isoString).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format an ISO date string as a time label (e.g. "2:00 PM").
 * @param {string} isoString
 * @returns {string}
 */
export function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Format a duration in minutes as a human string (e.g. "2h 30m").
 * @param {number} minutes
 * @returns {string}
 */
export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * True when both times fall on the same calendar day (local time).
 * @param {string} isoA
 * @param {string} isoB
 * @returns {boolean}
 */
export function isSameDay(isoA, isoB) {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Map the throttled output of an input event to a query string.
 * @param {InputEvent} event
 * @returns {string}
 */
export function readSearchValue(event) {
  return event.target.value.trim().toLowerCase();
}

/* ------------------------------------------------------------------
   Feature modules below are imported by views. They are declared
   here so Stage 1 only has to fill in bodies — the module contract
   is stable. Not yet wired into the UI.
------------------------------------------------------------------ */