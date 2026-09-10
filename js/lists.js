/* ============================================================
   lists.js — pure view-model builders for dashboard listings
   ------------------------------------------------------------
   Turns "which ids are saved / which registrations exist" into
   ordered lists of { event, registration? } records that
   dashboard.js renders. No DOM, extra data, or storage access.
   ============================================================ */

import { sortEvents } from "./filters.js";

/**
 * The saved events the user bookmarked, nearest date first.
 * @param {{ events: any[], savedIds: string[] }} input
 * @returns {any[]}
 */
export function getSavedEvents({ events, savedIds }) {
  const ids = Array.isArray(savedIds) ? savedIds : [];
  return sortEvents(events.filter((event) => ids.includes(event.id)), "nearest");
}

/**
 * Events the user registered for, joined to their registration
 * record and ordered by start time (earliest first).
 * Unknown/removed event ids are dropped.
 * @param {{ events: any[], registrations: any[] }} input
 * @returns {Array<{ event: any, registration: object }>}
 */
export function getRegisteredEvents({ events, registrations }) {
  const eventById = new Map(events.map((event) => [event.id, event]));
  return (Array.isArray(registrations) ? registrations : [])
    .map((registration) => ({
      event: eventById.get(registration.eventId),
      registration,
    }))
    .filter(({ event }) => Boolean(event))
    .sort((a, b) => new Date(a.event.startDateTime) - new Date(b.event.startDateTime));
}