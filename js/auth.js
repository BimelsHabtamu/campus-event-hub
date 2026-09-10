import { read, write, remove, KEYS } from "./store.js";

const USERS_KEY = KEYS.users;
const CURRENT_USER_KEY = KEYS.currentUser;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{2,50}$/;

/* ------------------------------------------------------------
   Password hashing
   ------------------------------------------------------------ */

/**
 * @param {string} value
 * @returns {string}
 */
function fallbackHash(value) {
  // djb2 fallback for environments without crypto.subtle
  let hash = 5381;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33 + value.charCodeAt(i)) | 0;
  }

  return `f${(hash >>> 0).toString(16)}`;
}

/**
 * @param {string} text
 * @returns {Promise<string>}
 */
async function digestHex(text) {
  if (
    globalThis.crypto &&
    typeof globalThis.crypto.subtle === "object"
  ) {
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

/**
 * @param {number} bytes
 * @returns {string}
 */
function randomHex(bytes) {
  if (
    globalThis.crypto &&
    typeof globalThis.crypto.getRandomValues === "function"
  ) {
    const arr = new Uint8Array(bytes);
    globalThis.crypto.getRandomValues(arr);

    return [...arr]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  return Math.random().toString(16).slice(2);
}

/**
 * Hash a password with a per-user salt.
 *
 * @param {string} password
 * @param {string} salt
 * @returns {Promise<string>}
 */
export async function hashPassword(password, salt) {
  return digestHex(
    `${salt}::campus-event-hub::${password}`,
  );
}

/* ------------------------------------------------------------
   Account store
   ------------------------------------------------------------ */

/**
 * @returns {Array}
 */
function getUsers() {
  const users = read(USERS_KEY, []);
  return Array.isArray(users) ? users : [];
}

/**
 * @param {Array} users
 */
function saveUsers(users) {
  write(USERS_KEY, users);
}

/**
 * Remove password hash and salt before returning a user to UI.
 *
 * @param {object} user
 * @returns {object}
 */
function toPublicUser(user) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role || "student",
    studentId: user.studentId || "",
    major: user.major || "",
    year: user.year || "",
    profileImage: user.profileImage || "",
    createdAt: user.createdAt,
  };
}

/**
 * @param {string} email
 * @returns {string}
 */
export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/* ------------------------------------------------------------
   Validation
   ------------------------------------------------------------ */

/**
 * Validate registration form.
 *
 * @returns {{valid: boolean, errors: Record<string,string>}}
 */
export function validateRegistration(profile) {
  const errors = {};

  const firstName = String(profile.firstName || "").trim();
  const lastName = String(profile.lastName || "").trim();
  const password = String(profile.password || "");

  if (!firstName) {
    errors.firstName = "First name is required.";
  } else if (!NAME_RE.test(firstName)) {
    errors.firstName =
      "Use 2–50 letters (apostrophes and hyphens allowed).";
  }

  if (!lastName) {
    errors.lastName = "Last name is required.";
  } else if (!NAME_RE.test(lastName)) {
    errors.lastName =
      "Use 2–50 letters (apostrophes and hyphens allowed).";
  }

  const email = normalizeEmail(profile.email);

  if (!email) {
    errors.email = "Email address is required.";
  } else if (!EMAIL_RE.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!password) {
    errors.password = "Password is required.";
  } else if (password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  } else if (!/[a-zA-Z]/.test(password)) {
    errors.password = "Password must include a letter.";
  } else if (!/[0-9]/.test(password)) {
    errors.password = "Password must include a number.";
  }

  if (String(profile.confirm || "") !== password) {
    errors.confirm = "Passwords do not match.";
  }

  if (!profile.terms) {
    errors.terms =
      "You must accept the Terms of Service to continue.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate login form.
 *
 * @returns {{valid: boolean, errors: Record<string,string>}}
 */
export function validateLogin({ email = "", password = "" } = {}) {
  const errors = {};
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail) {
    errors.email = "Email address is required.";
  } else if (!EMAIL_RE.test(cleanEmail)) {
    errors.email = "Enter a valid email address.";
  }

  if (!password) {
    errors.password = "Password is required.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/* ------------------------------------------------------------
   Register / Login / Logout
   ------------------------------------------------------------ */

/**
 * Create a new account.
 *
 * @param {{
 *   firstName: string,
 *   lastName: string,
 *   email: string,
 *   password: string,
 *   role?: string,
 *   studentId?: string,
 *   major?: string,
 *   year?: string,
 *   profileImage?: string
 * }} profile
 */
export async function createUserAccount(profile) {
  const email = normalizeEmail(profile.email);

  const existing = getUsers().find(
    (user) => user.email === email,
  );

  if (existing) {
    return {
      ok: false,
      error: {
        email:
          "This email is already registered. Try logging in instead.",
      },
    };
  }

  const salt = randomHex(16);
  const passwordHash = await hashPassword(
    profile.password,
    salt,
  );

  const user = {
    id: `u_${Date.now().toString(36)}_${randomHex(4)}`,
    firstName: String(profile.firstName).trim(),
    lastName: String(profile.lastName).trim(),
    email,
    salt,
    passwordHash,
    role: profile.role || "student",
    studentId: profile.studentId
      ? String(profile.studentId).trim()
      : "",
    major: profile.major
      ? String(profile.major).trim()
      : "",
    year: profile.year
      ? String(profile.year).trim()
      : "",
    createdAt: new Date().toISOString(),
  };

  const users = getUsers();

  users.push(user);
  saveUsers(users);

  return {
    ok: true,
    user: toPublicUser(user),
  };
}

/**
 * Verify credentials and open a session.
 *
 * @returns {Promise<{ok:true,user:object}|{ok:false,error:string}>}
 */
export async function login(email, password) {
  const cleanEmail = normalizeEmail(email);

  const user = getUsers().find(
    (existing) => existing.email === cleanEmail,
  );

  if (!user) {
    return {
      ok: false,
      error: "No account found with this email address.",
    };
  }

  // Protect against incomplete/corrupt user records.
  if (!user.salt || !user.passwordHash) {
    return {
      ok: false,
      error:
        "This account is incomplete. Please register again or contact an administrator.",
    };
  }

  const hash = await hashPassword(password, user.salt);

  if (hash !== user.passwordHash) {
    return {
      ok: false,
      error: "Incorrect password. Please try again.",
    };
  }

  const publicUser = toPublicUser(user);

  // IMPORTANT:
  // This MUST use KEYS.currentUser from store.js.
  write(CURRENT_USER_KEY, publicUser);

  return {
    ok: true,
    user: publicUser,
  };
}

/**
 * Get the currently signed-in user.
 *
 * @returns {object|null}
 */
export function getCurrentUser() {
  return read(CURRENT_USER_KEY, null);
}

/**
 * @returns {boolean}
 */
export function isLoggedIn() {
  return !!getCurrentUser();
}

/**
 * End the current session.
 */
export function logout() {
  remove(CURRENT_USER_KEY);
}

/* ------------------------------------------------------------
   Default Admin Account
   ------------------------------------------------------------ */

/**
 * Create or repair the default admin account.
 *
 * Default credentials:
 * Email: admin@campus.edu
 * Password: Admin123!
 */
export async function seedAdminAccount() {
  const users = getUsers();

  const adminEmail = "admin@campus.edu";

  const existingAdmin = users.find(
    (user) => normalizeEmail(user.email) === adminEmail,
  );

  /*
   * If the default admin already exists and has valid
   * authentication data, keep it.
   */
  if (
    existingAdmin &&
    existingAdmin.role === "admin" &&
    existingAdmin.salt &&
    existingAdmin.passwordHash
  ) {
    return;
  }

  /*
   * If an incomplete/corrupt default admin exists,
   * repair the same account instead of creating duplicates.
   */
  if (existingAdmin) {
    const salt = randomHex(16);
    const passwordHash = await hashPassword(
      "Admin123!",
      salt,
    );

    existingAdmin.firstName = "Admin";
    existingAdmin.lastName = "User";
    existingAdmin.email = adminEmail;
    existingAdmin.salt = salt;
    existingAdmin.passwordHash = passwordHash;
    existingAdmin.role = "admin";
    existingAdmin.studentId = "ADM-001";
    existingAdmin.major = "Administration";
    existingAdmin.year = "Staff";

    saveUsers(users);
    return;
  }

  /*
   * Otherwise create the default admin account.
   */
  const salt = randomHex(16);
  const passwordHash = await hashPassword(
    "Admin123!",
    salt,
  );

  const admin = {
    id: "u_admin_" + Date.now().toString(36) + "_" + randomHex(4),
    firstName: "Admin",
    lastName: "User",
    email: adminEmail,
    salt,
    passwordHash,
    role: "admin",
    studentId: "ADM-001",
    major: "Administration",
    year: "Staff",
    createdAt: new Date().toISOString(),
  };

  users.push(admin);
  saveUsers(users);
}

/* ------------------------------------------------------------
   Role helpers
   ------------------------------------------------------------ */

/**
 * @returns {boolean}
 */
export function isAdmin() {
  const user = getCurrentUser();

  return !!(
    user &&
    user.role === "admin"
  );
}

/* ------------------------------------------------------------
   Profile Management
   ------------------------------------------------------------ */

/**
 * Update the current user's profile.
 *
 * @param {{
 *   firstName?: string,
 *   lastName?: string,
 *   studentId?: string,
 *   major?: string,
 *   year?: string
 * }} updates
 */
export function updateUserProfile(updates) {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    return {
      ok: false,
      error: "Not logged in.",
    };
  }

  const users = getUsers();

  const idx = users.findIndex(
    (user) => user.id === currentUser.id,
  );

  if (idx === -1) {
    return {
      ok: false,
      error: "User not found.",
    };
  }

  const allowed = [
    "firstName",
    "lastName",
    "studentId",
    "major",
    "year",
    "profileImage",
  ];

  const clean = {};

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      clean[key] = String(updates[key]).trim();
    }
  }

  if (
    clean.firstName &&
    !NAME_RE.test(clean.firstName)
  ) {
    return {
      ok: false,
      error: "Use 2–50 letters for first name.",
    };
  }

  if (
    clean.lastName &&
    !NAME_RE.test(clean.lastName)
  ) {
    return {
      ok: false,
      error: "Use 2–50 letters for last name.",
    };
  }

  users[idx] = {
    ...users[idx],
    ...clean,
  };

  saveUsers(users);

  const publicUser = toPublicUser(users[idx]);

  // Keep session synchronized with profile changes.
  write(CURRENT_USER_KEY, publicUser);

  return {
    ok: true,
    user: publicUser,
  };
}

/* ------------------------------------------------------------
   Change Password
   ------------------------------------------------------------ */

/**
 * Change the current user's password.
 *
 * @param {string} currentPassword
 * @param {string} newPassword
 */
export async function changePassword(
  currentPassword,
  newPassword,
) {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    return {
      ok: false,
      error: "Not logged in.",
    };
  }

  const users = getUsers();

  const user = users.find(
    (existing) => existing.id === currentUser.id,
  );

  if (!user) {
    return {
      ok: false,
      error: "User not found.",
    };
  }

  const currentHash = await hashPassword(
    currentPassword,
    user.salt,
  );

  if (currentHash !== user.passwordHash) {
    return {
      ok: false,
      error: "Current password is incorrect.",
    };
  }

  if (newPassword.length < 8) {
    return {
      ok: false,
      error: "Password must be at least 8 characters.",
    };
  }

  if (!/[a-zA-Z]/.test(newPassword)) {
    return {
      ok: false,
      error: "Password must include a letter.",
    };
  }

  if (!/[0-9]/.test(newPassword)) {
    return {
      ok: false,
      error: "Password must include a number.",
    };
  }

  user.passwordHash = await hashPassword(
    newPassword,
    user.salt,
  );

  saveUsers(users);

  return {
    ok: true,
  };
}

