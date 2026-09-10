import {
  isLoggedIn,
  getCurrentUser,
  login,
  validateLogin,
  normalizeEmail,
  seedAdminAccount,
} from "./auth.js";
import { initPasswordToggles } from "./password-toggle.js";

function showMessage(type, message) {
  const element = document.getElementById("login-message");

  if (!element) return;

  element.textContent = message;
  element.className = `form-message ${type}`;
  element.hidden = false;
}

function clearMessage() {
  const element = document.getElementById("login-message");

  if (!element) return;

  element.textContent = "";
  element.hidden = true;
}

function setFieldError(name, message) {
  const input = document.getElementById(`login-${name}`);
  const error = document.getElementById(`login-${name}-error`);

  if (input) {
    input.classList.toggle("input-error", Boolean(message));
    input.setAttribute("aria-invalid", message ? "true" : "false");
  }

  if (error) {
    error.textContent = message || "";
    error.hidden = !message;
  }
}

function clearFieldErrors() {
  setFieldError("email", "");
  setFieldError("password", "");
}

function setBusy(busy) {
  const button = document.getElementById("login-submit");
  if (!button) return;
  button.disabled = busy;
  button.textContent = busy ? "Signing in…" : "Sign in";
}

async function init() {
  initPasswordToggles();
  /*
   * Seed the default admin account only when needed.
   * Errors here must not prevent the login form from loading.
   */
  try {
    await seedAdminAccount();
  } catch (error) {
    console.warn("Admin seed skipped:", error);
  }

  /*
   * If a valid session already exists, send the user
   * directly to the correct dashboard.
   */
  if (isLoggedIn()) {
    const user = getCurrentUser();

    if (user && user.role === "admin") {
      window.location.replace("admin-dashboard.html#/admin-dashboard");
    } else if (user) {
      window.location.replace("app.html");
    }

    return;
  }

  const form = document.getElementById("login-form");
  if (!form) return;

  const emailInput = form.elements.email;
  const passwordInput = form.elements.password;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    clearMessage();
    clearFieldErrors();

    const email = normalizeEmail(emailInput?.value || "");
    const password = passwordInput?.value || "";

    const validation = validateLogin({
      email,
      password,
    });

    if (!validation.valid) {
      setFieldError("email", validation.errors.email);
      setFieldError("password", validation.errors.password);

      if (validation.errors.email && emailInput) {
        emailInput.focus();
      } else if (validation.errors.password && passwordInput) {
        passwordInput.focus();
      }

      return;
    }

    setBusy(true);

    try {
      const result = await login(email, password);

      if (!result.ok) {
        showMessage("error", result.error);
        setBusy(false);

        if (result.error.toLowerCase().includes("email")) {
          emailInput?.focus();
        } else {
          passwordInput?.focus();
        }

        return;
      }

      /*
       * login() has already persisted ceh:current-user.
       * Redirect immediately without a timeout to avoid flickering.
       */
      showMessage("success", `Welcome back, ${result.user.firstName}!`);

      if (result.user.role === "admin") {
        window.location.replace("admin-dashboard.html#/admin-dashboard");
      } else {
        window.location.replace("app.html");
      }
    } catch (error) {
      console.error("Login error:", error);

      showMessage(
        "error",
        "Something went wrong while signing in. Please try again."
      );

      setBusy(false);
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}