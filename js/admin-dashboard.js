import {
  getCurrentUser,
  isLoggedIn,
  logout,
  isAdmin,
  seedAdminAccount,
} from "./auth.js";

import { CATEGORIES, CATEGORY_LABEL, EVENTS } from "./data.js";
import { formatDateLabel, formatTime } from "./utils.js";
import { getEventState, getEventStateVisuals } from "./event-status.js";
import { getRegistrations } from "./store.js";

const ADMIN_EVENTS_KEY = "ceh:admin-events";
const DEFAULT_PAGE = "admin-dashboard";

const PAGE_TITLES = {
  "admin-dashboard": "Admin Dashboard",
  "manage-events": "Manage Events",
  registrations: "Registrations",
};

const KNOWN_PAGES = Object.keys(PAGE_TITLES);
const mediaDesktop = window.matchMedia("(min-width: 64rem)");

function getAdminEvents() {
  try {
    const raw = localStorage.getItem(ADMIN_EVENTS_KEY);
    const events = raw ? JSON.parse(raw) : [];
    return Array.isArray(events) ? events : [];
  } catch {
    return [];
  }
}

function saveAdminEvents(events) {
  try {
    localStorage.setItem(ADMIN_EVENTS_KEY, JSON.stringify(events));
  } catch {
    // Ignore LocalStorage errors.
  }
}

function generateEventId() {
  return `admin_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function getAllEvents() {
  return [...EVENTS, ...getAdminEvents()];
}

function populateIdentity() {
  const user = getCurrentUser();
  if (!user) return;

  const nameEl = document.getElementById("admin-name");
  const avatarEl = document.getElementById("admin-avatar");

  const firstName = user.firstName || "Admin";
  const lastName = user.lastName || "User";

  if (nameEl) {
    nameEl.textContent = `${firstName} ${lastName}`;
  }

  if (avatarEl) {
    avatarEl.textContent =
      `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }
}

function showOnlyView(viewName) {
  document.querySelectorAll("[data-view]").forEach((section) => {
    section.hidden = section.dataset.view !== viewName;
  });
}

function setActiveNav(page) {
  document.querySelectorAll("[data-route]").forEach((link) => {
    const active = link.dataset.page === page;

    link.classList.toggle("active", active);

    if (active) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function setPageTitle(page) {
  const title = document.getElementById("page-title");
  const pageTitle = PAGE_TITLES[page] || PAGE_TITLES[DEFAULT_PAGE];

  if (title) {
    title.textContent = pageTitle;
  }

  document.title = `${pageTitle} · Campus Event & Activity Hub`;
}

function parseHash(hash) {
  const raw = hash.replace(/^#\/?/, "");
  const segment = raw.split("?")[0].trim();

  return KNOWN_PAGES.includes(segment) ? segment : DEFAULT_PAGE;
}

function render(page) {
  const currentPage = KNOWN_PAGES.includes(page)
    ? page
    : DEFAULT_PAGE;

  showOnlyView(currentPage);
  setActiveNav(currentPage);
  setPageTitle(currentPage);
  closeDrawer();

  if (mounts[currentPage]) {
    mounts[currentPage]();
  }
}

function onRouteChange() {
  render(parseHash(window.location.hash));
}

/* ============================================================
   Sidebar
   ============================================================ */

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

  document.body.classList.toggle(
    "drawer-locked",
    isOpen && !isDesktop()
  );

  if (overlay) {
    overlay.hidden = !isOpen;
  }
}

function closeDrawer() {
  setOpenState(false);
}

function toggleSidebar() {
  if (isDesktop()) {
    shell()?.classList.toggle("is-collapsed");
    return;
  }

  const open = shell()?.classList.contains("sidebar-open");
  setOpenState(!open);
}

function initSidebar() {
  const toggle = document.getElementById("sidebar-toggle");
  const closeBtn = document.getElementById("sidebar-close");
  const overlay = document.getElementById("sidebar-overlay");
  const sidebar = document.getElementById("sidebar");

  toggle?.addEventListener("click", toggleSidebar);
  closeBtn?.addEventListener("click", closeDrawer);
  overlay?.addEventListener("click", closeDrawer);

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      shell()?.classList.contains("sidebar-open")
    ) {
      closeDrawer();
    }
  });

  sidebar?.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      closeDrawer();
    }
  });

  mediaDesktop.addEventListener("change", () => {
    setOpenState(false);
  });
}

/* ============================================================
   Logout
   ============================================================ */

function initLogout() {
  const link = document.getElementById("logout-link");

  link?.addEventListener("click", (event) => {
    event.preventDefault();

    logout();

    window.location.replace("index.html");
  });
}

/* ============================================================
   Toast
   ============================================================ */

function showToast(message) {
  const toast = document.getElementById("admin-toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  window.clearTimeout(toast._timer);

  toast._timer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

/* ============================================================
   Dashboard
   ============================================================ */

function mountDashboard() {
  const allEvents = getAllEvents();
  const registrations = getRegistrations();

  const total = allEvents.length;

  const upcoming = allEvents.filter(
    (event) => getEventState(event) === "upcoming"
  ).length;

  const completed = allEvents.filter(
    (event) => getEventState(event) === "completed"
  ).length;

  const values = {
    "admin-stat-total": total,
    "admin-stat-upcoming": upcoming,
    "admin-stat-completed": completed,
    "admin-stat-registrations": registrations.length,
  };

  Object.entries(values).forEach(([id, count]) => {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = String(count);
    }
  });

  mountRecentRegistrations(registrations, allEvents);
}

function mountRecentRegistrations(registrations, allEvents) {
  const list = document.getElementById("admin-recent-regs");
  const empty = document.getElementById("admin-recent-regs-empty");

  if (!list) return;

  const eventById = new Map(
    allEvents.map((event) => [event.id, event])
  );

  const sorted = [...registrations].sort(
    (a, b) =>
      new Date(b.registeredAt) -
      new Date(a.registeredAt)
  );

  list.replaceChildren();

  if (sorted.length === 0) {
    list.hidden = true;

    if (empty) {
      empty.hidden = false;
    }

    return;
  }

  list.hidden = false;

  if (empty) {
    empty.hidden = true;
  }

  sorted.slice(0, 5).forEach((registration) => {
    const event = eventById.get(registration.eventId);

    const row = document.createElement("div");
    row.className = "reg-list-item";

    const initials = (registration.userName || "Student")
      .charAt(0)
      .toUpperCase();

    row.innerHTML = `
      <span class="avatar avatar-sm">${initials}</span>

      <div class="reg-list-info">
        <span class="reg-list-name">
          ${escapeHtml(registration.userName || "Student")}
        </span>

        <span class="reg-list-email">
          ${escapeHtml(registration.userEmail || "")}
        </span>

        <span class="reg-list-event">
          ${escapeHtml(event?.title || registration.eventId)}
        </span>
      </div>

      <span class="reg-list-date">
        ${
          registration.registeredAt
            ? new Date(
                registration.registeredAt
              ).toLocaleDateString()
            : "—"
        }
      </span>
    `;

    list.appendChild(row);
  });
}

/* ============================================================
   Manage Events
   ============================================================ */

let eventsToolbarInit = false;
let eventFormInit = false;
let editingEventId = null;

function mountManageEvents() {
  populateEventsTable();
  initEventsToolbar();
  initEventForm();
  initDeleteModal();
}

function initEventsToolbar() {
  if (eventsToolbarInit) return;

  eventsToolbarInit = true;

  const search = document.getElementById("admin-event-search");
  const catFilter = document.getElementById(
    "admin-event-cat-filter"
  );

  const createBtn = document.getElementById(
    "admin-create-event-btn"
  );

  const emptyCreateBtn = document.getElementById(
    "admin-events-empty-create"
  );

  if (catFilter && catFilter.options.length <= 1) {
    CATEGORIES.forEach((category) => {
      const option = document.createElement("option");

      option.value = category.id;
      option.textContent = category.label;

      catFilter.appendChild(option);
    });
  }

  search?.addEventListener(
    "input",
    debounce(populateEventsTable, 180)
  );

  catFilter?.addEventListener(
    "change",
    populateEventsTable
  );

  createBtn?.addEventListener(
    "click",
    () => openEventForm()
  );

  emptyCreateBtn?.addEventListener(
    "click",
    () => openEventForm()
  );
}

function populateEventsTable() {
  const tbody = document.getElementById(
    "admin-events-tbody"
  );

  const tableWrap = document.getElementById(
    "admin-events-table-wrap"
  );

  const emptyState = document.getElementById(
    "admin-events-empty"
  );

  const emptyTitle = document.getElementById(
    "admin-events-empty-title"
  );

  const emptyCopy = document.getElementById(
    "admin-events-empty-copy"
  );

  const search = document.getElementById(
    "admin-event-search"
  );

  const catFilter = document.getElementById(
    "admin-event-cat-filter"
  );

  if (!tbody) return;

  const allEvents = getAllEvents();

  const query = (search?.value || "")
    .trim()
    .toLowerCase();

  const category = catFilter?.value || "";

  let filtered = allEvents.filter((event) => {
    const matchesSearch =
      !query ||
      String(event.title || "")
        .toLowerCase()
        .includes(query) ||
      String(event.location || "")
        .toLowerCase()
        .includes(query) ||
      String(event.organizer || "")
        .toLowerCase()
        .includes(query);

    const matchesCategory =
      !category || event.category === category;

    return matchesSearch && matchesCategory;
  });

  filtered.sort(
    (a, b) =>
      new Date(a.startDateTime) -
      new Date(b.startDateTime)
  );

  tbody.replaceChildren();

  if (filtered.length === 0) {
    if (tableWrap) tableWrap.hidden = true;
    if (emptyState) emptyState.hidden = false;

    if (emptyTitle) {
      emptyTitle.textContent =
        query || category
          ? "No events match your filters"
          : "No events yet";
    }

    if (emptyCopy) {
      emptyCopy.textContent =
        query || category
          ? "Try adjusting your search or filter criteria."
          : "Create your first event to get started.";
    }

    return;
  }

  if (tableWrap) tableWrap.hidden = false;
  if (emptyState) emptyState.hidden = true;

  const registrations = getRegistrations();

  filtered.forEach((event) => {
    const registrationCount = registrations.filter(
      (registration) =>
        registration.eventId === event.id
    ).length;

    const state = getEventStateVisuals(event);
    const isAdminCreated =
      String(event.id).startsWith("admin_");

    const row = document.createElement("tr");

    const titleCell = document.createElement("td");
    titleCell.className = "cell-title";
    titleCell.dataset.label = "Event";
    titleCell.textContent = event.title;

    const categoryCell = document.createElement("td");
    categoryCell.dataset.label = "Category";

    const categoryBadge = document.createElement("span");
    categoryBadge.className = "admin-cat-badge";
    categoryBadge.textContent =
      CATEGORY_LABEL[event.category] ||
      event.category ||
      "Other";

    categoryCell.appendChild(categoryBadge);

    const dateCell = document.createElement("td");
    dateCell.dataset.label = "Date";
    dateCell.textContent =
      `${formatDateLabel(event.startDateTime)} ${formatTime(
        event.startDateTime
      )}`;

    const capacityCell = document.createElement("td");
    capacityCell.dataset.label = "Capacity";
    capacityCell.textContent =
      event.capacity || "—";

    const registrationCell =
      document.createElement("td");

    registrationCell.dataset.label = "Registrations";
    registrationCell.className =
      "admin-reg-count";

    registrationCell.textContent =
      String(registrationCount);

    const actionsCell = document.createElement("td");

    actionsCell.dataset.label = "Actions";
    actionsCell.className = "cell-actions";

    if (isAdminCreated) {
      const editBtn = document.createElement("button");

      editBtn.className =
        "btn btn-sm btn-secondary";

      editBtn.type = "button";
      editBtn.textContent = "Edit";

      editBtn.addEventListener(
        "click",
        () => openEventForm(event)
      );

      const deleteBtn = document.createElement("button");

      deleteBtn.className =
        "btn btn-sm btn-danger";

      deleteBtn.type = "button";
      deleteBtn.textContent = "Delete";

      deleteBtn.addEventListener(
        "click",
        () => openDeleteModal(event)
      );

      actionsCell.append(editBtn, deleteBtn);
    } else {
      const note = document.createElement("span");

      note.className =
        "text-xs text-muted";

      note.textContent = state?.label
        ? `Seed event · ${state.label}`
        : "Seed event";

      actionsCell.appendChild(note);
    }

    row.append(
      titleCell,
      categoryCell,
      dateCell,
      capacityCell,
      registrationCell,
      actionsCell
    );

    tbody.appendChild(row);
  });
}

/* ============================================================
   Event Form
   ============================================================ */

function initEventForm() {
  if (eventFormInit) return;

  eventFormInit = true;

  const overlay = document.getElementById(
    "event-modal-overlay"
  );

  const form = document.getElementById(
    "event-form"
  );

  const closeBtn = document.getElementById(
    "event-modal-close"
  );

  const cancelBtn = document.getElementById(
    "event-form-cancel"
  );

  const catSelect = document.getElementById(
    "event-form-category"
  );

  if (catSelect && catSelect.options.length <= 1) {
    CATEGORIES.forEach((category) => {
      const option = document.createElement("option");

      option.value = category.id;
      option.textContent = category.label;

      catSelect.appendChild(option);
    });
  }

  closeBtn?.addEventListener(
    "click",
    closeEventForm
  );

  cancelBtn?.addEventListener(
    "click",
    closeEventForm
  );

  overlay?.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeEventForm();
    }
  });

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    handleEventSubmit();
  });
}

function openEventForm(event = null) {
  const overlay = document.getElementById(
    "event-modal-overlay"
  );

  const title = document.getElementById(
    "event-modal-title"
  );

  const submitBtn = document.getElementById(
    "event-form-submit"
  );

  clearFormErrors();

  if (event) {
    editingEventId = event.id;

    if (title) title.textContent = "Edit Event";
    if (submitBtn) {
      submitBtn.textContent = "Save Changes";
    }

    const startDate = new Date(
      event.startDateTime
    );

    const dateStr =
      startDate.toISOString().split("T")[0];

    const timeStr =
      `${String(startDate.getHours()).padStart(2, "0")}:${String(
        startDate.getMinutes()
      ).padStart(2, "0")}`;

    setVal("event-form-title", event.title);
    setVal("event-form-category", event.category);
    setVal("event-form-capacity", event.capacity);
    setVal("event-form-date", dateStr);
    setVal("event-form-time", timeStr);
    setVal("event-form-location", event.location);
    setVal(
      "event-form-duration",
      event.durationMinutes || 60
    );
    setVal(
      "event-form-description",
      event.description
    );
    setVal(
      "event-form-image",
      event.image || ""
    );
  } else {
    editingEventId = null;

    if (title) title.textContent = "Create Event";

    if (submitBtn) {
      submitBtn.textContent = "Create Event";
    }

    resetForm();
  }

  if (overlay) {
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
  }

  window.setTimeout(() => {
    document
      .getElementById("event-form-title")
      ?.focus();
  }, 150);
}

function closeEventForm() {
  const overlay = document.getElementById(
    "event-modal-overlay"
  );

  if (overlay) {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
  }

  editingEventId = null;
  clearFormErrors();
}

function resetForm() {
  document.getElementById("event-form")?.reset();
}

function setVal(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.value = value ?? "";
  }
}

function getVal(id) {
  const element = document.getElementById(id);

  return element ? element.value.trim() : "";
}

function handleEventSubmit() {
  clearFormErrors();

  const title = getVal("event-form-title");
  const category = getVal("event-form-category");
  const date = getVal("event-form-date");
  const time = getVal("event-form-time");
  const location = getVal("event-form-location");
  const description = getVal(
    "event-form-description"
  );

  const capacity = getVal(
    "event-form-capacity"
  );

  const duration = getVal(
    "event-form-duration"
  );

  const image = getVal(
    "event-form-image"
  );

  let valid = true;

  if (!title) {
    showFieldError(
      "event-form-title",
      "Title is required."
    );
    valid = false;
  }

  if (!category) {
    showFieldError(
      "event-form-category",
      "Category is required."
    );
    valid = false;
  }

  if (!date) {
    showFieldError(
      "event-form-date",
      "Date is required."
    );
    valid = false;
  }

  if (!time) {
    showFieldError(
      "event-form-time",
      "Time is required."
    );
    valid = false;
  }

  if (!location) {
    showFieldError(
      "event-form-location",
      "Location is required."
    );
    valid = false;
  }

  if (!description) {
    showFieldError(
      "event-form-description",
      "Description is required."
    );
    valid = false;
  }

  if (!capacity || Number(capacity) < 1) {
    showFieldError(
      "event-form-capacity",
      "Capacity must be at least 1."
    );
    valid = false;
  }

  if (!valid) return;

  const startDateTime =
    combineDateTime(date, time);

  const eventData = {
    title,
    category,
    startDateTime,
    durationMinutes: Number(duration) || 60,
    location,
    description,
    capacity: Number(capacity),
    organizer: "Admin",
    tags: [category],
    image:
      image || "../images/placeholder-event.svg",
  };

  if (editingEventId) {
    updateAdminEvent(
      editingEventId,
      eventData
    );

    showToast(
      "Event updated successfully."
    );
  } else {
    eventData.id = generateEventId();

    createAdminEvent(eventData);

    showToast(
      "Event created successfully."
    );
  }

  closeEventForm();
  populateEventsTable();

  if (
    parseHash(window.location.hash) ===
    "admin-dashboard"
  ) {
    mountDashboard();
  }
}

function combineDateTime(dateString, timeString) {
  const [year, month, day] =
    dateString.split("-").map(Number);

  const [hours, minutes] =
    timeString.split(":").map(Number);

  return new Date(
    year,
    month - 1,
    day,
    hours,
    minutes,
    0,
    0
  ).toISOString();
}

/* ============================================================
   CRUD
   ============================================================ */

function createAdminEvent(eventData) {
  const events = getAdminEvents();

  events.push(eventData);

  saveAdminEvents(events);
}

function updateAdminEvent(id, updates) {
  const events = getAdminEvents();

  const index = events.findIndex(
    (event) => event.id === id
  );

  if (index === -1) {
    showToast("Event not found.");
    return;
  }

  events[index] = {
    ...events[index],
    ...updates,
    id,
  };

  saveAdminEvents(events);
}

function deleteAdminEvent(id) {
  const events = getAdminEvents();

  const updated = events.filter(
    (event) => event.id !== id
  );

  if (updated.length === events.length) {
    showToast("Event not found.");
    return;
  }

  saveAdminEvents(updated);

  showToast("Event deleted.");

  populateEventsTable();

  if (
    parseHash(window.location.hash) ===
    "admin-dashboard"
  ) {
    mountDashboard();
  }
}

/* ============================================================
   Delete Modal
   ============================================================ */

let deleteTarget = null;
let deleteModalInit = false;

function initDeleteModal() {
  if (deleteModalInit) return;

  deleteModalInit = true;

  const overlay = document.getElementById(
    "delete-modal-overlay"
  );

  const closeBtn = document.getElementById(
    "delete-modal-close"
  );

  const cancelBtn = document.getElementById(
    "delete-modal-cancel"
  );

  const confirmBtn = document.getElementById(
    "delete-modal-confirm"
  );

  closeBtn?.addEventListener(
    "click",
    closeDeleteModal
  );

  cancelBtn?.addEventListener(
    "click",
    closeDeleteModal
  );

  overlay?.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeDeleteModal();
    }
  });

  confirmBtn?.addEventListener(
    "click",
    () => {
      if (!deleteTarget) return;

      deleteAdminEvent(deleteTarget.id);
      closeDeleteModal();
    }
  );
}

function openDeleteModal(event) {
  deleteTarget = event;

  const overlay = document.getElementById(
    "delete-modal-overlay"
  );

  const nameElement = document.getElementById(
    "delete-modal-event-name"
  );

  if (nameElement) {
    nameElement.textContent = `"${event.title}"`;
  }

  if (overlay) {
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
  }
}

function closeDeleteModal() {
  deleteTarget = null;

  const overlay = document.getElementById(
    "delete-modal-overlay"
  );

  if (overlay) {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
  }
}

/* ============================================================
   Registrations
   ============================================================ */

let regsToolbarInit = false;

function mountRegistrations() {
  populateRegistrations();
  initRegsToolbar();
}

function initRegsToolbar() {
  if (regsToolbarInit) return;

  regsToolbarInit = true;

  const search = document.getElementById(
    "admin-reg-search"
  );

  search?.addEventListener(
    "input",
    debounce(populateRegistrations, 180)
  );
}

function populateRegistrations() {
  const list = document.getElementById(
    "admin-regs-list"
  );

  const empty = document.getElementById(
    "admin-regs-empty"
  );

  const countEl = document.getElementById(
    "admin-regs-count"
  );

  const search = document.getElementById(
    "admin-reg-search"
  );

  if (!list) return;

  const registrations = getRegistrations();
  const allEvents = getAllEvents();

  const eventById = new Map(
    allEvents.map((event) => [event.id, event])
  );

  const query = (search?.value || "")
    .trim()
    .toLowerCase();

  let filtered = [...registrations].sort(
    (a, b) =>
      new Date(b.registeredAt) -
      new Date(a.registeredAt)
  );

  if (query) {
    filtered = filtered.filter((registration) => {
      const event = eventById.get(
        registration.eventId
      );

      const haystack = [
        registration.userName,
        registration.userEmail,
        event?.title,
        registration.eventId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }

  list.replaceChildren();

  if (countEl) {
    countEl.textContent =
      `${filtered.length} registration${
        filtered.length === 1 ? "" : "s"
      } found`;
  }

  if (filtered.length === 0) {
    list.hidden = true;

    if (empty) {
      empty.hidden = false;
    }

    return;
  }

  list.hidden = false;

  if (empty) {
    empty.hidden = true;
  }

  filtered.forEach((registration) => {
    const event = eventById.get(
      registration.eventId
    );

    const row = document.createElement("div");

    row.className = "reg-list-item";

    const initials = (
      registration.userName || "Student"
    )
      .charAt(0)
      .toUpperCase();

    row.innerHTML = `
      <span class="avatar avatar-sm">
        ${initials}
      </span>

      <div class="reg-list-info">
        <span class="reg-list-name">
          ${escapeHtml(
            registration.userName || "Student"
          )}
        </span>

        <span class="reg-list-email">
          ${escapeHtml(
            registration.userEmail || ""
          )}
        </span>

        <span class="reg-list-event">
          ${escapeHtml(
            event?.title ||
              registration.eventId
          )}
        </span>
      </div>

      <span class="reg-list-date">
        ${
          registration.registeredAt
            ? new Date(
                registration.registeredAt
              ).toLocaleDateString()
            : "—"
        }
      </span>
    `;

    list.appendChild(row);
  });
}

/* ============================================================
   Form Errors
   ============================================================ */

function showFieldError(inputId, message) {
  const input = document.getElementById(inputId);

  const error = document.getElementById(
    `${inputId}-error`
  );

  if (input) {
    input.classList.add("is-invalid");
  }

  if (error) {
    error.textContent = message;
    error.hidden = false;
  }
}

function clearFormErrors() {
  document
    .querySelectorAll(".modal .is-invalid")
    .forEach((element) => {
      element.classList.remove("is-invalid");
    });

  document
    .querySelectorAll(".modal .field-error")
    .forEach((element) => {
      element.textContent = "";
      element.hidden = true;
    });
}


function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function debounce(fn, ms) {
  let timer;

  return (...args) => {
    window.clearTimeout(timer);

    timer = window.setTimeout(
      () => fn(...args),
      ms
    );
  };
}


const mounts = {
  "admin-dashboard": mountDashboard,
  "manage-events": mountManageEvents,
  registrations: mountRegistrations,
};



async function boot() {

  if (!isLoggedIn()) {
    window.location.replace("login.html");
    return;
  }

  if (!isAdmin()) {
    window.location.replace("app.html");
    return;
  }

  populateIdentity();
  initLogout();
  initSidebar();

  const page = parseHash(window.location.hash);

  render(page);

  window.addEventListener(
    "hashchange",
    onRouteChange
  );
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    boot
  );
} else {
  boot();
}