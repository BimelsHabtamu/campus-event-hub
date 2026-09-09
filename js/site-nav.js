/* ============================================================
   site-nav.js — public navbar mobile toggle
   ============================================================ */

/**
 * Wire the hamburger toggle and close the menu when a link is
 * chosen. Pure UI, no routing — app.js owns route handling.
 * @returns {() => void} cleanup
 */
export function initNav() {
  const header = document.getElementById("site-header");
  const toggle = document.getElementById("nav-toggle");
  if (!header || !toggle) return () => {};

  const setOpen = (isOpen) => {
    header.classList.toggle("nav-open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
  };

  const onToggle = () => setOpen(!header.classList.contains("nav-open"));
  const onNavClick = (event) => {
    if (event.target.closest("a")) setOpen(false);
  };
  const onKeydown = (event) => {
    if (event.key === "Escape") setOpen(false);
  };

  toggle.addEventListener("click", onToggle);
  header.addEventListener("click", onNavClick);
  document.addEventListener("keydown", onKeydown);

  return () => {
    toggle.removeEventListener("click", onToggle);
    header.removeEventListener("click", onNavClick);
    document.removeEventListener("keydown", onKeydown);
  };
}