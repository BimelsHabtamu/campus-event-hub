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
 * Get all registrations from LocalStorage.
 * @returns {Array<object>}
 */
export function getRegistrations() {
  const value = read(KEYS.registrations, []);
  return Array.isArray(value) ? value : [];
}

/**
 * Get all registrations for a specific event.
 * @param {string} eventId
 * @returns {Array<object>}
 */
export function getEventRegistrations(eventId) {
  return getRegistrations().filter((r) => r.eventId === eventId);
}

/**
 * Find a user's registration for an event.
 * @param {string} eventId
 * @param {string} userEmail
 * @returns {object | undefined}
 */
export function getUserRegistration(eventId, userEmail) {
  if (!userEmail) return undefined;
  const cleanEmail = String(userEmail).trim().toLowerCase();
  return getRegistrations().find(
    (r) => r.eventId === eventId && r.userEmail && r.userEmail.trim().toLowerCase() === cleanEmail,
  );
}

/**
 * Get every registration belonging to a user (email is normalized).
 * @param {string} userEmail
 * @returns {Array<object>}
 */
export function getUserRegistrations(userEmail) {
  if (!userEmail) return [];
  const cleanEmail = String(userEmail).trim().toLowerCase();
  return getRegistrations().filter(
    (r) => r.userEmail && r.userEmail.trim().toLowerCase() === cleanEmail,
  );
}

/**
 * True when the user is registered for the event.
 * @param {string} eventId
 * @param {string} userEmail
 * @returns {boolean}
 */
export function isUserRegistered(eventId, userEmail) {
  return !!getUserRegistration(eventId, userEmail);
}

/**
 * Register a user for an event.
 * @param {{ eventId: string, userId?: string, userEmail: string, userName: string, studentId?: string, notes?: string }} data
 * @returns {{ ok: true, registration: object } | { ok: false, error: string }}
 */
export function registerForEvent(data) {
  const { eventId, userId = "", userEmail, userName, studentId = "", notes = "" } = data;
  if (!eventId || !userEmail) {
    return { ok: false, error: "Missing event or user email." };
  }

  const cleanEmail = userEmail.trim().toLowerCase();
  if (isUserRegistered(eventId, cleanEmail)) {
    return { ok: false, error: "You are already registered for this event." };
  }

  const registrations = getRegistrations();
  const newRecord = {
    id: `reg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    eventId,
    userId,
    userEmail: cleanEmail,
    userName: (userName || "").trim(),
    studentId: (studentId || "").trim(),
    notes: (notes || "").trim(),
    registeredAt: new Date().toISOString(),
  };

  registrations.push(newRecord);
  write(KEYS.registrations, registrations);
  return { ok: true, registration: newRecord };
}

/**
 * Cancel a user's event registration.
 * @param {string} eventId
 * @param {string} userEmail
 * @returns {{ ok: boolean, error?: string }}
 */
export function cancelEventRegistration(eventId, userEmail) {
  if (!eventId || !userEmail) {
    return { ok: false, error: "Missing event or user email." };
  }
  const cleanEmail = userEmail.trim().toLowerCase();
  const registrations = getRegistrations();
  const initialLength = registrations.length;
  const updated = registrations.filter(
    (r) => !(r.eventId === eventId && r.userEmail && r.userEmail.trim().toLowerCase() === cleanEmail),
  );

  if (updated.length === initialLength) {
    return { ok: false, error: "Registration not found." };
  }

  write(KEYS.registrations, updated);
  return { ok: true };
}

/**
 * Calculate capacity statistics for an event.
 * @param {{ id: string, capacity: number }} event
 * @returns {{ total: number, booked: number, available: number, isFull: boolean }}
 */
export function getEventCapacityStats(event) {
  const total = Number(event.capacity) || 0;
  const booked = getEventRegistrations(event.id).length;
  const available = Math.max(0, total - booked);
  return {
    total,
    booked,
    available,
    isFull: available === 0,
  };
}

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