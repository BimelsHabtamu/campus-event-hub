/* ============================================================
   store.js — LocalStorage persistence layer
   ------------------------------------------------------------
   Everything persisted on the client lives behind this module so
   the storage keys, JSON serialization, and error handling are
   defined in exactly one place. Keys are namespaced with "ceh:".

   Data we persist:
     - ceh:saved         -> array of event ids (saved/bookmarked)
     - ceh:registrations -> array of { eventId, registeredAt }
     - ceh:prefs         -> object of user preferences
     - ceh:users         -> array of registered accounts (hash + salt)
     - ceh:current-user  -> session profile of the signed-in user
   ============================================================ */

const PREFIX = "ceh:";

const KEYS = {
  saved: `${PREFIX}saved`,
  registrations: `${PREFIX}registrations`,
  prefs: `${PREFIX}prefs`,
  users: `${PREFIX}users`,
  currentUser: `${PREFIX}current-user`,
};

export { KEYS };

/** @type {{ [key: string]: unknown }} In-memory fallback when storage is unavailable. */
const memory = {};

/** True when window.localStorage is usable in this environment. */
const storageAvailable = (() => {
  try {
    const probe = `${PREFIX}__probe__`;
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
})();

/**
 * Read and JSON-decode a stored value. Returns `fallback` when
 * missing or unparsable.
 * @template T
 * @param {string} key
 * @param {T} [fallback]
 * @returns {T}
 */
export function read(key, fallback) {
  const raw = storageAvailable ? window.localStorage.getItem(key) : memory[key];
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * JSON-encode and write a value. Swallows quota/security errors
 * and mirrors into memory so reads still work.
 * @param {string} key
 * @param {unknown} value
 */
export function write(key, value) {
  const raw = JSON.stringify(value);
  memory[key] = raw;
  if (storageAvailable) {
    try {
      window.localStorage.setItem(key, raw);
    } catch {
      /* storage full or blocked — in-memory copy is enough for the session */
    }
  }
}

/** Remove a stored value. */
export function remove(key) {
  delete memory[key];
  if (storageAvailable) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* noop */
    }
  }
}

/**
 * Get the array of saved (bookmarked) event ids.
 * @returns {string[]}
 */
export function getSavedEventIds() {
  const value = read(KEYS.saved, []);
  return Array.isArray(value) ? value : [];
}

/**
 * Save a single event id, returning the new list.
 * @param {string} eventId
 * @returns {string[]}
 */
export function saveEvent(eventId) {
  const list = getSavedEventIds();
  if (!list.includes(eventId)) {
    list.push(eventId);
    write(KEYS.saved, list);
  }
  return list;
}

/**
 * Remove a single event id, returning the new list.
 * @param {string} eventId
 * @returns {string[]}
 */
export function unsaveEvent(eventId) {
  const list = getSavedEventIds().filter((id) => id !== eventId);
  write(KEYS.saved, list);
  return list;
}

/** True when the given event is currently saved. */
export function isEventSaved(eventId) {
  return getSavedEventIds().includes(eventId);
}

/**
 * Redirect the navigation targets below to KEYS when Stage 1
 * implements registration and preferences.
 * @returns {Record<"registrations" | "prefs", string>}
 */
export function getStorageKeys() {
  return {
    registrations: KEYS.registrations,
    prefs: KEYS.prefs,
  };
}

export const STORAGE = {
  KEYS,
  available: storageAvailable,
};