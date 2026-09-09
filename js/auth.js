/* ============================================================
   auth.js — account registration, login, and logout
   ------------------------------------------------------------
   Persistence goes through store.js (localStorage). Passwords are
   stored as salted SHA-256 hashes — never in plain text.

   Public API:
     normalizeEmail()
     validateRegistration(profile)  -> { valid, errors }
     validateLogin(credentials)     -> { valid, errors }
     createUserAccount(profile)     -> { ok, user } | { ok, error }
     login(email, password)         -> { ok, user } | { ok, error }
     getCurrentUser()               -> profile | null
     isLoggedIn()                   -> boolean
     logout()
   ============================================================ */

import { read, write, remove, KEYS } from "./store.js";

const USERS_KEY = KEYS.users;
const CURRENT_USER_KEY = KEYS.currentUser;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{2,50}$/;

/* ------------------------------------------------------------
   Password hashing
   ------------------------------------------------------------ */

/** @param {string} value @returns {string} */
function fallbackHash(value) {
  // djb2 (non-crypto fallback for environments without crypto.subtle)
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33 + value.charCodeAt(i)) | 0;
  }
  return `f${(hash >>> 0).toString(16)}`;
}

/** @param {string} text @returns {Promise<string>} hex digest */
async function digestHex(text) {
  if (globalThis.crypto && typeof globalThis.crypto.subtle === "object") {
    const buffer = await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(text),
    );
    return [...new Uint8Array(buffer)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }
  return fallbackHash(text);
}

/** @param {number} bytes @returns {string} */
function randomHex(bytes) {
  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function") {
    const arr = new Uint8Array(bytes);
    globalThis.crypto.getRandomValues(arr);
    return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return Math.random().toString(16).slice(2);
}

/**
 * Hash a password with a per-user salt (sha256(salt :: pepper :: password)).
 * @param {string} password
 * @param {string} salt
 * @returns {Promise<string>}
 */
export async function hashPassword(password, salt) {
  return digestHex(`${salt}::campus-event-hub::${password}`);
}

/* ------------------------------------------------------------
   Account store
   ------------------------------------------------------------ */

/** @returns {Array} */
function getUsers() {
  const users = read(USERS_KEY, []);
  return Array.isArray(users) ? users : [];
}

function saveUsers(users) {
  write(USERS_KEY, users);
}

/** Strip hash/salt before returning a user to the UI. */
function toPublicUser(user) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    createdAt: user.createdAt,
  };
}

/** @param {string} email */
export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/* ------------------------------------------------------------
   Validation (client-side)
   ------------------------------------------------------------ */

/**
 * Validate a registration form submission.
 * @returns {{ valid: boolean, errors: Record<string,string> }}
 */
export function validateRegistration(profile) {
  const errors = {};
  const firstName = String(profile.firstName || "").trim();
  const lastName = String(profile.lastName || "").trim();
  const password = String(profile.password || "");

  if (!firstName) errors.firstName = "First name is required.";
  else if (!NAME_RE.test(firstName)) errors.firstName = "Use 2–50 letters (apostrophes and hyphens allowed).";

  if (!lastName) errors.lastName = "Last name is required.";
  else if (!NAME_RE.test(lastName)) errors.lastName = "Use 2–50 letters (apostrophes and hyphens allowed).";

  const email = normalizeEmail(profile.email);
  if (!email) errors.email = "Email address is required.";
  else if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";

  if (!password) errors.password = "Password is required.";
  else if (password.length < 8) errors.password = "Password must be at least 8 characters.";
  else if (!/[a-zA-Z]/.test(password)) errors.password = "Password must include a letter.";
  else if (!/[0-9]/.test(password)) errors.password = "Password must include a number.";

  if (String(profile.confirm || "") !== password) {
    errors.confirm = "Passwords do not match.";
  }

  if (!profile.terms) errors.terms = "You must accept the Terms of Service to continue.";

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Validate a login form submission.
 * @returns {{ valid: boolean, errors: Record<string,string> }}
 */
export function validateLogin({ email = "", password = "" } = {}) {
  const errors = {};
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail) errors.email = "Email address is required.";
  else if (!EMAIL_RE.test(cleanEmail)) errors.email = "Enter a valid email address.";

  if (!password) errors.password = "Password is required.";

  return { valid: Object.keys(errors).length === 0, errors };
}

/* ------------------------------------------------------------
   Register / login / logout
   ------------------------------------------------------------ */

/**
 * Create a new account. Fails cleanly when the email is taken.
 * @param {{ firstName: string, lastName: string, email: string, password: string }} profile
 * @returns {Promise<{ ok: true, user: object } | { ok: false, error: object }>}
 */
export async function createUserAccount(profile) {
  const email = normalizeEmail(profile.email);
  const existing = getUsers().find((user) => user.email === email);
  if (existing) {
    return { ok: false, error: { email: "This email is already registered. Try logging in instead." } };
  }

  const salt = randomHex(16);
  const passwordHash = await hashPassword(profile.password, salt);

  const user = {
    id: `u_${Date.now().toString(36)}_${randomHex(4)}`,
    firstName: String(profile.firstName).trim(),
    lastName: String(profile.lastName).trim(),
    email,
    salt,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  const users = getUsers();
  users.push(user);
  saveUsers(users);

  return { ok: true, user: toPublicUser(user) };
}

/**
 * Verify credentials and open a session (persists the current user).
 * @returns {Promise<{ ok: true, user: object } | { ok: false, error: string }>}
 */
export async function login(email, password) {
  const cleanEmail = normalizeEmail(email);
  const user = getUsers().find((existing) => existing.email === cleanEmail);

  if (!user) {
    return { ok: false, error: "No account found with this email address." };
  }

  const hash = await hashPassword(password, user.salt);
  if (hash !== user.passwordHash) {
    return { ok: false, error: "Incorrect password. Please try again." };
  }

  const publicUser = toPublicUser(user);
  write(CURRENT_USER_KEY, publicUser);
  return { ok: true, user: publicUser };
}

/** Profile of the signed-in user, or null. */
export function getCurrentUser() {
  return read(CURRENT_USER_KEY, null);
}

export function isLoggedIn() {
  return !!getCurrentUser();
}

/** End the session. */
export function logout() {
  remove(CURRENT_USER_KEY);
}