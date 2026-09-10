/* ============================================================
   settings.js — User settings & preferences page controller
   ------------------------------------------------------------
   Responsibilities:
     1. Auth guard: redirect unauthenticated users to login
     2. Role-based navigation: adapt sidebar and badges for Student vs Admin
     3. Populate identity summary (Name, Email, Student ID, Role)
     4. Notification preferences management with LocalStorage sync
     5. Password change with client validation & crypto hash verify
     6. Session logout & responsive drawer
   ============================================================ */

import {
  getCurrentUser,
  isLoggedIn,
  logout,
  changePassword,
} from "./auth.js";

const NOTIF_PREFS_KEY = "ceh:notif-prefs";

const DEFAULT_NOTIF_PREFS = {
  emailReminders: true,
  inAppAlerts: true,
  weeklyDigest: false,
  eventUpdates: true,
};

const Icons = {
  error: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>',
  success: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>',
};

/* ------------------------------------------------------------
   Notification Preferences
   ------------------------------------------------------------ */

function getNotifPrefs() {
  try {
    const raw = window.localStorage.getItem(NOTIF_PREFS_KEY);
    return raw ? { ...DEFAULT_NOTIF_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_NOTIF_PREFS };
  } catch {
    return { ...DEFAULT_NOTIF_PREFS };
  }
}

function saveNotifPrefs(prefs) {
  try {
    window.localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(prefs));
    flashSavedTag();
  } catch {
    /* ignore storage quota */
  }
}

let savedTimeout = null;
function flashSavedTag() {
  const tag = document.getElementById("notif-saved-tag");
  if (!tag) return;
  tag.style.opacity = "1";
  if (savedTimeout) clearTimeout(savedTimeout);
  savedTimeout = setTimeout(() => {
    tag.style.opacity = "0";
  }, 1800);
}

function initNotifPreferences() {
  const prefs = getNotifPrefs();

  const emailEl = document.getElementById("notif-email-reminders");
  const inAppEl = document.getElementById("notif-in-app-alerts");
  const digestEl = document.getElementById("notif-weekly-digest");
  const updatesEl = document.getElementById("notif-event-updates");

  if (emailEl) emailEl.checked = !!prefs.emailReminders;
  if (inAppEl) inAppEl.checked = !!prefs.inAppAlerts;
  if (digestEl) digestEl.checked = !!prefs.weeklyDigest;
  if (updatesEl) updatesEl.checked = !!prefs.eventUpdates;

  const onToggle = () => {
    saveNotifPrefs({
      emailReminders: emailEl?.checked ?? true,
      inAppAlerts: inAppEl?.checked ?? true,
      weeklyDigest: digestEl?.checked ?? false,
      eventUpdates: updatesEl?.checked ?? true,
    });
  };

  [emailEl, inAppEl, digestEl, updatesEl].forEach((el) => {
    el?.addEventListener("change", onToggle);
  });
}

/* ------------------------------------------------------------
   Password Change
   ------------------------------------------------------------ */

function showPwMessage(kind, text) {
  const box = document.getElementById("pw-message");
  if (!box) return;
  box.className = `form-message form-message--${kind}`;
  box.innerHTML = `${kind === "success" ? Icons.success : Icons.error}<span>${text}</span>`;
  box.hidden = false;
  box.setAttribute("aria-live", "polite");
}

function clearPwMessage() {
  const box = document.getElementById("pw-message");
  if (box) box.hidden = true;
}

function showPwError(id, msg) {
  const input = document.getElementById(id);
  const error = document.getElementById(`${id}-error`);
  input?.classList.add("is-invalid");
  if (error) {
    error.innerHTML = `${Icons.error}<span>${msg}</span>`;
    error.hidden = false;
  }
}

function clearPwError(id) {
  document.getElementById(id)?.classList.remove("is-invalid");
  const error = document.getElementById(`${id}-error`);
  if (error) error.hidden = true;
}

function clearAllPwErrors() {
  ["pw-current", "pw-new", "pw-confirm"].forEach(clearPwError);
  clearPwMessage();
}

function initPasswordForm() {
  const form = document.getElementById("password-form");
  const currentEl = document.getElementById("pw-current");
  const newEl = document.getElementById("pw-new");
  const confirmEl = document.getElementById("pw-confirm");
  const submitBtn = document.getElementById("pw-submit-btn");

  [currentEl, newEl, confirmEl].forEach((el) => {
    el?.addEventListener("input", () => {
      if (el.id) clearPwError(el.id);
    });
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAllPwErrors();

    const currentVal = currentEl?.value || "";
    const newVal = newEl?.value || "";
    const confirmVal = confirmEl?.value || "";

    let hasError = false;

    if (!currentVal) {
      showPwError("pw-current", "Current password is required.");
      hasError = true;
    }

    if (!newVal) {
      showPwError("pw-new", "New password is required.");
      hasError = true;
    } else if (newVal.length < 8) {
      showPwError("pw-new", "New password must be at least 8 characters.");
      hasError = true;
    } else if (!/[a-zA-Z]/.test(newVal)) {
      showPwError("pw-new", "New password must include at least one letter.");
      hasError = true;
    } else if (!/[0-9]/.test(newVal)) {
      showPwError("pw-new", "New password must include at least one number.");
      hasError = true;
    }

    if (!confirmVal) {
      showPwError("pw-confirm", "Please confirm your new password.");
      hasError = true;
    } else if (newVal && confirmVal !== newVal) {
      showPwError("pw-confirm", "Passwords do not match.");
      hasError = true;
    }

    if (hasError) {
      showPwMessage("error", "Please address the errors above and try again.");
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Updating…";
    }

    try {
      const result = await changePassword(currentVal, newVal);
      if (!result.ok) {
        showPwMessage("error", result.error || "Failed to update password.");
        return;
      }

      showPwMessage("success", "Password updated successfully! Use your new password on your next login.");
      form.reset();
    } catch {
      showPwMessage("error", "An error occurred while updating your password. Please try again.");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Update password";
      }
    }
  });
}

/* ------------------------------------------------------------
   Identity & Role navigation
   ------------------------------------------------------------ */

function populateIdentity(user) {
  if (!user) return;

  const initials = `${(user.firstName || "?")[0]}${(user.lastName || "?")[0]}`.toUpperCase();
  const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User";
  const isUserAdmin = user.role === "admin";
  const roleLabel = isUserAdmin ? "Administrator" : "Student";
  const badgeClass = isUserAdmin ? "badge badge-danger" : "badge badge-brand";

  // Topbar
  const topbarName = document.getElementById("topbar-name");
  const topbarRole = document.getElementById("topbar-role");
  const topbarAvatar = document.getElementById("topbar-avatar");
  const topbarBadge = document.getElementById("topbar-role-badge");

  if (topbarName) topbarName.textContent = fullName;
  if (topbarRole) topbarRole.textContent = isUserAdmin ? "Administrator" : user.email;
  if (topbarAvatar) {
    topbarAvatar.replaceChildren();
    if (user.profileImage) {
      const image = document.createElement("img");
      image.src = user.profileImage;
      image.alt = `${fullName} profile photo`;
      topbarAvatar.appendChild(image);
    } else {
      topbarAvatar.textContent = initials;
    }
  }
  if (topbarBadge) {
    topbarBadge.textContent = roleLabel;
    topbarBadge.className = badgeClass;
  }

  // Account Summary Card
  const summaryName = document.getElementById("summary-name");
  const summaryEmail = document.getElementById("summary-email");
  const summaryId = document.getElementById("summary-id");
  const summaryRole = document.getElementById("summary-role");

  if (summaryName) summaryName.textContent = fullName;
  if (summaryEmail) summaryEmail.textContent = user.email || "—";
  if (summaryId) summaryId.textContent = user.studentId || (isUserAdmin ? "ADM-001" : "Not registered");
  if (summaryRole) {
    summaryRole.textContent = roleLabel;
    summaryRole.className = badgeClass;
  }

  // Sidebar role-based navigation
  const studentSection = document.getElementById("student-nav-section");
  const adminSection = document.getElementById("admin-nav-section");

  if (isUserAdmin) {
    if (studentSection) studentSection.hidden = true;
    if (adminSection) adminSection.hidden = false;
  } else {
    if (studentSection) studentSection.hidden = false;
    if (adminSection) adminSection.hidden = true;
  }
}

/* ------------------------------------------------------------
   Sidebar drawer & logout
   ------------------------------------------------------------ */

function initSidebar() {
  const shell = document.getElementById("app-shell");
  const toggle = document.getElementById("sidebar-toggle");
  const close = document.getElementById("sidebar-close");
  const overlay = document.getElementById("sidebar-overlay");
  const mediaDesktop = window.matchMedia("(min-width: 64rem)");

  const setDrawerOpen = (open) => {
    shell?.classList.toggle("sidebar-open", open);
    if (overlay) overlay.hidden = !open;
    toggle?.setAttribute("aria-expanded", String(open));
  };

  toggle?.addEventListener("click", () => {
    if (mediaDesktop.matches) {
      shell?.classList.toggle("sidebar-collapsed");
    } else {
      const isOpen = shell?.classList.contains("sidebar-open");
      setDrawerOpen(!isOpen);
    }
  });

  close?.addEventListener("click", () => setDrawerOpen(false));
  overlay?.addEventListener("click", () => setDrawerOpen(false));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && shell?.classList.contains("sidebar-open")) {
      setDrawerOpen(false);
    }
  });
}

function initLogout() {
  const links = [
    document.getElementById("logout-link"),
    document.getElementById("btn-logout-session"),
  ];

  links.forEach((link) => {
    link?.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
      window.location.replace("login.html");
    });
  });
}

/* ------------------------------------------------------------
   Boot
   ------------------------------------------------------------ */

function init() {
  if (!isLoggedIn()) {
    window.location.replace("login.html");
    return;
  }

  const user = getCurrentUser();
  populateIdentity(user);
  initNotifPreferences();
  initPasswordForm();
  initSidebar();
  initLogout();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
