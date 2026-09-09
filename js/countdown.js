/* ============================================================
   countdown.js — "time until event" countdown
   ------------------------------------------------------------
   Exposes a single source of truth for countdown values and a
   render hook. Stage 1 wires it into event cards and detail pages.
   ============================================================ */

/**
 * Break an ISO timestamp down into days/hours/minutes/seconds left.
 * Returns meters of zero when the target is in the past.
 * @param {string} isoString target date
 * @returns {{ days: number, hours: number, minutes: number, seconds: number, isPast: boolean }}
 */
export function getCountdownParts(isoString) {
  const delta = Math.max(0, new Date(isoString).getTime() - Date.now());
  const seconds = Math.floor(delta / 1000) % 60;
  const minutes = Math.floor(delta / 60000) % 60;
  const hours = Math.floor(delta / 3600000) % 24;
  const days = Math.floor(delta / 86400000);
  return { days, hours, minutes, seconds, isPast: delta === 0 };
}

/**
 * Pad a segment to two digits ("3" -> "03").
 * @param {number} n
 * @returns {string}
 */
export function pad(n) {
  return String(n).padStart(2, "0");
}

/** Human label like "3d 04h 12m 08s". TODO (Stage 1): render segments. */
export function formatCountdown(parts) {
  const { days, hours, minutes, seconds, isPast } = parts;
  if (isPast) return "Started";
  return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

/**
 * Register an element whose textContent is refreshed every interval.
 * TODO (Stage 1): implemented by the countdown UI component.
 * @param {HTMLElement} element
 * @param {string} isoString
 * @param {number} [intervalMs=1000]
 * @returns {() => void} stop function
 */
export function startCountdown(element, isoString, intervalMs = 1000) {
  let timer = null;
  const tick = () => {
    element.textContent = formatCountdown(getCountdownParts(isoString));
  };
  tick();
  timer = window.setInterval(tick, intervalMs);
  return () => window.clearInterval(timer);
}