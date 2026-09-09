/* ============================================================
   event-details.js — Stage 5: Event Details & Live Countdown
   ------------------------------------------------------------
   1. Reads event id from URL query param (?id=...)
   2. Dynamically finds event in mock dataset (data.js)
   3. Displays all metadata (image, title, category, description,
      date, time range, location, organizer, capacity, reg info)
   4. Live countdown for upcoming events (ticking every second)
   5. Dynamic state handling: Upcoming, Happening now, Completed
   6. Save/Bookmark persistence via store.js
   7. Professional Event Not Found state for invalid/missing ids
   ============================================================ */

import { EVENTS, CATEGORY_LABEL } from "./data.js";
import { formatDateLabel, formatTime, formatDuration } from "./utils.js";
import { getCountdownParts, pad } from "./countdown.js";
import { isEventSaved, saveEvent, unsaveEvent } from "./store.js";
import { initNav } from "./site-nav.js";
import { getCurrentUser, logout } from "./auth.js";

/* ------------------------------------------------------------
   State Evaluation
   ------------------------------------------------------------ */

/**
 * Determine event status relative to the current time.
 * @param {import("./data.js").Event} event
 * @returns {{ status: "upcoming" | "live" | "completed", label: string, badgeClass: string, startMs: number, endMs: number }}
 */
export function getEventState(event) {
  const now = Date.now();
  const startMs = new Date(event.startDateTime).getTime();
  const duration = (event.durationMinutes && event.durationMinutes > 0) ? event.durationMinutes : 60;
  const endMs = startMs + duration * 60000;

  if (now < startMs) {
    return {
      status: "upcoming",
      label: "Upcoming",
      badgeClass: "badge-upcoming",
      startMs,
      endMs,
    };
  }
  if (now >= startMs && now <= endMs) {
    return {
      status: "live",
      label: "Happening Now",
      badgeClass: "badge-live",
      startMs,
      endMs,
    };
  }
  return {
    status: "completed",
    label: "Completed",
    badgeClass: "badge-completed",
    startMs,
    endMs,
  };
}

/* ------------------------------------------------------------
   Toast Notifications
   ------------------------------------------------------------ */
let toastTimeout = null;
function showToast(message) {
  let toast = document.getElementById("event-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "event-toast";
    toast.className = "event-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");

  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

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

  const onTriggerClick = (e) => {
    e.stopPropagation();
    toggleDropdown();
  };

  const onDocClick = (e) => {
    if (!menu.contains(e.target)) toggleDropdown(false);
  };

  trigger.addEventListener("click", onTriggerClick);
  document.addEventListener("click", onDocClick);

  detachUserMenu = () => {
    trigger.removeEventListener("click", onTriggerClick);
    document.removeEventListener("click", onDocClick);
  };
}

/* ------------------------------------------------------------
   Countdown Controller
   ------------------------------------------------------------ */
let countdownTimer = null;

function clearLiveCountdown() {
  if (countdownTimer) {
    window.clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

/**
 * Initialize live countdown updating every 1000ms.
 * When event starts, triggers state refresh.
 */
function initCountdown(targetIso, onComplete) {
  clearLiveCountdown();

  const daysEl = document.getElementById("countdown-days");
  const hoursEl = document.getElementById("countdown-hours");
  const minutesEl = document.getElementById("countdown-minutes");
  const secondsEl = document.getElementById("countdown-seconds");

  if (!daysEl || !hoursEl || !minutesEl || !secondsEl) return;

  const update = () => {
    const parts = getCountdownParts(targetIso);

    daysEl.textContent = pad(parts.days);
    hoursEl.textContent = pad(parts.hours);
    minutesEl.textContent = pad(parts.minutes);
    secondsEl.textContent = pad(parts.seconds);

    if (parts.isPast) {
      clearLiveCountdown();
      if (typeof onComplete === "function") {
        onComplete();
      }
    }
  };

  update();
  countdownTimer = window.setInterval(update, 1000);
}

/* ------------------------------------------------------------
   Render: Event Not Found State
   ------------------------------------------------------------ */
function renderNotFound(invalidId) {
  clearLiveCountdown();

  const contentEl = document.getElementById("event-content");
  const notFoundEl = document.getElementById("event-not-found");
  const invalidIdDisplay = document.getElementById("invalid-event-id");

  if (contentEl) contentEl.hidden = true;
  if (notFoundEl) notFoundEl.hidden = false;

  if (invalidIdDisplay) {
    invalidIdDisplay.textContent = invalidId ? `"${invalidId}"` : "(none provided)";
  }

  document.title = "Event Not Found · Campus Event & Activity Hub";
}

/* ------------------------------------------------------------
   Render: Event Details
   ------------------------------------------------------------ */
function renderEventDetails(event) {
  const contentEl = document.getElementById("event-content");
  const notFoundEl = document.getElementById("event-not-found");

  if (notFoundEl) notFoundEl.hidden = true;
  if (contentEl) contentEl.hidden = false;

  // Set document title
  document.title = `${event.title} · Campus Event & Activity Hub`;

  // Determine state
  const state = getEventState(event);

  // Category & Status badges
  const categoryBadge = document.getElementById("event-category-badge");
  if (categoryBadge) {
    categoryBadge.textContent = CATEGORY_LABEL[event.category] ?? event.category;
  }

  const statusBadge = document.getElementById("event-status-badge");
  if (statusBadge) {
    statusBadge.className = `badge ${state.badgeClass}`;
    statusBadge.textContent = state.label;
  }

  // Title & Organizer
  const titleEl = document.getElementById("event-title");
  if (titleEl) titleEl.textContent = event.title;

  const organizerEl = document.getElementById("event-organizer-name");
  if (organizerEl) organizerEl.textContent = event.organizer;

  // Media Cover Image
  const imgEl = document.getElementById("event-image");
  if (imgEl) {
    imgEl.src = event.image || "../images/placeholder-event.svg";
    imgEl.alt = event.title;
    imgEl.onerror = () => {
      imgEl.src = "../images/placeholder-event.svg";
    };
  }

  // State Banner & Countdown Section
  const countdownSection = document.getElementById("countdown-section");
  const liveBanner = document.getElementById("event-live-banner");
  const completedBanner = document.getElementById("event-completed-banner");

  if (countdownSection) countdownSection.hidden = true;
  if (liveBanner) liveBanner.hidden = true;
  if (completedBanner) completedBanner.hidden = true;

  if (state.status === "upcoming") {
    if (countdownSection) countdownSection.hidden = false;
    initCountdown(event.startDateTime, () => {
      // Transition from upcoming to happening now
      renderEventDetails(event);
    });
  } else if (state.status === "live") {
    if (liveBanner) {
      liveBanner.hidden = false;
      const liveTimes = document.getElementById("live-banner-times");
      if (liveTimes) {
        liveTimes.textContent = `Started at ${formatTime(event.startDateTime)} and runs until ${formatTime(new Date(state.endMs))}.`;
      }
    }
  } else {
    // completed
    if (completedBanner) {
      completedBanner.hidden = false;
      const completedDate = document.getElementById("completed-banner-date");
      if (completedDate) {
        completedDate.textContent = `This event ended on ${formatDateLabel(event.startDateTime)}.`;
      }
    }
  }

  // Description
  const descEl = document.getElementById("event-description");
  if (descEl) descEl.textContent = event.description;

  // Tags
  const tagsContainer = document.getElementById("event-tags-container");
  const tagsList = document.getElementById("event-tags-list");
  if (tagsContainer && tagsList) {
    tagsList.replaceChildren();
    if (Array.isArray(event.tags) && event.tags.length > 0) {
      tagsContainer.hidden = false;
      event.tags.forEach((tag) => {
        const chip = document.createElement("span");
        chip.className = "event-tag-chip";
        chip.textContent = `#${tag}`;
        tagsList.appendChild(chip);
      });
    } else {
      tagsContainer.hidden = true;
    }
  }

  // Registration Info
  const regCapacity = document.getElementById("reg-capacity-val");
  if (regCapacity) regCapacity.textContent = `${event.capacity} seats`;

  // Sidebar Metadata
  const dateVal = document.getElementById("meta-date-val");
  if (dateVal) dateVal.textContent = formatDateLabel(event.startDateTime);

  const timeVal = document.getElementById("meta-time-val");
  if (timeVal) {
    const duration = event.durationMinutes || 60;
    const endIso = new Date(new Date(event.startDateTime).getTime() + duration * 60000);
    timeVal.textContent = `${formatTime(event.startDateTime)} – ${formatTime(endIso)}`;
  }

  const durationVal = document.getElementById("meta-duration-val");
  if (durationVal) {
    durationVal.textContent = `Duration: ${formatDuration(event.durationMinutes || 60)}`;
  }

  const locationVal = document.getElementById("meta-location-val");
  if (locationVal) locationVal.textContent = event.location;

  const organizerVal = document.getElementById("meta-organizer-val");
  if (organizerVal) organizerVal.textContent = event.organizer;

  const capacityVal = document.getElementById("meta-capacity-val");
  if (capacityVal) capacityVal.textContent = `${event.capacity} attendees max`;

  const categoryVal = document.getElementById("meta-category-val");
  if (categoryVal) {
    categoryVal.textContent = CATEGORY_LABEL[event.category] ?? event.category;
  }

  // Save / Bookmark Buttons
  const saveButtons = document.querySelectorAll(".btn-save-event");
  const updateSaveButtons = () => {
    const saved = isEventSaved(event.id);
    saveButtons.forEach((btn) => {
      btn.setAttribute("aria-pressed", String(saved));
      const textSpan = btn.querySelector(".save-btn-text");
      if (textSpan) {
        textSpan.textContent = saved ? "Saved in bookmarks" : "Save event";
      }
    });
  };

  updateSaveButtons();

  saveButtons.forEach((btn) => {
    // Avoid attaching multiple duplicate listeners
    if (!btn.dataset.bound) {
      btn.dataset.bound = "true";
      btn.addEventListener("click", () => {
        const currentlySaved = isEventSaved(event.id);
        if (currentlySaved) {
          unsaveEvent(event.id);
          showToast("Event removed from saved events.");
        } else {
          saveEvent(event.id);
          showToast("Event saved to your bookmarks!");
        }
        updateSaveButtons();
      });
    }
  });

  // Share button
  const shareBtn = document.getElementById("btn-share-event");
  if (shareBtn && !shareBtn.dataset.bound) {
    shareBtn.dataset.bound = "true";
    shareBtn.addEventListener("click", async () => {
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(window.location.href);
          showToast("Link copied to clipboard!");
        } else {
          showToast("URL: " + window.location.href);
        }
      } catch {
        showToast("Link: " + window.location.href);
      }
    });
  }
}

/* ------------------------------------------------------------
   Page Boot
   ------------------------------------------------------------ */
function boot() {
  initNav();
  renderAuthNav();

  // Read event id from URL query parameter (?id=...)
  const params = new URLSearchParams(window.location.search);
  let eventId = params.get("id");

  // Fallback: support hash routing if someone accesses #/event/:id or #intro-to-ux-design
  if (!eventId && window.location.hash) {
    const cleaned = window.location.hash.replace(/^#\/?(event\/)?/, "").split("?")[0];
    if (cleaned) eventId = cleaned;
  }

  if (!eventId) {
    renderNotFound(null);
    return;
  }

  eventId = eventId.trim();
  const matchedEvent = EVENTS.find((item) => item.id === eventId);

  if (!matchedEvent) {
    renderNotFound(eventId);
    return;
  }

  renderEventDetails(matchedEvent);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}
