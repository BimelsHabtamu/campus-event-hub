/* ============================================================
   register.js — registration page controller (html/register.html)
   ------------------------------------------------------------
   - Bounces already-signed-in users to the dashboard
   - Inline validation per field (incl. terms checkbox)
   - Duplicate-email error from auth.js shown on the field
   - Success banner + redirect to login.html?registered=1
   ============================================================ */

import {
  isLoggedIn,
  createUserAccount,
  validateRegistration,
  normalizeEmail,
} from "./auth.js";

const Icons = {
  error: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>',
  success: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>',
};

function showMessage(kind, text) {
  const box = document.getElementById("reg-message");
  if (!box) return;
  box.className = `form-message form-message--${kind}`;
  box.innerHTML = `${kind === "success" ? Icons.success : Icons.error}<span>${text}</span>`;
  box.hidden = false;
  box.setAttribute("aria-live", "assertive");
}

function clearMessage() {
  const box = document.getElementById("reg-message");
  if (box) box.hidden = true;
}

function showFieldError(id, message) {
  const input = document.getElementById(id);
  const error = document.getElementById(`${id}-error`);
  input?.classList.add("is-invalid");
  if (error) {
    error.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg><span>${message}</span>`;
    error.hidden = false;
  }
}

function clearFieldError(id) {
  document.getElementById(id)?.classList.remove("is-invalid");
  const error = document.getElementById(`${id}-error`);
  if (error) error.hidden = true;
}

function clearAllErrors(fields) {
  fields.forEach((field) => clearFieldError(field));
  clearMessage();
}

function setBusy(busy, text) {
  const button = document.getElementById("reg-submit");
  if (!button) return;
  button.disabled = busy;
  button.textContent = text ?? "Create account";
}

function init() {
  // Already signed in? Nothing to register for.
  if (isLoggedIn()) {
    window.location.replace("app.html");
    return;
  }

  const form = document.getElementById("register-form");
  if (!form) return;

  const fields = ["firstName", "lastName", "email", "password", "confirm", "terms"];
  const inputs = {
    firstName: document.getElementById("reg-first"),
    lastName: document.getElementById("reg-last"),
    email: document.getElementById("reg-email"),
    password: document.getElementById("reg-password"),
    confirm: document.getElementById("reg-confirm"),
    terms: document.getElementById("reg-terms"),
  };

  // Clear a field's error the moment the user starts fixing it.
  fields.forEach((field) => {
    const target = field === "terms" ? inputs.terms : inputs[field];
    const eventName = field === "terms" ? "change" : "input";
    target?.addEventListener(eventName, () => clearFieldError(field));
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAllErrors(fields);

    const profile = {
      firstName: inputs.firstName.value,
      lastName: inputs.lastName.value,
      email: normalizeEmail(inputs.email.value),
      password: inputs.password.value,
      confirm: inputs.confirm.value,
      terms: inputs.terms.checked,
    };

    const { errors, valid } = validateRegistration(profile);
    if (!valid) {
      showMessage("error", "Please fix the highlighted fields and try again.");
      fields.forEach((field) => {
        if (errors[field]) showFieldError(`reg-${field}`, errors[field]);
      });
      return;
    }

    setBusy(true, "Creating account…");
    const result = await createUserAccount(profile);
    setBusy(false);

    if (!result.ok) {
      if (result.error.email) {
        showFieldError("reg-email", result.error.email);
        showMessage("error", "That email address is already in use.");
      } else {
        showMessage("error", "Something went wrong. Please try again.");
      }
      return;
    }

    showMessage("success", "Your account was created. Redirecting to log in…");
    window.setTimeout(() => {
      window.location.replace("login.html?registered=1");
    }, 1400);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}