const EYE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.5"/></svg>';
const EYE_OFF_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 6.2A10.7 10.7 0 0112 6c6 0 9.5 6 9.5 6a17.5 17.5 0 01-3.2 3.7M6.2 6.9C3.9 8.4 2.5 12 2.5 12s3.5 6 9.5 6c1.1 0 2.1-.2 3-.6"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/></svg>';

export function initPasswordToggles() {
  document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    const input = document.getElementById(button.dataset.passwordToggle);
    if (!input || button.dataset.initialized === "true") return;

    button.dataset.initialized = "true";
    button.type = "button";

    const update = () => {
      const visible = input.type === "text";
      button.innerHTML = visible ? EYE_OFF_ICON : EYE_ICON;
      button.setAttribute("aria-label", visible ? "Hide password" : "Show password");
      button.setAttribute("aria-pressed", String(visible));
    };

    button.addEventListener("click", () => {
      input.type = input.type === "password" ? "text" : "password";
      update();
      input.focus();
    });

    update();
  });
}
