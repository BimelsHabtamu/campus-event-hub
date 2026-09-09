/* ============================================================
   dashboard.js — private app shell entry point (app.html)
   ------------------------------------------------------------
   Responsibilities:
     1. resolve hash routes (default #/dashboard)
     2. swap content sections + update the page title
     3. highlight the active sidebar item
     4. responsive sidebar: off-canvas drawer below lg,
        icon-only collapse at/above lg
   ============================================================ */

import { parseHash, onRouteChange } from "./router.js";
import { getCurrentUser, isLoggedIn, logout } from "./auth.js";

const DEFAULT_PAGE = "dashboard";

const PAGE_TITLES = {
  dashboard: "Dashboard",
  "my-events": "My Events",
  saved: "Saved Events",
  calendar: "Calendar",
  profile: "Profile",
  settings: "Settings",
};

/** Set of route names this shell owns. */
const KNOWN_PAGES = Object.keys(PAGE_TITLES);

const mediaDesktop = window.matchMedia("(min-width: 64rem)");

/* ---------- view switching ---------- */

/** Show one [data-view] section, hide the rest. */
function showOnlyView(viewName) {
  document.querySelectorAll("[data-view]").forEach((section) => {
    section.hidden = section.dataset.view !== viewName;
  });
}

/** Highlight the matching sidebar item. */
function setActiveNav(page) {
  document.querySelectorAll("[data-route]").forEach((link) => {
    const isActive = link.dataset.page === page;
    link.classList.toggle("active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

/** Update the topbar title for the current page. */
function setPageTitle(page) {
  const title = document.getElementById("page-title");
  if (title) title.textContent = PAGE_TITLES[page] ?? PAGE_TITLES[DEFAULT_PAGE];
  document.title = `${PAGE_TITLES[page] ?? PAGE_TITLES[DEFAULT_PAGE]} · Campus Event & Activity Hub`;
}

function render(route) {
  const page = KNOWN_PAGES.includes(route.page) ? route.page : DEFAULT_PAGE;
  showOnlyView(page);
  setActiveNav(page);
  setPageTitle(page);
  closeDrawer();
}

/* ---------- responsive sidebar ---------- */

const shell = () => document.getElementById("app-shell");

function isDesktop() {
  return mediaDesktop.matches;
}

function setOpenState(isOpen) {
  const root = shell();
  const toggle = document.getElementById("sidebar-toggle");
  const overlay = document.getElementById("sidebar-overlay");
  if (!root || !toggle) return;

  root.classList.toggle("sidebar-open", isOpen);
  toggle.setAttribute("aria-expanded", String(isOpen));
  document.body.classList.toggle("drawer-locked", isOpen && !isDesktop());
  if (overlay) overlay.hidden = !isOpen;
}

function openDrawer() {
  setOpenState(true);
}

function closeDrawer() {
  setOpenState(false);
}

/** Toggle behavior depends on viewport: drawer (< lg) vs collapse (>= lg). */
function toggleSidebar() {
  if (isDesktop()) {
    shell()?.classList.toggle("is-collapsed");
    return;
  }
  const isOpen = shell()?.classList.contains("sidebar-open");
  setOpenState(!isOpen);
}

/* ---------- sidebar shell wiring ---------- */

function initSidebar() {
  const toggle = document.getElementById("sidebar-toggle");
  const closeBtn = document.getElementById("sidebar-close");
  const overlay = document.getElementById("sidebar-overlay");
  const sidebar = document.getElementById("sidebar");

  toggle?.addEventListener("click", toggleSidebar);
  closeBtn?.addEventListener("click", closeDrawer);
  overlay?.addEventListener("click", closeDrawer);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && shell()?.classList.contains("sidebar-open")) {
      closeDrawer();
    }
  });

  // Clicking a link inside the drawer (mobile) closes it.
  sidebar?.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeDrawer();
  });

  // Reset aria-expanded when the user resizes across the breakpoint.
  mediaDesktop.addEventListener("change", () => {
    setOpenState(false);
  });
}

/* ---------- authentication guard + identity ---------- */

/** Fill the topbar chip with the signed-in user's name via initials. */
function populateIdentity() {
  const user = getCurrentUser();
  if (!user) return;
  const nameEl = document.querySelector(".user-chip-name");
  const roleEl = document.querySelector(".user-chip-role");
  const avatarEl = document.querySelector(".avatar");
  if (nameEl) nameEl.textContent = `${user.firstName} ${user.lastName}`;
  if (roleEl) roleEl.textContent = user.email;
  if (avatarEl) avatarEl.textContent =
    `${(user.firstName || "?")[0].toUpperCase()}${(user.lastName || "?")[0].toUpperCase()}`;
}

/** End the session and return to the public site. */
function initLogout() {
  const link = document.getElementById("logout-link");
  link?.addEventListener("click", (event) => {
    event.preventDefault();
    logout();
    window.location.replace("index.html");
  });
}

/* ---------- boot ---------- */

function boot() {
  // Private shell: redirect guests to the login page.
  if (!isLoggedIn()) {
    window.location.replace("login.html");
    return;
  }

  populateIdentity();
  initLogout();
  initSidebar();
  render(parseHash(window.location.hash));

  const unsubscribe = onRouteChange(render);
  window.__ceh = { unsubscribe };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}