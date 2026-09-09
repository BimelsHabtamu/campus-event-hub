/* ============================================================
   events-page.js — Controller for events.html (Browse Events)
   ------------------------------------------------------------
   Renders the complete event list with live search, category/date
   filtering, sorting, bookmarking, and directs "View Details" to
   event-details.html?id=${event.id}.
   ============================================================ */

import { CATEGORIES, CATEGORY_LABEL, EVENTS } from "./data.js";
import { formatDateLabel, formatTime } from "./utils.js";
import { applyFilter, sortEvents, filterToParams, filterFromParams } from "./filters.js";
import { isEventSaved, saveEvent, unsaveEvent } from "./store.js";
import { initNav } from "./site-nav.js";
import { getCurrentUser, logout } from "./auth.js";
import { getEventState } from "./event-details.js";

/* ------------------------------------------------------------
   Navbar User Session Menu
   ------------------------------------------------------------ */
let detachUserMenu = null;
function renderAuthNav() {
  const actions = document.getElementById("nav-actions");
  if (!actions) return;

  if (typeof detachUserMenu === "function") {
    detachUserMenu();
    detachUserMenu = null;
  }
  actions.replaceChildren();

  const user = getCurrentUser();
  if (!user) {
    const login = document.createElement("a");
    login.className = "btn btn-ghost";
    login.href = "login.html";
    login.textContent = "Log in";

    const signup = document.createElement("a");
    signup.className = "btn btn-primary";
    signup.href = "register.html";
    signup.textContent = "Get started";

    actions.append(login, signup);
    return;
  }

  const menu = document.createElement("div");
  menu.className = "user-menu";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "user-menu-trigger";
  trigger.setAttribute("aria-haspopup", "true");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-label", `Account menu for ${user.name}`);

  const avatar = document.createElement("span");
  avatar.className = "avatar";
  avatar.textContent = user.avatarInitials || user.name.slice(0, 2).toUpperCase();

  const name = document.createElement("span");
  name.className = "user-menu-name";
  name.textContent = user.name.split(" ")[0];

  trigger.append(avatar, name);

  const dropdown = document.createElement("div");
  dropdown.className = "user-menu-dropdown";
  dropdown.setAttribute("role", "menu");

  const dashItem = document.createElement("a");
  dashItem.className = "user-menu-item";
  dashItem.href = "app.html#/dashboard";
  dashItem.textContent = "Dashboard";

  const savedItem = document.createElement("a");
  savedItem.className = "user-menu-item";
  savedItem.href = "app.html#/saved";
  savedItem.textContent = "Saved events";

  const logoutBtn = document.createElement("button");
  logoutBtn.type = "button";
  logoutBtn.className = "user-menu-item user-menu-item-danger";
  logoutBtn.textContent = "Log out";
  logoutBtn.addEventListener("click", () => {
    logout();
    renderAuthNav();
  });

  dropdown.append(dashItem, savedItem, logoutBtn);
  menu.append(trigger, dropdown);
  actions.appendChild(menu);

  const toggleDropdown = (open) => {
    const isExpanded = open ?? !dropdown.classList.contains("is-open");
    dropdown.classList.toggle("is-open", isExpanded);
    trigger.setAttribute("aria-expanded", String(isExpanded));
  };

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDropdown();
  });

  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target)) toggleDropdown(false);
  });

  detachUserMenu = () => {
    trigger.removeEventListener("click", toggleDropdown);
  };
}

/* ------------------------------------------------------------
   Events Page Controller
   ------------------------------------------------------------ */
function initEventsPage() {
  const grid = document.getElementById("events-grid");
  const emptyState = document.getElementById("events-empty");
  const emptyText = document.getElementById("events-empty-text");
  const countEl = document.getElementById("events-result-count");
  const searchInput = document.getElementById("search-input");
  const categorySelect = document.getElementById("category-filter");
  const dateSelect = document.getElementById("date-filter");
  const sortSelect = document.getElementById("sort-select");
  const searchForm = document.getElementById("search-form");

  if (!grid || !searchInput || !categorySelect || !dateSelect || !sortSelect) return;

  // Seed category options
  if (categorySelect.options.length <= 1) {
    CATEGORIES.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.label;
      categorySelect.appendChild(option);
    });
  }

  // Read initial params from URL
  const initialParams = new URLSearchParams(window.location.search);
  const filterState = filterFromParams(initialParams);
  if (initialParams.has("cat")) {
    filterState.category = initialParams.get("cat");
  }

  searchInput.value = filterState.query;
  categorySelect.value = filterState.category;
  dateSelect.value = filterState.dateRange;
  sortSelect.value = filterState.sort;

  function buildCard(event) {
    const card = document.createElement("article");
    card.className = "card card-hover event-card";

    const state = getEventState(event);

    const cover = document.createElement("div");
    cover.className = "event-card-cover";

    const img = document.createElement("img");
    img.className = "event-card-image";
    img.src = event.image || "../images/placeholder-event.svg";
    img.alt = event.title;
    img.loading = "lazy";
    img.onerror = () => {
      img.src = "../images/placeholder-event.svg";
    };

    const badgesWrap = document.createElement("div");
    badgesWrap.style.cssText = "position:absolute;top:0.75rem;left:0.75rem;display:flex;gap:0.35rem;flex-wrap:wrap;";

    const catBadge = document.createElement("span");
    catBadge.className = "badge badge-brand";
    catBadge.textContent = CATEGORY_LABEL[event.category] ?? event.category;

    const statusBadge = document.createElement("span");
    statusBadge.className = `badge ${state.badgeClass}`;
    statusBadge.textContent = state.label;

    badgesWrap.append(catBadge, statusBadge);
    cover.append(img, badgesWrap);

    const body = document.createElement("div");
    body.className = "event-card-body";

    const titleH3 = document.createElement("h3");
    titleH3.className = "event-card-title";
    const titleLink = document.createElement("a");
    titleLink.className = "event-card-title-link";
    titleLink.href = `event-details.html?id=${encodeURIComponent(event.id)}`;
    titleLink.textContent = event.title;
    titleH3.appendChild(titleLink);

    const meta = document.createElement("p");
    meta.className = "event-card-meta";

    const datetime = document.createElement("span");
    datetime.className = "event-card-datetime";
    datetime.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>
      <time>${formatDateLabel(event.startDateTime)} · ${formatTime(event.startDateTime)}</time>
    `;

    const location = document.createElement("span");
    location.className = "event-card-location";
    location.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-5.1-7-11a7 7 0 0114 0c0 5.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
      <span>${event.location}</span>
    `;

    meta.append(datetime, location);
    body.append(titleH3, meta);

    const actions = document.createElement("div");
    actions.className = "event-card-actions";

    const detailsBtn = document.createElement("a");
    detailsBtn.className = "btn btn-sm btn-primary event-card-link";
    detailsBtn.href = `event-details.html?id=${encodeURIComponent(event.id)}`;
    detailsBtn.textContent = "View Details";

    const saveBtn = document.createElement("button");
    saveBtn.className = "btn btn-sm btn-secondary event-card-save";
    saveBtn.type = "button";

    const updateSave = () => {
      const saved = isEventSaved(event.id);
      saveBtn.setAttribute("aria-pressed", String(saved));
      saveBtn.textContent = saved ? "Saved" : "Save";
    };
    updateSave();

    saveBtn.addEventListener("click", () => {
      if (isEventSaved(event.id)) {
        unsaveEvent(event.id);
      } else {
        saveEvent(event.id);
      }
      updateSave();
    });

    actions.append(detailsBtn, saveBtn);

    card.append(cover, body, actions);
    return card;
  }

  function render() {
    const query = searchInput.value;
    const category = categorySelect.value;
    const dateRange = dateSelect.value;
    const sort = sortSelect.value;

    const matched = applyFilter(EVENTS, { query, category, dateRange });
    const sorted = sortEvents(matched, sort);

    grid.replaceChildren();
    grid.append(...sorted.map(buildCard));

    const total = sorted.length;
    countEl.textContent = `${total} of ${EVENTS.length} event${total === 1 ? "" : "s"} found`;

    const hasNoResults = total === 0;
    if (emptyState) emptyState.hidden = !hasNoResults;
    grid.hidden = hasNoResults;

    if (hasNoResults && emptyText) {
      emptyText.textContent = query.trim()
        ? `No events match "${query.trim()}". Try different search terms or clear filters.`
        : "No events match the selected filters. Try widening your criteria.";
    }
  }

  let debounce = null;
  const syncAndRender = () => {
    render();
    const query = searchInput.value;
    const category = categorySelect.value;
    const dateRange = dateSelect.value;
    const sort = sortSelect.value;
    const params = filterToParams({ query, category, dateRange, sort });
    const newUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState({}, "", newUrl);
  };

  searchInput.addEventListener("input", () => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(syncAndRender, 150);
  });

  categorySelect.addEventListener("change", syncAndRender);
  dateSelect.addEventListener("change", syncAndRender);
  sortSelect.addEventListener("change", syncAndRender);

  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      syncAndRender();
    });
  }

  render();
}

function boot() {
  initNav();
  renderAuthNav();
  initEventsPage();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}
