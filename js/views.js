import { CATEGORIES, CATEGORY_LABEL, EVENTS } from "./data.js";
import { formatDateLabel, formatTime } from "./utils.js";
import { applyFilter, sortEvents, filterToParams, filterFromParams } from "./filters.js";
import { isEventSaved, saveEvent, unsaveEvent } from "./store.js";

export const DEFAULT_PAGE = "home";

export function resolvePage(page) {
  return page ?? DEFAULT_PAGE;
}

/** Show one [data-view] section and hide the others. */
export function showOnlyView(viewName) {
  document.querySelectorAll("[data-view]").forEach((section) => {
    section.hidden = section.dataset.view !== viewName;
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/** Reflect the active route in the public nav links (aria-current). */
export function setActiveNav(page) {
  document.querySelectorAll("[data-route]").forEach((link) => {
    const isActive = link.dataset.page === page;
    link.classList.toggle("active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

/** Fill the category filter select once (if not already). */
export function seedCategoryFilter() {
  const select = document.querySelector("#category-filter");
  if (!select || select.options.length > 1) return;
  CATEGORIES.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.label;
    select.appendChild(option);
  });
}

/** Curated ids shown in the "Featured" grid. */
const FEATURED_IDS = ["hackathon-24h", "career-fair-spring", "international-food-festival"];

/** How many of the next upcoming events to show. */
const UPCOMING_LIMIT = 6;

const CATEGORY_ICONS = {
  workshop: '<path d="M9 18h6M10 21h4M8.7 14.6a5 5 0 116.6 0C14.4 15.6 14 16.3 14 17h-4c0-.7-.4-1.4-1.3-2.4z"/>',
  hackathon: '<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>',
  career: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 12h18"/>',
  seminar: '<path d="M3 5h18M6 5v9a2 2 0 002 2h8a2 2 0 002-2V5"/><path d="M12 16v4M8 20h8"/>',
  sports: '<path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 01-10 0z"/><path d="M17 5h3a1 1 0 011 1c0 2.5-2 4-4 4M7 5H4a1 1 0 00-1 1c0 2.5 2 4 4 4"/>',
  competition: '<path d="M5 21V4M5 5h13l-3 4 3 4H5"/>',
  cultural: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
};

function icon(body) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = body;
  return svg;
}

function buildEventCard(event, index, { showDescription = false } = {}) {
  const card = document.createElement("article");
  card.className = "card card-hover event-card";
  card.setAttribute("data-reveal", "");
  card.style.setProperty("--reveal-delay", `${(index % 4) * 70}ms`);

  const body = document.createElement("div");
  body.className = "event-card-body";

  const badge = document.createElement("span");
  badge.className = "badge badge-brand event-card-badge";
  badge.textContent = CATEGORY_LABEL[event.category] ?? event.category;

  const title = document.createElement("h3");
  title.className = "event-card-title";
  const titleLink = document.createElement("a");
  titleLink.href = `#/event/${event.id}`;
  titleLink.textContent = event.title;
  title.appendChild(titleLink);

  body.append(badge, title);

  if (showDescription) {
    const desc = document.createElement("p");
    desc.className = "event-card-desc";
    desc.textContent = event.description;
    body.appendChild(desc);
  }

  const meta = document.createElement("p");
  meta.className = "event-card-meta";
  const time = document.createElement("time");
  time.dateTime = event.startDateTime;
  time.textContent = `${formatDateLabel(event.startDateTime)} · ${formatTime(event.startDateTime)}`;
  const location = document.createElement("span");
  location.className = "event-card-location";
  location.textContent = event.location;
  meta.append(time, location);
  body.appendChild(meta);

  card.appendChild(body);

  const actions = document.createElement("div");
  actions.className = "event-card-actions";
  const details = document.createElement("a");
  details.className = "event-card-link";
  details.href = `event-details.html?id=${encodeURIComponent(event.id)}`;
  details.textContent = "View details";
  actions.appendChild(details);
  card.appendChild(actions);

  return card;
}

/** Build a category card with per-category accent colour + event count. */
function buildCategoryCard(category, index) {
  const count = EVENTS.filter((event) => event.category === category.id).length;

  const card = document.createElement("a");
  card.className = "card card-hover category-card";
  card.href = "#/events";
  card.dataset.cat = category.id;
  card.setAttribute("data-reveal", "");
  card.style.setProperty("--reveal-delay", `${(index % 4) * 70}ms`);

  const iconBox = document.createElement("span");
  iconBox.className = "category-icon";
  iconBox.appendChild(icon(CATEGORY_ICONS[category.id] ?? CATEGORY_ICONS.workshop));

  const title = document.createElement("h3");
  title.textContent = category.label;

  const meta = document.createElement("p");
  meta.className = "category-meta";
  meta.textContent = `${count} ${count === 1 ? "event" : "events"} this term`;

  const arrow = icon('<path d="M5 12h14M13 6l6 6-6 6"/>');
  arrow.classList.add("category-arrow");

  card.append(iconBox, title, meta, arrow);
  return card;
}


/** Public landing — hero + features live in the HTML; cards mount here once. */
export function mountHome() {
  const featured = document.querySelector("#featured-grid");
  if (featured && !featured.dataset.mounted) {
    featured.dataset.mounted = "true";
    FEATURED_IDS.forEach((id, index) => {
      const event = EVENTS.find((candidate) => candidate.id === id);
      if (event) featured.appendChild(buildEventCard(event, index));
    });
  }

  const categories = document.querySelector("#categories-grid");
  if (categories && !categories.dataset.mounted) {
    categories.dataset.mounted = "true";
    CATEGORIES.forEach((category, index) => categories.appendChild(buildCategoryCard(category, index)));
  }

  const upcoming = document.querySelector("#upcoming-grid");
  if (upcoming && !upcoming.dataset.mounted) {
    upcoming.dataset.mounted = "true";
    const now = Date.now();
    EVENTS
      .filter((event) => new Date(event.startDateTime).getTime() >= now)
      .sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime))
      .slice(0, UPCOMING_LIMIT)
      .forEach((event, index) => upcoming.appendChild(buildEventCard(event, index, { showDescription: true })));
  }
}

/** Events listing — discovery view with live search/filter/sort. @param {import("./router.js").Route} route */
export function mountEvents(route) {
  seedCategoryFilter();

  const host = document.querySelector("#view-events");
  const grid = document.querySelector("#events-grid");
  const empty = document.querySelector("#events-empty");
  const emptyText = document.querySelector("#events-empty-text");
  const countEl = document.querySelector("#events-result-count");
  const searchInput = document.querySelector("#search-input");
  const categorySelect = document.querySelector("#category-filter");
  const dateSelect = document.querySelector("#date-filter");
  const sortSelect = document.querySelector("#sort-select");
  const form = document.querySelector("#search-form");
  if (!grid || !empty || !countEl || !searchInput || !categorySelect || !dateSelect || !sortSelect) return;

  /** Read the current filter state from the URL (single source of truth). */
  function stateFromUrl() {
    return filterFromParams(route.query ?? new URLSearchParams());
  }

  /** Read the current filter state from the controls. */
  function stateFromControls() {
    return {
      query: searchInput.value,
      category: categorySelect.value,
      dateRange: dateSelect.value,
      sort: sortSelect.value,
    };
  }

  /** Push the control state to the URL so back/forward + refreshes hold it. */
  function syncUrl() {
    const { query, category, dateRange, sort } = stateFromControls();
    const params = filterToParams({ query, category, dateRange, sort });
    const target = `#/events${params.toString() ? `?${params}` : ""}`;
    if (window.location.hash === target) {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } else {
      window.location.hash = target;
    }
  }

  /** Render a single event card from the shared template. */
  function fillCard(template, event) {
    const card = template.content.firstElementChild.cloneNode(true);

    const image = card.querySelector(".event-card-image");
    image.src = event.image;
    image.alt = event.title;

    card.querySelector(".event-card-badge").textContent =
      CATEGORY_LABEL[event.category] ?? event.category;

    const titleLink = card.querySelector(".event-card-title-link");
    titleLink.href = `event-details.html?id=${encodeURIComponent(event.id)}`;
    titleLink.textContent = event.title;

    const time = card.querySelector(".event-card-date");
    time.dateTime = event.startDateTime;
    time.textContent = `${formatDateLabel(event.startDateTime)} · ${formatTime(event.startDateTime)}`;

    card.querySelector(".event-card-location-text").textContent = event.location;
    card.querySelector(".event-card-link").href = `event-details.html?id=${encodeURIComponent(event.id)}`;

    const saveButton = card.querySelector(".event-card-save");
    const updateSave = () => {
      const saved = isEventSaved(event.id);
      saveButton.setAttribute("aria-pressed", String(saved));
      saveButton.textContent = saved ? "Saved" : "Save";
    };
    updateSave();
    saveButton.addEventListener("click", () => {
      if (isEventSaved(event.id)) unsaveEvent(event.id);
      else saveEvent(event.id);
      updateSave();
    });

    return card;
  }

  /** Apply the current filter state and repaint the grid + count + empty state. */
  function render() {
    const { query, category, dateRange, sort } = stateFromControls();
    const matched = applyFilter(EVENTS, { query, category, dateRange });
    const sorted = sortEvents(matched, sort);
    const template = document.querySelector("#event-card-template");

    grid.replaceChildren();
    grid.append(...sorted.map((event) => fillCard(template, event)));

    const found = sorted.length;
    countEl.textContent = `${found} of ${EVENTS.length} event${found === 1 ? "" : "s"} found`;

    const hasCriteria = Boolean(query.trim()) || category !== "all" || dateRange !== "all";
    empty.hidden = found !== 0;
    grid.hidden = found === 0;
    if (found === 0 && emptyText) {
      emptyText.textContent = query.trim()
        ? `No events match “${query.trim()}”. Try a different search or clear some filters.`
        : "No events match these filters. Try widening the date or category.";
    }
  }

  // Populate controls from the URL state, then render once.
  const { query, category, dateRange, sort } = stateFromUrl();
  searchInput.value = query;
  categorySelect.value = category;
  dateSelect.value = dateRange;
  sortSelect.value = sort;
  render();

  // Wire the interactive controls exactly once per page load.
  if (!host.dataset.listenersMounted) {
    host.dataset.listenersMounted = "true";
    let debounce = null;
    searchInput.addEventListener("input", () => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(syncUrl, 180);
    });
    categorySelect.addEventListener("change", syncUrl);
    dateSelect.addEventListener("change", syncUrl);
    sortSelect.addEventListener("change", syncUrl);
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      syncUrl();
    });
  }
}

/** Event detail. @param {import("./router.js").Route} route */
export function mountEventDetail(route) {
  if (route.id) {
    window.location.href = `event-details.html?id=${encodeURIComponent(route.id)}`;
    return;
  }
  const container = document.querySelector("#event-detail");
  if (container) {
    container.textContent = "Missing event id in the URL.";
  }
}

/** Route dispatcher for the public shell. */
export function getMountForPage(page) {
  const mounts = {
    home: mountHome,
    events: mountEvents,
    "event-detail": mountEventDetail,
  };
  return mounts[page] ?? mountEvents;
}