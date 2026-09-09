/* ============================================================
   login.js — login page controller (html/login.html)
   ------------------------------------------------------------
   - Bounces already-signed-in users to the dashboard
   - Inline validation per field
   - Auth-level errors in a form banner
   - Success banner when arriving from ?registered=1
   - Redirects to app.html after a successful sign-in
   ============================================================ */

import {
  isLoggedIn,
  login,
  validateLogin,
  normalizeEmail,
} from "./auth.js";

const Icons = {
  error: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>',
  success: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>',
};

function showMessage(kind, text) {
  const box = document.getElementById("login-message");
  if (!box) return;
  box.className = `form-message form-message--${kind}`;
  box.innerHTML = `${kind === "success" ? Icons.success : Icons.error}<span>${text}</span>`;
  box.hidden = false;
  box.setAttribute("aria-live", "assertive");
}

function clearMessage() {
  const box = document.getElementById("login-message");
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

function setBusy(busy) {
  const button = document.getElementById("login-submit");
  if (!button) return;
  button.disabled = busy;
  button.textContent = busy ? "Signing in…" : "Sign in";
}

function init() {
  // Already signed in? Go straight to the app.
  if (isLoggedIn()) {
    window.location.replace("app.html");
    return;
  }

  const form = document.getElementById("login-form");
  if (!form) return;

  const fields = ["email", "password"];
  const inputs = {
    email: document.getElementById("login-email"),
    password: document.getElementById("login-password"),
  };

  // Show the "account created" success banner when redirected from register.
  const params = new URLSearchParams(window.location.search);
  if (params.get("registered")) {
    showMessage("success", "Your account was created. Log in to get started.");
    inputs.email.focus();
  }

  // Clear a field's error the moment the user starts fixing it.
  fields.forEach((field) => {
    inputs[field]?.addEventListener("input", () => clearFieldError(field));
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAllErrors(fields);

    const { errors, valid } = validateLogin({
      email: inputs.email.value,
      password: inputs.password.value,
    });

    if (!valid) {
      showMessage("error", "Please fix the highlighted fields and try again.");
      fields.forEach((field) => {
        if (errors[field]) showFieldError(`login-${field}`, errors[field]);
      });
      return;
    }

    setBusy(true);
    const result = await login(normalizeEmail(inputs.email.value), inputs.password.value);
    setBusy(false);

    if (!result.ok) {
      showMessage("error", result.error);
      return;
    }

    showMessage("success", `Welcome back, ${result.user.firstName}! Taking you to your dashboard…`);
    window.setTimeout(() => {
      window.location.replace("app.html");
    }, 900);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}