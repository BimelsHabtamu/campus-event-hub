import { EVENTS, CATEGORY_LABEL } from "./data.js";
import { formatDateLabel, formatTime, formatDuration } from "./utils.js";
import { getCountdownParts, pad } from "./countdown.js";
import {
  saveEvent,
  unsaveEvent,
  getUserRegistration,
  registerForEvent,
  cancelEventRegistration,
  getEventCapacityStats,
} from "./store.js";
import { initNav } from "./site-nav.js";
import { getCurrentUser, logout } from "./auth.js";

let countdownInterval = null;
let liveEndTimeout = null;
let currentActiveEvent = null;

/* ------------------------------------------------------------
   Helpers
------------------------------------------------------------ */

function $(selector) {
  return document.querySelector(selector);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message, type = "info") {
  let toast = $("#site-toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "site-toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.dataset.type = type;
  toast.classList.add("is-visible");

  window.clearTimeout(toast._timer);

  toast._timer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 3200);
}

function getEventState(event) {
  const startMs = new Date(event.startDateTime).getTime();

  if (!Number.isFinite(startMs)) {
    return "upcoming";
  }

  const durationMinutes = Number(event.durationMinutes) || 60;
  const endMs = startMs + durationMinutes * 60 * 1000;
  const now = Date.now();

  if (now >= endMs) {
    return "completed";
  }

  if (now >= startMs && now < endMs) {
    return "live";
  }

  return "upcoming";
}

function getStateLabel(state) {
  const labels = {
    upcoming: "Upcoming",
    live: "Live Now",
    completed: "Completed",
  };

  return labels[state] || "Upcoming";
}

function clearTimers() {
  if (countdownInterval) {
    window.clearInterval(countdownInterval);
    countdownInterval = null;
  }

  if (liveEndTimeout) {
    window.clearTimeout(liveEndTimeout);
    liveEndTimeout = null;
  }
}

/* ------------------------------------------------------------
   Navigation
------------------------------------------------------------ */

function renderAuthNav() {
  const container = $("#nav-auth");

  if (!container) {
    return;
  }

  const user = getCurrentUser();

  if (!user) {
    container.innerHTML = `
      <a class="btn btn-ghost btn-sm" href="login.html">Log in</a>
      <a class="btn btn-primary btn-sm" href="register.html">Create account</a>
    `;
    return;
  }

  const displayName = user.name || user.fullName || user.email || "User";
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  container.innerHTML = `
    <div class="nav-user">
      <button
        class="nav-user-trigger"
        type="button"
        aria-expanded="false"
        aria-label="Open user menu"
      >
        <span class="avatar avatar-sm">${escapeHtml(initials || "U")}</span>
        <span class="nav-user-name">${escapeHtml(displayName)}</span>
        <span aria-hidden="true">⌄</span>
      </button>

      <div class="nav-user-menu" hidden>
        <a href="${user.role === 'admin' ? 'admin-dashboard.html' : 'app.html#/dashboard'}">${user.role === 'admin' ? 'Admin Dashboard' : 'Dashboard'}</a>
        ${user.role !== 'admin' ? '<a href="app.html#/saved">Saved Events</a>' : ''}
        <a href="profile.html">Profile</a>
        <a href="settings.html">Settings</a>
        <button type="button" data-action="logout">Log out</button>
      </div>
    </div>
  `;

  const trigger = container.querySelector(".nav-user-trigger");
  const menu = container.querySelector(".nav-user-menu");
  const logoutButton = container.querySelector('[data-action="logout"]');

  trigger?.addEventListener("click", () => {
    const isOpen = trigger.getAttribute("aria-expanded") === "true";

    trigger.setAttribute("aria-expanded", String(!isOpen));
    menu.hidden = isOpen;
  });

  logoutButton?.addEventListener("click", () => {
    logout();
    window.location.reload();
  });
}

/* ------------------------------------------------------------
   Countdown
------------------------------------------------------------ */

function updateCountdown(targetDate) {
  const daysEl = $("#countdown-days");
  const hoursEl = $("#countdown-hours");
  const minutesEl = $("#countdown-minutes");
  const secondsEl = $("#countdown-seconds");

  if (!daysEl || !hoursEl || !minutesEl || !secondsEl) {
    return;
  }

  const parts = getCountdownParts(targetDate);

  daysEl.textContent = pad(parts.days);
  hoursEl.textContent = pad(parts.hours);
  minutesEl.textContent = pad(parts.minutes);
  secondsEl.textContent = pad(parts.seconds);
}

function startCountdown(event) {
  clearTimers();

  const startMs = new Date(event.startDateTime).getTime();

  if (!Number.isFinite(startMs)) {
    return;
  }

  const state = getEventState(event);

  if (state !== "upcoming") {
    return;
  }

  updateCountdown(event.startDateTime);

  countdownInterval = window.setInterval(() => {
    const currentState = getEventState(event);

    if (currentState !== "upcoming") {
      clearTimers();
      renderEventDetails(event);
      return;
    }

    updateCountdown(event.startDateTime);
  }, 1000);
}

function startLiveTimer(event) {
  clearTimers();

  const startMs = new Date(event.startDateTime).getTime();
  const durationMinutes = Number(event.durationMinutes) || 60;
  const endMs = startMs + durationMinutes * 60 * 1000;

  if (!Number.isFinite(endMs)) {
    return;
  }

  const remaining = Math.max(0, endMs - Date.now());

  liveEndTimeout = window.setTimeout(() => {
    renderEventDetails(event);
  }, remaining + 100);
}

/* ------------------------------------------------------------
   Event Details
------------------------------------------------------------ */

function renderNotFound() {
  const container = $("#event-details-content");

  if (container) {
    container.innerHTML = `
      <section class="event-not-found">
        <div class="event-not-found-icon" aria-hidden="true">📅</div>
        <h1>Event not found</h1>
        <p>
          We couldn't find the event you're looking for.
          It may have been removed or the link may be incorrect.
        </p>
        <a class="btn btn-primary" href="events.html">
          Browse events
        </a>
      </section>
    `;
  }

  const registration = $("#event-registration");

  if (registration) {
    registration.hidden = true;
  }
}

function renderEventDetails(event) {
  currentActiveEvent = event;

  const state = getEventState(event);

  clearTimers();

  document.title = `${event.title || "Event"} | Campus Event Hub`;

  const titleEl = $("#event-title");
  const organizerEl = $("#event-organizer, #event-organizer-name");
  const categoryEl = $("#event-category, #event-category-badge");
  const statusEl = $("#event-status, #event-status-badge");
  const imageEl = $("#event-image");
  const descriptionEl = $("#event-description");
  const tagsEl = $("#event-tags");

  if (titleEl) {
    titleEl.textContent = event.title || "Untitled Event";
  }

  if (organizerEl) {
    organizerEl.textContent = event.organizer || "Campus Event Hub";
  }

  if (categoryEl) {
    categoryEl.textContent =
      CATEGORY_LABEL?.[event.category] ||
      event.category ||
      "General";
  }

  if (statusEl) {
    statusEl.textContent = getStateLabel(state);
    statusEl.dataset.state = state;
  }

  if (imageEl) {
    imageEl.src =
      event.image ||
      "../images/events/placeholder-event.svg";

    imageEl.alt = event.title || "Event image";

    imageEl.onerror = () => {
      imageEl.src = "../images/events/placeholder-event.svg";
    };
  }

  if (descriptionEl) {
    descriptionEl.innerHTML =
      event.description ||
      event.about ||
      "No description is available for this event.";
  }

  if (tagsEl) {
    const tags = Array.isArray(event.tags) ? event.tags : [];

    tagsEl.innerHTML = tags.length
      ? tags
          .map(
            (tag) =>
              `<span class="chip">${escapeHtml(tag)}</span>`,
          )
          .join("")
      : "";
  }

  renderEventState(event, state);
  renderEventMeta(event);
  renderSaveButton(event);
  renderRegistrationSection(event);
  setupShareButton(event);
  setupBackButton();
  setupSaveButton(event);

  if (state === "upcoming") {
    startCountdown(event);
  } else if (state === "live") {
    startLiveTimer(event);
  }
}

function renderEventState(event, state) {
  const countdownSection = $("#event-countdown");
  const liveBanner = $("#event-live-banner");
  const completedBanner = $("#event-completed-banner");

  if (countdownSection) {
    countdownSection.hidden = state !== "upcoming";
  }

  if (liveBanner) {
    liveBanner.hidden = state !== "live";
  }

  if (completedBanner) {
    completedBanner.hidden = state !== "completed";
  }

  if (state === "upcoming") {
    updateCountdown(event.startDateTime);
  }
}

function renderEventMeta(event) {
  const dateEls = [
    $("#event-date"),
    $("#sidebar-event-date"),
    $("#meta-date-val"),
  ];

  dateEls.forEach((element) => {
    if (element) {
      element.textContent = formatDateLabel(event.startDateTime);
    }
  });

  const timeEls = [
    $("#event-time"),
    $("#sidebar-event-time"),
    $("#meta-time-val"),
  ];

  timeEls.forEach((element) => {
    if (element) {
      element.textContent = formatTime(event.startDateTime);
    }
  });

  const durationEl = $("#event-duration");
  const metaDurationEl = $("#meta-duration-val");

  if (durationEl) {
    durationEl.textContent = formatDuration(
      Number(event.durationMinutes) || 60,
    );
  }
  if (metaDurationEl) {
    metaDurationEl.textContent = formatDuration(
      Number(event.durationMinutes) || 60,
    );
  }

  const locationEls = [
    $("#event-location"),
    $("#sidebar-event-location"),
    $("#meta-location-val"),
  ];

  locationEls.forEach((element) => {
    if (element) {
      element.textContent =
        event.location ||
        event.venue ||
        "Campus";
    }
  });

  const organizerEls = [
    $("#event-organizer"),
    $("#sidebar-event-organizer"),
    $("#meta-organizer-val"),
  ];

  organizerEls.forEach((element) => {
    if (element) {
      element.textContent =
        event.organizer ||
        "Campus Event Hub";
    }
  });

  const categoryEls = [
    $("#event-category"),
    $("#sidebar-event-category"),
    $("#meta-category-val"),
  ];

  categoryEls.forEach((element) => {
    if (element) {
      element.textContent =
        CATEGORY_LABEL?.[event.category] ||
        event.category ||
        "General";
    }
  });

  const capacityStats = getEventCapacityStats(event);

  const capacityEls = [
    $("#event-capacity"),
    $("#sidebar-event-capacity"),
    $("#meta-capacity-val"),
  ];

  capacityEls.forEach((element) => {
    if (element) {
      element.textContent =
        capacityStats.total > 0
          ? `${capacityStats.available} seats available`
          : "Open registration";
    }
  });
}

/* ------------------------------------------------------------
   Save / Share
------------------------------------------------------------ */

function renderSaveButton(event) {
  const buttons = document.querySelectorAll(
    '[data-action="save-event"]',
  );

  const { isEventSaved } = window.__CEH_STORE__ || {};

  buttons.forEach((button) => {
    let saved = false;

    if (typeof isEventSaved === "function") {
      saved = isEventSaved(event.id);
    } else {
      const savedIds = JSON.parse(
        localStorage.getItem("ceh:saved") || "[]",
      );

      saved = Array.isArray(savedIds) &&
        savedIds.includes(event.id);
    }

    button.classList.toggle("is-saved", saved);
    button.setAttribute("aria-pressed", String(saved));

    const label = button.querySelector("[data-save-label]");

    if (label) {
      label.textContent = saved ? "Saved" : "Save";
    }

    button.title = saved ? "Remove from saved events" : "Save event";
  });
}

function setupSaveButton(event) {
  const buttons = document.querySelectorAll(
    '[data-action="save-event"]',
  );

  buttons.forEach((button) => {
    button.onclick = () => {
      const saved = button.classList.contains("is-saved");

      if (saved) {
        unsaveEvent(event.id);
        showToast("Event removed from saved events.", "info");
      } else {
        saveEvent(event.id);
        showToast("Event saved successfully.", "success");
      }

      renderSaveButton(event);
    };
  });
}

function setupShareButton(event) {
  const button = $("#share-event");

  if (!button) {
    return;
  }

  button.onclick = async () => {
    const shareData = {
      title: event.title || "Campus Event",
      text: `Check out ${event.title || "this event"} on Campus Event Hub.`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(window.location.href);
      showToast("Event link copied to clipboard.", "success");
    } catch (error) {
      if (error?.name !== "AbortError") {
        showToast("Unable to share this event.", "error");
      }
    }
  };
}

function setupBackButton() {
  const button = $("#event-back");

  if (!button) {
    return;
  }

  button.onclick = (event) => {
    if (window.history.length > 1) {
      event.preventDefault();
      window.history.back();
    }
  };
}

/* ------------------------------------------------------------
   Registration
------------------------------------------------------------ */

function renderRegistrationSection(event) {
  const formContainer = $("#reg-form-container");
  const form = $("#event-reg-form");
  const authGate = $("#reg-auth-gate");
  const confirmedCard = $("#reg-confirmed-card");
  const fullBanner = $("#reg-full-banner");
  const completedBanner = $("#reg-completed-banner");
  const alertBox = $("#reg-alert-box");

  const capacityEl = $("#reg-capacity-val");
  const availableEl = $("#reg-available-val");
  const availableStat = $("#reg-available-stat");

  const user = getCurrentUser();
  const state = getEventState(event);
  const stats = getEventCapacityStats(event);

  const registration = user
    ? getUserRegistration(event.id, user.email)
    : null;

  /* Reset all states */
  [
    formContainer,
    authGate,
    confirmedCard,
    fullBanner,
    completedBanner,
  ].forEach((element) => {
    if (element) {
      element.hidden = true;
    }
  });

  if (alertBox) {
    alertBox.hidden = true;
    alertBox.textContent = "";
  }

  /* Capacity information */
  if (capacityEl) {
    capacityEl.textContent =
      stats.total > 0 ? String(stats.total) : "∞";
  }

  if (availableEl) {
    availableEl.textContent =
      stats.total > 0 ? String(stats.available) : "Open";
  }

  if (availableStat) {
    availableStat.classList.toggle(
      "is-low",
      stats.total > 0 &&
        stats.available > 0 &&
        stats.available <= Math.max(5, Math.ceil(stats.total * 0.1)),
    );

    availableStat.classList.toggle(
      "is-full",
      stats.total > 0 && stats.available === 0,
    );
  }

  /* Event has already ended */
  if (state === "completed") {
    if (completedBanner) {
      completedBanner.hidden = false;
    }

    return;
  }

  /* User is not logged in */
  if (!user) {
    if (authGate) {
      authGate.hidden = false;

      const loginLink = authGate.querySelector(
        '[data-action="registration-login"]',
      );

      if (loginLink) {
        const redirect =
          `${window.location.pathname}${window.location.search}${window.location.hash}`;

        loginLink.href =
          `login.html?redirect=${encodeURIComponent(redirect)}`;
      }
    }

    return;
  }

  /* User already registered */
  if (registration) {
    if (confirmedCard) {
      confirmedCard.hidden = false;

      const registeredAt = confirmedCard.querySelector(
        "[data-registration-date]",
      );

      if (registeredAt) {
        registeredAt.textContent = registration.registeredAt
          ? new Date(registration.registeredAt).toLocaleString()
          : "Just now";
      }

      const nameEl = confirmedCard.querySelector(
        "[data-registration-name]",
      );

      if (nameEl) {
        nameEl.textContent =
          registration.userName ||
          user.name ||
          user.fullName ||
          "Attendee";
      }

      const emailEl = confirmedCard.querySelector(
        "[data-registration-email]",
      );

      if (emailEl) {
        emailEl.textContent =
          registration.userEmail ||
          user.email ||
          "";
      }

      const studentIdEl = confirmedCard.querySelector(
        "[data-registration-studentid]",
      );

      if (studentIdEl) {
        studentIdEl.textContent =
          registration.studentId || "Not provided";
      }

      const cancelButton = confirmedCard.querySelector(
        '[data-action="cancel-registration"], #btn-cancel-reg',
      );

      if (cancelButton) {
        cancelButton.onclick = () => {
          const confirmed = window.confirm(
            "Are you sure you want to cancel your registration?",
          );

          if (!confirmed) {
            return;
          }

          const result = cancelEventRegistration(
            event.id,
            user.email,
          );

          if (!result.ok) {
            showRegistrationAlert(
              result.error || "Unable to cancel registration.",
              "error",
            );
            return;
          }

          showToast(
            "Your registration has been cancelled.",
            "success",
          );

          renderRegistrationSection(event);
        };
      }
    }

    return;
  }

  /* Event is full */
  if (stats.isFull && stats.total > 0) {
    if (fullBanner) {
      fullBanner.hidden = false;
    }

    return;
  }

  /* Show registration form */
  if (formContainer) {
    formContainer.hidden = false;
  }

  const nameInput = $("#reg-name");
  const emailInput = $("#reg-email");
  const studentIdInput = $("#reg-studentid");
  const notesInput = $("#reg-notes");

  if (nameInput) {
    nameInput.value =
      user.name ||
      user.fullName ||
      "";
  }

  if (emailInput) {
    emailInput.value = user.email || "";
    emailInput.readOnly = true;
    emailInput.setAttribute("aria-readonly", "true");
  }

  if (!form) {
    return;
  }

  form.onsubmit = (submitEvent) => {
    submitEvent.preventDefault();

    clearRegistrationErrors();

    const latestUser = getCurrentUser();

    if (!latestUser) {
      showRegistrationAlert(
        "Your session has expired. Please log in again.",
        "error",
      );
      return;
    }

    const name = nameInput?.value.trim() || "";
    const studentId = studentIdInput?.value.trim() || "";
    const notes = notesInput?.value.trim() || "";
    const email = String(latestUser.email || "")
      .trim()
      .toLowerCase();

    let valid = true;

    if (name.length < 2) {
      setFieldError(
        "reg-name",
        "Please enter your full name.",
      );
      valid = false;
    }

    if (!email || !isValidEmail(email)) {
      setFieldError(
        "reg-email",
        "A valid account email is required.",
      );
      valid = false;
    }

    if (studentId && studentId.length < 3) {
      setFieldError(
        "reg-studentid",
        "Please enter a valid student ID.",
      );
      valid = false;
    }

    if (!valid) {
      showRegistrationAlert(
        "Please correct the highlighted fields.",
        "error",
      );
      return;
    }

    /* Re-check event state immediately before registration */
    const latestState = getEventState(event);

    if (latestState === "completed") {
      showRegistrationAlert(
        "This event has already ended.",
        "error",
      );
      renderRegistrationSection(event);
      return;
    }

    /* Re-check capacity immediately before registration */
    const latestStats = getEventCapacityStats(event);

    if (latestStats.isFull && latestStats.total > 0) {
      showRegistrationAlert(
        "Sorry, this event is now full.",
        "error",
      );
      renderRegistrationSection(event);
      return;
    }

    /* Prevent duplicate registration */
    const existingRegistration = getUserRegistration(
      event.id,
      email,
    );

    if (existingRegistration) {
      showRegistrationAlert(
        "You are already registered for this event.",
        "error",
      );
      renderRegistrationSection(event);
      return;
    }

    const submitButton = form.querySelector(
      'button[type="submit"]',
    );

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.dataset.originalText =
        submitButton.textContent;
      submitButton.textContent = "Registering...";
    }

    const result = registerForEvent({
      eventId: event.id,
      userId: latestUser.id || latestUser.userId || "",
      userEmail: email,
      userName: name,
      studentId,
      notes,
    });

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent =
        submitButton.dataset.originalText ||
        "Register";
    }

    if (!result.ok) {
      showRegistrationAlert(
        result.error || "Registration failed. Please try again.",
        "error",
      );
      return;
    }

    showToast(
      "You're registered! See you at the event.",
      "success",
    );

    renderRegistrationSection(event);
  };
}

/* ------------------------------------------------------------
   Registration Validation
------------------------------------------------------------ */

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setFieldError(inputId, message) {
  const input = $(`#${inputId}`);
  const error = $(`#${inputId}-error`);

  if (input) {
    input.classList.add("is-invalid");
    input.setAttribute("aria-invalid", "true");
  }

  if (error) {
    error.textContent = message;
    error.hidden = false;
  }
}

function clearRegistrationErrors() {
  document
    .querySelectorAll(".event-reg-field .is-invalid")
    .forEach((input) => {
      input.classList.remove("is-invalid");
      input.removeAttribute("aria-invalid");
    });

  document
    .querySelectorAll(
      "#reg-name-error, #reg-email-error, #reg-studentid-error, #reg-notes-error",
    )
    .forEach((error) => {
      error.textContent = "";
      error.hidden = true;
    });

  const alertBox = $("#reg-alert-box");

  if (alertBox) {
    alertBox.hidden = true;
    alertBox.textContent = "";
  }
}

function showRegistrationAlert(message, type = "error") {
  const alertBox = $("#reg-alert-box");

  if (!alertBox) {
    showToast(message, type);
    return;
  }

  alertBox.textContent = message;
  alertBox.dataset.type = type;
  alertBox.hidden = false;
}

/* ------------------------------------------------------------
   Boot
------------------------------------------------------------ */

function getEventIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const queryId = params.get("id");

  if (queryId) {
    return queryId;
  }

  const hash = window.location.hash.replace(/^#/, "");

  if (hash.startsWith("id=")) {
    return new URLSearchParams(hash).get("id");
  }

  if (hash) {
    return hash;
  }

  return null;
}

function boot() {
  initNav();
  renderAuthNav();

  const eventId = getEventIdFromUrl();

  if (!eventId) {
    renderNotFound();
    return;
  }

  const sourceEvent = EVENTS.find(
    (event) => String(event.id) === String(eventId),
  );

  if (!sourceEvent) {
    renderNotFound();
    return;
  }

  /*
   * Clone the event so optional test query parameters
   * do not mutate the original mock data.
   */
  const event = {
    ...sourceEvent,
  };

  const params = new URLSearchParams(window.location.search);

  /* Optional countdown testing:
     event-details.html?id=event-1&seconds=30
  */
  const testSeconds = Number(params.get("seconds"));

  if (Number.isFinite(testSeconds) && testSeconds >= 0) {
    event.startDateTime = new Date(
      Date.now() + testSeconds * 1000,
    ).toISOString();
  }

  /* Optional capacity testing:
     event-details.html?id=event-1&capacity=2
  */
  const testCapacity = Number(params.get("capacity"));

  if (Number.isFinite(testCapacity) && testCapacity >= 0) {
    event.capacity = testCapacity;
  }

  renderEventDetails(event);
}

/* ------------------------------------------------------------
   Page Events
------------------------------------------------------------ */

document.addEventListener("DOMContentLoaded", boot);

window.addEventListener("hashchange", () => {
  boot();
});

window.addEventListener("popstate", () => {
  boot();
});

window.addEventListener("beforeunload", clearTimers);