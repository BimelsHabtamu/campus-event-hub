/* ============================================================
   filters.js — event search, filter & sort logic (pure functions)
   ------------------------------------------------------------
   No DOM, no side effects. Every view (listing, dashboard, and
   future shells) shares one matching/sorting definition, so the
   "events" experience stays consistent.

   Dates are compared against `now` which can be injected for tests.
   ============================================================ */

import { CATEGORY_LABEL } from "./data.js";
import { isSameDay } from "./utils.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * @typedef {Object} EventFilter
 * @property {string} [query]      free-text search term
 * @property {string} [category]   category id, or "all"
 * @property {string} [dateRange]  "all" | "today" | "this-week" | "upcoming" | "past"
 * @property {string} [sort]       "nearest" | "latest" | "az"
 */

/** Date-range option metadata for building selects. */
export const DATE_RANGE_OPTIONS = [
  { id: "all", label: "All dates" },
  { id: "upcoming", label: "Upcoming" },
  { id: "today", label: "Today" },
  { id: "this-week", label: "This week" },
  { id: "past", label: "Past" },
];

/** Sort option metadata for building selects. */
export const SORT_OPTIONS = [
  { id: "nearest", label: "Nearest date" },
  { id: "latest", label: "Latest date" },
  { id: "az", label: "A–Z" },
];

/** True when an event falls inside the requested date range. */
function matchesDateRange(event, dateRange, now) {
  switch (dateRange) {
    case "upcoming":
      return new Date(event.startDateTime).getTime() >= now;
    case "today":
      return isSameDay(event.startDateTime, new Date(now).toISOString());
    case "this-week":
      return (
        new Date(event.startDateTime).getTime() >= now &&
        new Date(event.startDateTime).getTime() < now + WEEK_MS
      );
    case "past":
      return new Date(event.startDateTime).getTime() < now;
    default:
      return true;
  }
}

/** True when every search token appears somewhere in the event. */
function matchesQuery(event, tokens) {
  if (tokens.length === 0) return true;
  const haystack = [
    event.title,
    event.description,
    event.organizer,
    event.location,
    CATEGORY_LABEL[event.category] ?? event.category,
    ...(event.tags || []),
  ]
    .join(" ")
    .toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

/**
 * Apply an EventFilter to a list of events.
 * @param {Array<{id: string, title: string, category: string, startDateTime: string}>} events
 * @param {EventFilter} [filter]
 * @param {number} [now]  timestamp used for date comparisons (tests can inject)
 * @returns {any[]} filtered events (original order)
 */
export function applyFilter(events, filter = {}, now = Date.now()) {
  const { query = "", category = "all", dateRange = "all" } = filter;
  const tokens = String(query).toLowerCase().trim().split(/\s+/).filter(Boolean);

  return events.filter(
    (event) =>
      (category === "all" || event.category === category) &&
      matchesDateRange(event, dateRange, now) &&
      matchesQuery(event, tokens),
  );
}

/**
 * Sort filtered events without mutating the input.
 * @param {any[]} events
 * @param {"nearest" | "latest" | "az"} [sort]
 * @returns {any[]}
 */
export function sortEvents(events, sort = "nearest") {
  const sorted = [...events];
  if (sort === "latest") {
    return sorted.sort((a, b) => new Date(b.startDateTime) - new Date(a.startDateTime));
  }
  if (sort === "az") {
    return sorted.sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
    );
  }
  return sorted.sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime));
}

/** Default filter object every view can spread from. @returns {EventFilter} */
export function createDefaultFilter() {
  return {
    query: "",
    category: "all",
    dateRange: "all",
    sort: "nearest",
  };
}

/**
 * Serialize a filter into URLSearchParams so listing state can be
 * shared via the hash (#/events?q=&cat=&range=&sort=).
 * @param {EventFilter} filter
 * @returns {URLSearchParams}
 */
export function filterToParams(filter) {
  const params = new URLSearchParams();
  if (filter.query) params.set("q", filter.query);
  if (filter.category && filter.category !== "all") params.set("cat", filter.category);
  if (filter.dateRange && filter.dateRange !== "all") params.set("range", filter.dateRange);
  if (filter.sort && filter.sort !== "nearest") params.set("sort", filter.sort);
  return params;
}

/**
 * Rebuild a filter from a URLSearchParams (the inverse of filterToParams).
 * @param {URLSearchParams} params
 * @returns {EventFilter}
 */
export function filterFromParams(params) {
  const defaults = createDefaultFilter();
  const read = (key) => params.get(key)?.trim() || "";
  return {
    query: read("q"),
    category: read("cat") || defaults.category,
    dateRange: read("range") || defaults.dateRange,
    sort: read("sort") || defaults.sort,
  };
}