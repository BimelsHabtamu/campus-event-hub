/* ============================================================
   router.js — tiny hash-based SPA router
   ------------------------------------------------------------
   Routes (hash fragment):
     #/home               public landing (default)
     #/events             public event listing
     #/event/:id          event detail
     #/dashboard          dashboard home (app shell default)
     #/my-events          my registered events
     #/saved              saved events
     #/calendar           calendar view
     #/profile            profile
     #/settings           settings
   ============================================================ */

import { slugify } from "./utils.js";

/**
 * @typedef {Object} Route
 * @property {string|null} page  view name (null when hash is empty)
 * @property {string} id         optional event id for detail routes
 * @property {URLSearchParams|null} query
 */

/** Map a hash fragment to a Route object. */
export function parseHash(hash) {
  const raw = hash.replace(/^#\/?/, "");
  const [pathPart = "", queryPart = ""] = raw.split("?");
  const segments = pathPart.split("/").map((s) => s.trim()).filter(Boolean);
  const nextRoute = {
    page: null,
    id: null,
    query: null,
  };

  if (segments.length > 0) {
    const first = slugify(segments[0]);
    if (first === "event" && segments[1]) {
      nextRoute.page = "event-detail";
      nextRoute.id = segments[1];
    } else if (["home", "events", "calendar", "saved", "dashboard", "my-events", "profile", "settings"].includes(first)) {
      nextRoute.page = first;
    }
  }

  if (queryPart) nextRoute.query = new URLSearchParams(queryPart);
  return nextRoute;
}

/**
 * Navigate to a route without reloading the page.
 * @param {string} path  e.g. "/events", "/event/my-event"
 */
export function navigate(path) {
  const target = `#${path}`;
  if (window.location.hash === target) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = target;
  }
}

/**
 * Subscribe to route changes. Returns an unsubscribe function.
 * @param {(route: Route) => void} handler
 * @returns {() => void}
 */
export function onRouteChange(handler) {
  const listener = () => {
    handler(parseHash(window.location.hash));
  };
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}