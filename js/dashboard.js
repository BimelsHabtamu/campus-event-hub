import { parseHash, onRouteChange } from "./router.js";
import { getCurrentUser, isLoggedIn, logout, isAdmin, updateUserProfile, changePassword } from "./auth.js";
import { CATEGORY_LABEL, EVENTS } from "./data.js";
import { formatDateLabel, formatTime } from "./utils.js";
import { getEventStateVisuals } from "./event-status.js";
import { getSavedEvents, getRegisteredEvents } from "./lists.js";
import { buildMonthGrid, getCurrentMonth, shiftMonth, groupEventsByDay } from "./calendar.js";
import {
  read,
  write,
  getSavedEventIds,
  unsaveEvent,
  getUserRegistrations,
  getUserRegistration,
  cancelEventRegistration,
} from "./store.js";

const DEFAULT_PAGE = "dashboard";

const CALENDAR_PREFS_KEY = "ceh:calendarPrefs";
const NOTIF_PREFS_KEY = "ceh:notif-prefs";

const DEFAULT_NOTIF_PREFS = {
  emailReminders: true,
  inAppAlerts: true,
  weeklyDigest: false,
};

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  if (route.page === "profile") {
    window.location.replace("profile.html");
    return;
  }
  if (route.page === "settings") {
    window.location.replace("settings.html");
    return;
  }
  const page = KNOWN_PAGES.includes(route.page) ? route.page : DEFAULT_PAGE;
  showOnlyView(page);
  setActiveNav(page);
  setPageTitle(page);
  closeDrawer();
  mounts[page]?.();
}

/** Re-run the current page's mount after a store mutation (no nav churn). */
function refreshCurrent() {
  const route = parseHash(window.location.hash);
  const page = KNOWN_PAGES.includes(route.page) ? route.page : DEFAULT_PAGE;
  mounts[page]?.();
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

/* ---------- auth guard + identity ---------- */

/**
 * Build one event card for a dashboard listing.
 * @param {object} event
 * @param {{ mode: "saved"|"registered", registration?: object|null }} opts
 */
function buildEventCard(event, { mode, registration = null }) {
  const card = document.createElement("article");
  card.className = "card card-hover event-card";

  const cover = document.createElement("div");
  cover.className = "event-card-cover";

  const image = document.createElement("img");
  image.className = "event-card-image";
  image.loading = "lazy";
  image.alt = event.title;
  image.src = event.image || "../images/placeholder-event.svg";
  image.onerror = () => {
    image.src = "../images/placeholder-event.svg";
  };

  const status = getEventStateVisuals(event);
  const statusBadge = document.createElement("span");
  statusBadge.className = `badge ${status.badgeClass} event-card-badge`;
  statusBadge.textContent = status.label;

  cover.append(image, statusBadge);

  const body = document.createElement("div");
  body.className = "event-card-body";

  const title = document.createElement("h3");
  title.className = "event-card-title";

  const titleLink = document.createElement("a");
  titleLink.href = `event-details.html?id=${encodeURIComponent(event.id)}`;
  titleLink.textContent = event.title;
  title.appendChild(titleLink);

  const category = document.createElement("span");
  category.className = "chip chip-sm";
  category.textContent = CATEGORY_LABEL[event.category] ?? event.category;

  const meta = document.createElement("p");
  meta.className = "event-card-meta";

  const datetime = document.createElement("span");
  datetime.className = "event-card-datetime";
  datetime.innerHTML = `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>
    <time datetime="${event.startDateTime}">${formatDateLabel(event.startDateTime)} · ${formatTime(event.startDateTime)}</time>
  `;

  const location = document.createElement("span");
  location.className = "event-card-location";
  location.innerHTML = `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-5.1-7-11a7 7 0 0114 0c0 5.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
    <span>${event.location || "Campus"}</span>
  `;

  meta.append(datetime, location);
  body.append(category, title, meta);

  if (mode === "registered" && registration) {
    const regStatus = document.createElement("p");
    regStatus.className = "reg-status";
    const regBadge = document.createElement("span");
    regBadge.className = "badge badge-success";
    regBadge.textContent = "Registered";
    const regNote = document.createElement("span");
    regNote.classList.add("reg-status-note");
    regNote.textContent = registration.registeredAt
      ? `since ${new Date(registration.registeredAt).toLocaleDateString()}`
      : "";
    regStatus.append(regBadge, regNote);
    body.appendChild(regStatus);
  }

  card.appendChild(body);

  const actions = document.createElement("div");
  actions.className = "event-card-actions";

  const detailsLink = document.createElement("a");
  detailsLink.className = "btn btn-sm btn-primary event-card-link";
  detailsLink.href = `event-details.html?id=${encodeURIComponent(event.id)}`;
  detailsLink.textContent = "View Details";
  actions.appendChild(detailsLink);

  if (mode === "saved") {
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "btn btn-sm btn-secondary";
    removeButton.textContent = "Remove from Saved";
    removeButton.addEventListener("click", () => {
      unsaveEvent(event.id);
      refreshCurrent();
    });
    actions.appendChild(removeButton);
  } else if (mode === "registered") {
    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "btn btn-sm btn-danger";
    cancelButton.textContent = "Cancel Registration";
    cancelButton.addEventListener("click", () => {
      const user = getCurrentUser();
      if (!user) return;
      if (!window.confirm(`Cancel your registration for “${event.title}”?`)) return;
      const result = cancelEventRegistration(event.id, user.email);
      if (result.ok) refreshCurrent();
    });
    actions.appendChild(cancelButton);
  }

  card.appendChild(actions);
  return card;
}

/** The current user's registrations joined to their events, earliest first. */
function getRegisteredRows() {
  const user = getCurrentUser();
  if (!user) return [];
  return getRegisteredEvents({ events: EVENTS, registrations: getUserRegistrations(user.email) });
}

/** A single compact event row, shared by the dashboard and calendar day lists. */
function buildEventRow(event) {
  const start = new Date(event.startDateTime);
  const visuals = getEventStateVisuals(event);

  const row = document.createElement("a");
  row.className = "event-row";
  row.href = `event-details.html?id=${encodeURIComponent(event.id)}`;

  const dateBox = document.createElement("span");
  dateBox.className = "event-row-date";
  dateBox.setAttribute("aria-hidden", "true");
  dateBox.innerHTML = `
    <b>${start.getDate()}</b>
    <small>${start.toLocaleDateString(undefined, { month: "short" })}</small>
  `;

  const body = document.createElement("span");
  body.className = "event-row-body";

  const title = document.createElement("span");
  title.className = "event-row-title";
  title.textContent = event.title;

  const meta = document.createElement("span");
  meta.className = "event-row-meta";
  meta.innerHTML = `
    <time datetime="${event.startDateTime}">${formatDateLabel(event.startDateTime)} · ${formatTime(event.startDateTime)}</time>
    <span class="event-row-divider" aria-hidden="true"></span>
    ${event.location || "Campus"}
  `;

  body.append(title, meta);

  const badge = document.createElement("span");
  badge.className = `badge ${visuals.badgeClass}`;
  badge.textContent = visuals.label;

  row.append(dateBox, body, badge);
  return row;
}

/** Fill the four dashboard summary stat cards (registered, saved, upcoming, completed). */
function mountSummary() {
  const rows = getRegisteredRows();
  const registered = rows.length;
  const saved = getSavedEventIds().length;
  const upcoming = rows.filter(({ event }) => getEventStateVisuals(event).state !== "completed").length;
  const completed = registered - upcoming;

  const values = {
    "stat-registered": registered,
    "stat-saved": saved,
    "stat-upcoming": upcoming,
    "stat-completed": completed,
  };
  Object.entries(values).forEach(([id, count]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(count);
  });
}

/** List the user's upcoming (not yet completed) registered events. */
function mountUpcomingList() {
  const list = document.getElementById("dashboard-upcoming");
  const empty = document.getElementById("dashboard-upcoming-empty");
  const countBadge = document.getElementById("dashboard-upcoming-count");
  if (!list) return;

  const rows = getRegisteredRows().filter(({ event }) => getEventStateVisuals(event).state !== "completed");

  list.replaceChildren();
  rows.forEach(({ event }) => list.appendChild(buildEventRow(event)));

  if (countBadge) countBadge.textContent = `${rows.length} upcoming`;
  list.hidden = rows.length === 0;
  if (empty) empty.hidden = rows.length !== 0;
}

/**
 * Render rows into a dashboard grid with a live count + empty state.
 * @param {object} config
 */
function renderRows({ grid, empty, countEl, items, mode, noun }) {
  if (!grid) return;

  grid.replaceChildren();
  const user = getCurrentUser();
  const normalized = items.map((item) => {
    if (item.event) {
      const registration = item.registration
        ?? (user ? getUserRegistration(item.event.id, user.email) : null);
      return { event: item.event, registration };
    }
    return { event: item, registration: user ? getUserRegistration(item.id, user.email) : null };
  });

  normalized.forEach(({ event, registration }) => {
    grid.appendChild(buildEventCard(event, { mode, registration }));
  });

  const total = normalized.length;
  if (countEl) {
    countEl.textContent = `${total} ${noun}${total === 1 ? "" : "s"}`;
  }
  grid.hidden = total === 0;
  if (empty) empty.hidden = total !== 0;
}

/** Everything the signed-in user registered for. */
function mountMyEvents() {
  const user = getCurrentUser();
  const registrations = user ? getUserRegistrations(user.email) : [];
  const items = getRegisteredEvents({ events: EVENTS, registrations });
  renderRows({
    grid: document.getElementById("my-events-grid"),
    empty: document.getElementById("my-events-empty"),
    countEl: document.getElementById("my-events-count"),
    items,
    mode: "registered",
    noun: "registered event",
  });
}

/** Everything the signed-in user bookmarked. */
function mountSaved() {
  const items = getSavedEvents({ events: EVENTS, savedIds: getSavedEventIds() });
  renderRows({
    grid: document.getElementById("saved-grid"),
    empty: document.getElementById("saved-empty"),
    countEl: document.getElementById("saved-count"),
    items,
    mode: "saved",
    noun: "saved event",
  });
}

/* ---------- calendar ---------- */

const pad2 = (n) => String(n).padStart(2, "0");
const keyFor = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const dateFromKey = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** Render the selected day's events into the day panel. */
function renderDayPanel(byDay, selectedKey) {
  const title = document.getElementById("calendar-day-title");
  const list = document.getElementById("calendar-day-list");
  const empty = document.getElementById("calendar-day-empty");
  const emptyTitle = document.getElementById("calendar-day-empty-title");
  const emptyCopy = document.getElementById("calendar-day-empty-copy");
  if (!title || !list || !empty) return;

  if (!selectedKey) {
    title.textContent = "Pick a day";
    if (emptyTitle) emptyTitle.textContent = "No day selected";
    if (emptyCopy) emptyCopy.textContent = "Select a day to see what's on your calendar.";
    list.replaceChildren();
    list.hidden = true;
    empty.hidden = false;
    return;
  }

  title.textContent = dateFromKey(selectedKey).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const events = byDay[selectedKey] ?? [];
  list.replaceChildren();
  events.forEach((event) => list.appendChild(buildEventRow(event)));

  list.hidden = events.length === 0;
  if (emptyTitle) emptyTitle.textContent = "No events on this day";
  if (emptyCopy) {
    emptyCopy.textContent =
      "Nothing scheduled here. Browse events and register to start filling your calendar.";
  }
  empty.hidden = events.length !== 0;
}

/** Interactive month calendar: registered events on their dates. */
function mountCalendar() {
  const monthTitle = document.getElementById("calendar-month-title");
  const grid = document.getElementById("calendar-month-grid");
  const prevBtn = document.getElementById("calendar-prev");
  const nextBtn = document.getElementById("calendar-next");
  if (!grid) return;

  const today = new Date();
  const todayKey = keyFor(today);

  const stored = read(CALENDAR_PREFS_KEY, {}) ?? {};
  const hasView = Number.isInteger(stored.year) && Number.isInteger(stored.month);
  const view = hasView ? { year: stored.year, month: stored.month } : getCurrentMonth();

  const byDay = groupEventsByDay(getRegisteredRows().map((row) => row.event));

  if (monthTitle) {
    monthTitle.textContent = new Date(view.year, view.month - 1, 1).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }

  grid.replaceChildren();
  WEEKDAY_NAMES.forEach((name) => {
    const weekday = document.createElement("span");
    weekday.className = "calendar-weekday";
    weekday.setAttribute("role", "columnheader");
    weekday.textContent = name;
    grid.appendChild(weekday);
  });

  buildMonthGrid(view.year, view.month).forEach((cell) => {
    const cellDate = new Date(cell.year, cell.month - 1, cell.day);
    const key = keyFor(cellDate);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-cell";
    button.setAttribute("role", "gridcell");
    button.textContent = String(cell.day);

    if (!cell.inMonth) button.classList.add("is-muted");
    if (cell.inMonth) {
      button.dataset.date = key;
      button.setAttribute(
        "aria-label",
        cellDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
      );
    }
    if (key === todayKey) {
      button.classList.add("is-today");
      button.setAttribute("aria-current", "date");
    }
    if (cell.inMonth && byDay[key]) button.classList.add("has-event");
    if (cell.inMonth && key === stored.selected) button.classList.add("is-selected");

    grid.appendChild(button);
  });

  grid.onclick = (event) => {
    const cell = event.target.closest("button.calendar-cell[data-date]");
    if (!cell) return;
    const selectedKey = cell.dataset.date;
    write(CALENDAR_PREFS_KEY, { ...view, selected: selectedKey });
    renderDayPanel(byDay, selectedKey);
    grid.querySelectorAll(".calendar-cell").forEach((c) => {
      c.classList.toggle("is-selected", c.dataset.date === selectedKey);
    });
  };

  const stepMonth = (delta) => {
    const next = shiftMonth(view, delta);
    write(CALENDAR_PREFS_KEY, { ...next, selected: null });
    mountCalendar();
  };

  prevBtn.onclick = () => stepMonth(-1);
  nextBtn.onclick = () => stepMonth(1);

  const selectedKey = stored.selected ?? (hasView ? null : todayKey);
  if (selectedKey) write(CALENDAR_PREFS_KEY, { ...view, selected: selectedKey });
  renderDayPanel(byDay, selectedKey);
}

/** Complete dashboard home: summary stats + upcoming list. */
function mountDashboard() {
  mountSummary();
  mountUpcomingList();
}

/* ---------- topbar search ---------- */

function initTopbarSearch() {
  const form = document.getElementById("topbar-search-form");
  const input = document.getElementById("topbar-search-input");

  if (!form || !input) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const query = input.value.trim();

    if (!query) {
      window.location.href = "events.html";
      return;
    }

    window.location.href =
      `events.html?search=${encodeURIComponent(query)}`;
  });
}

/* ---------- local notifications ---------- */

const NOTIFICATIONS_KEY = "ceh:notifications";

function getNotifications() {
  const user = getCurrentUser();

  if (!user) return [];

  const key = `${NOTIFICATIONS_KEY}:${user.email}`;
  const stored = read(key, []);

  return Array.isArray(stored) ? stored : [];
}

function saveNotifications(notifications) {
  const user = getCurrentUser();

  if (!user) return;

  const key = `${NOTIFICATIONS_KEY}:${user.email}`;
  write(key, notifications);
}

/** Create a notification only if an equivalent notification does not already exist. */
function addNotification({ type, title, message, eventId = null }) {
  const notifications = getNotifications();

  const exists = notifications.some(
    (notification) =>
      notification.type === type &&
      notification.eventId === eventId &&
      notification.title === title,
  );

  if (exists) return;

  const notification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    message,
    eventId,
    createdAt: new Date().toISOString(),
    read: false,
  };

  notifications.unshift(notification);
  saveNotifications(notifications.slice(0, 30));
}

/** Build useful notifications from the user's current local event activity. */
function syncNotifications() {
  const user = getCurrentUser();

  if (!user) return;

  const prefs = getNotifPrefs();

  if (!prefs.inAppAlerts) return;

  const registrations = getUserRegistrations(user.email);

  registrations.forEach((registration) => {
    const event = EVENTS.find((item) => item.id === registration.eventId);

    if (!event) return;

    addNotification({
      type: "registration",
      title: "Event registration confirmed",
      message: `You're registered for ${event.title}.`,
      eventId: event.id,
    });

    const start = new Date(event.startDateTime);
    const now = new Date();
    const hoursUntil =
      (start.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntil > 0 && hoursUntil <= 24) {
      addNotification({
        type: "reminder",
        title: "Event starting soon",
        message: `${event.title} starts within 24 hours.`,
        eventId: event.id,
      });
    }
  });

  const savedIds = getSavedEventIds();

  savedIds.forEach((eventId) => {
    const event = EVENTS.find((item) => item.id === eventId);

    if (!event) return;

    addNotification({
      type: "saved",
      title: "Saved event",
      message: `${event.title} is in your saved events.`,
      eventId: event.id,
    });
  });
}

/** Return an icon for each notification type. */
function getNotificationIcon(type) {
  const icons = {
    registration: `
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 8a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 000-4z"/>
        <path d="M14 6v12"/>
      </svg>
    `,
    reminder: `
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18 8a6 6 0 00-12 0c0 7-3 8-3 8h18s-3-1-3-8"/>
        <path d="M10 20a2 2 0 004 0"/>
      </svg>
    `,
    saved: `
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 4.5h12V20l-6-4-6 4z"/>
      </svg>
    `,
    default: `
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9"/>
        <path d="M12 8v4l3 2"/>
      </svg>
    `,
  };

  return icons[type] || icons.default;
}

/** Render the notification dropdown. */
function renderNotifications() {
  const list = document.getElementById("notification-list");
  const empty = document.getElementById("notification-empty");
  const count = document.getElementById("notification-count");
  const dot = document.getElementById("notification-dot");

  if (!list || !empty) return;

  const notifications = getNotifications();
  const unread = notifications.filter((notification) => !notification.read);

  if (dot) dot.hidden = unread.length === 0;
  if (count) {
    count.textContent =
      unread.length === 0 ? "No new notifications" : `${unread.length} unread`;
  }

  list.replaceChildren();

  if (notifications.length === 0) {
    list.hidden = true;
    empty.hidden = false;
    return;
  }

  list.hidden = false;
  empty.hidden = true;

  notifications.forEach((notification) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className =
      `notification-item${notification.read ? "" : " is-unread"}`;
    item.dataset.notificationId = notification.id;

    const icon = document.createElement("span");
    icon.className = "notification-item-icon";
    icon.innerHTML = getNotificationIcon(notification.type);

    const content = document.createElement("span");
    content.className = "notification-item-content";

    const title = document.createElement("strong");
    title.textContent = notification.title;

    const message = document.createElement("span");
    message.textContent = notification.message;

    const time = document.createElement("small");
    const created = new Date(notification.createdAt);
    time.textContent = created.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });

    content.append(title, message, time);
    item.append(icon, content);

    item.addEventListener("click", () => {
      markNotificationRead(notification.id);

      if (notification.eventId) {
        window.location.href =
          `event-details.html?id=${encodeURIComponent(notification.eventId)}`;
      } else {
        renderNotifications();
      }
    });

    list.appendChild(item);
  });
}

/** Mark one notification as read. */
function markNotificationRead(notificationId) {
  const notifications = getNotifications();
  const updated = notifications.map((notification) =>
    notification.id === notificationId
      ? { ...notification, read: true }
      : notification,
  );

  saveNotifications(updated);
  renderNotifications();
}

/** Mark every notification as read. */
function markAllNotificationsRead() {
  const notifications = getNotifications();

  if (!notifications.length) return;

  saveNotifications(
    notifications.map((notification) => ({
      ...notification,
      read: true,
    })),
  );

  renderNotifications();
}

/** Open/close notification panel. */
function initNotifications() {
  const bell = document.getElementById("notification-bell");
  const panel = document.getElementById("notification-panel");
  const readAll = document.getElementById("notification-read-all");

  if (!bell || !panel) return;

  syncNotifications();
  renderNotifications();

  bell.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = !panel.hidden;

    panel.hidden = isOpen;
    bell.setAttribute("aria-expanded", String(!isOpen));

    if (!isOpen) renderNotifications();
  });

  readAll?.addEventListener("click", (event) => {
    event.stopPropagation();
    markAllNotificationsRead();
  });

  document.addEventListener("click", (event) => {
    if (!panel.hidden && !event.target.closest(".notification-wrapper")) {
      panel.hidden = true;
      bell.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      panel.hidden = true;
      bell.setAttribute("aria-expanded", "false");
      bell.focus();
    }
  });
}

/* ---------- notification preferences ---------- */

function getNotifPrefs() {
  const stored = read(NOTIF_PREFS_KEY, null);
  return stored && typeof stored === "object" ? { ...DEFAULT_NOTIF_PREFS, ...stored } : { ...DEFAULT_NOTIF_PREFS };
}

function saveNotifPrefs(prefs) {
  write(NOTIF_PREFS_KEY, prefs);
}

/* ---------- profile ---------- */

let profileOrigValues = {};

function mountProfile() {
  const user = getCurrentUser();
  if (!user) return;

  const avatar = document.getElementById("profile-avatar");
  const nameEl = document.getElementById("profile-display-name");
  const emailEl = document.getElementById("profile-display-email");
  const roleBadge = document.getElementById("profile-role-badge");

  if (avatar) avatar.textContent = `${(user.firstName || "?")[0]}${(user.lastName || "?")[0]}`.toUpperCase();
  if (nameEl) nameEl.textContent = `${user.firstName} ${user.lastName}`;
  if (emailEl) emailEl.textContent = user.email;
  if (roleBadge) {
    roleBadge.textContent = user.role === "admin" ? "Administrator" : "Student";
    roleBadge.className = user.role === "admin" ? "badge badge-danger" : "badge badge-brand";
  }

  setProfileVal("profile-first", user.firstName);
  setProfileVal("profile-last", user.lastName);
  setProfileVal("profile-email", user.email);
  setProfileVal("profile-student-id", user.studentId || "");
  setProfileVal("profile-major", user.major || "");
  setProfileVal("profile-year", user.year || "");

  setProfileDisabled(true);
  hideProfileActions();
  clearProfileMsg();
}

function setProfileVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || "";
}

function setProfileDisabled(disabled) {
  ["profile-first", "profile-last", "profile-student-id", "profile-major", "profile-year"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = disabled;
  });
}

function showProfileActions() {
  const el = document.getElementById("profile-actions");
  if (el) el.hidden = false;
}

function hideProfileActions() {
  const el = document.getElementById("profile-actions");
  if (el) el.hidden = true;
}

function showProfileMsg(kind, text) {
  const box = document.getElementById("profile-message");
  if (!box) return;
  box.className = `form-message form-message--${kind}`;
  box.textContent = text;
  box.hidden = false;
}

function clearProfileMsg() {
  const box = document.getElementById("profile-message");
  if (box) box.hidden = true;
}

let profileHandlersInit = false;

function initProfileHandlers() {
  if (profileHandlersInit) return;
  profileHandlersInit = true;

  const editBtn = document.getElementById("profile-edit-btn");
  const cancelBtn = document.getElementById("profile-cancel-btn");
  const form = document.getElementById("profile-form");

  editBtn?.addEventListener("click", () => {
    profileOrigValues = {
      firstName: document.getElementById("profile-first")?.value || "",
      lastName: document.getElementById("profile-last")?.value || "",
      studentId: document.getElementById("profile-student-id")?.value || "",
      major: document.getElementById("profile-major")?.value || "",
      year: document.getElementById("profile-year")?.value || "",
    };
    setProfileDisabled(false);
    showProfileActions();
    clearProfileMsg();
    document.getElementById("profile-first")?.focus();
  });

  cancelBtn?.addEventListener("click", () => {
    setProfileVal("profile-first", profileOrigValues.firstName);
    setProfileVal("profile-last", profileOrigValues.lastName);
    setProfileVal("profile-student-id", profileOrigValues.studentId);
    setProfileVal("profile-major", profileOrigValues.major);
    setProfileVal("profile-year", profileOrigValues.year);
    setProfileDisabled(true);
    hideProfileActions();
    clearProfileMsg();
  });

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    handleProfileSubmit();
  });
}

async function handleProfileSubmit() {
  clearProfileMsg();

  const NAME_RE = /^[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F' -]{2,50}$/;
  const firstName = (document.getElementById("profile-first")?.value || "").trim();
  const lastName = (document.getElementById("profile-last")?.value || "").trim();
  const studentId = document.getElementById("profile-student-id")?.value || "";
  const major = document.getElementById("profile-major")?.value || "";
  const year = document.getElementById("profile-year")?.value || "";

  if (!firstName) { showProfileMsg("error", "First name is required."); return; }
  if (!NAME_RE.test(firstName)) { showProfileMsg("error", "Use 2\u201350 letters for first name."); return; }
  if (!lastName) { showProfileMsg("error", "Last name is required."); return; }
  if (!NAME_RE.test(lastName)) { showProfileMsg("error", "Use 2\u201350 letters for last name."); return; }

  const result = updateUserProfile({ firstName, lastName, studentId, major, year });
  if (!result.ok) {
    showProfileMsg("error", result.error);
    return;
  }

  showProfileMsg("success", "Profile updated successfully.");
  setProfileDisabled(true);
  hideProfileActions();
  populateIdentity();
}

/* ---------- settings ---------- */

function mountSettings() {
  const prefs = getNotifPrefs();
  const emailToggle = document.getElementById("notif-email-reminders");
  const inAppToggle = document.getElementById("notif-in-app-alerts");
  const digestToggle = document.getElementById("notif-weekly-digest");

  if (emailToggle) emailToggle.checked = prefs.emailReminders;
  if (inAppToggle) inAppToggle.checked = prefs.inAppAlerts;
  if (digestToggle) digestToggle.checked = prefs.weeklyDigest;
}

let settingsHandlersInit = false;

function initSettingsHandlers() {
  if (settingsHandlersInit) return;
  settingsHandlersInit = true;

  ["notif-email-reminders", "notif-in-app-alerts", "notif-weekly-digest"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      saveNotifPrefs({
        emailReminders: document.getElementById("notif-email-reminders")?.checked ?? true,
        inAppAlerts: document.getElementById("notif-in-app-alerts")?.checked ?? true,
        weeklyDigest: document.getElementById("notif-weekly-digest")?.checked ?? false,
      });
    });
  });

  const pwForm = document.getElementById("password-form");
  pwForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    handlePasswordSubmit();
  });

  ["pw-current", "pw-new", "pw-confirm"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", () => {
      document.getElementById(id)?.classList.remove("is-invalid");
      const err = document.getElementById(`${id}-error`);
      if (err) err.hidden = true;
    });
  });
}

async function handlePasswordSubmit() {
  const currentPw = document.getElementById("pw-current")?.value || "";
  const newPw = document.getElementById("pw-new")?.value || "";
  const confirmPw = document.getElementById("pw-confirm")?.value || "";

  ["pw-current", "pw-new", "pw-confirm"].forEach((id) => {
    document.getElementById(id)?.classList.remove("is-invalid");
    const err = document.getElementById(`${id}-error`);
    if (err) err.hidden = true;
  });
  const msgBox = document.getElementById("pw-message");
  if (msgBox) msgBox.hidden = true;

  let valid = true;

  if (!currentPw) { showPwError("pw-current", "Current password is required."); valid = false; }
  if (!newPw) { showPwError("pw-new", "New password is required."); valid = false; }
  else if (newPw.length < 8) { showPwError("pw-new", "Password must be at least 8 characters."); valid = false; }
  else if (!/[a-zA-Z]/.test(newPw)) { showPwError("pw-new", "Password must include a letter."); valid = false; }
  else if (!/[0-9]/.test(newPw)) { showPwError("pw-new", "Password must include a number."); valid = false; }
  if (newPw !== confirmPw) { showPwError("pw-confirm", "Passwords do not match."); valid = false; }

  if (!valid) return;

  const result = await changePassword(currentPw, newPw);
  if (!result.ok) {
    if (msgBox) {
      msgBox.className = "form-message form-message--error";
      msgBox.textContent = result.error;
      msgBox.hidden = false;
    }
    return;
  }

  if (msgBox) {
    msgBox.className = "form-message form-message--success";
    msgBox.textContent = "Password updated successfully.";
    msgBox.hidden = false;
  }
  document.getElementById("pw-current").value = "";
  document.getElementById("pw-new").value = "";
  document.getElementById("pw-confirm").value = "";
}

function showPwError(id, message) {
  const input = document.getElementById(id);
  const err = document.getElementById(`${id}-error`);
  if (input) input.classList.add("is-invalid");
  if (err) { err.textContent = message; err.hidden = false; }
}

/** Page mounts keyed by route name. */
const mounts = {
  dashboard: mountDashboard,
  "my-events": mountMyEvents,
  saved: mountSaved,
  calendar: mountCalendar,
  profile: mountProfile,
  settings: mountSettings,
};

/* ---------- auth guard + identity ---------- */

/** Fill the topbar chip with the signed-in user's name and photo. */
function populateIdentity() {
  const user = getCurrentUser();
  if (!user) return;
  const nameEl = document.querySelector(".user-chip-name");
  const roleEl = document.querySelector(".user-chip-role");
  const avatarEl = document.querySelector(".avatar");
  if (nameEl) nameEl.textContent = `${user.firstName} ${user.lastName}`;
  if (roleEl) roleEl.textContent = user.role === "admin" ? "Administrator" : user.email;
  if (avatarEl) {
    avatarEl.replaceChildren();
    if (user.profileImage) {
      const image = document.createElement("img");
      image.src = user.profileImage;
      image.alt = `${user.firstName || "User"} profile photo`;
      avatarEl.appendChild(image);
    } else {
      avatarEl.textContent =
        `${(user.firstName || "?")[0].toUpperCase()}${(user.lastName || "?")[0].toUpperCase()}`;
    }
  }
}

/** Show admin nav link if the current user is an admin. */
function showAdminNav() {
  const user = getCurrentUser();
  const adminSection = document.getElementById("admin-nav-section");
  if (adminSection) {
    adminSection.hidden = !(user && user.role === "admin");
  }
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

  const user = getCurrentUser();

  if (!user) {
    window.location.replace("login.html");
    return;
  }

  populateIdentity();
  showAdminNav();

  initLogout();
  initSidebar();
  initProfileHandlers();
  initSettingsHandlers();

  // Topbar features
  initTopbarSearch();
  initNotifications();

  render(parseHash(window.location.hash));

  const unsubscribe = onRouteChange(render);

  window.__ceh = {
    unsubscribe,
  };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}