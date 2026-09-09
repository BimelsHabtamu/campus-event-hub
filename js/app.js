import { parseHash, onRouteChange } from "./router.js";
import { resolvePage, getMountForPage, showOnlyView, setActiveNav } from "./views.js";
import { initNav } from "./site-nav.js";
import { getCurrentUser, logout } from "./auth.js";

const MENU_ICONS = {
  dashboard: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  saved: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.5h12V20l-6-4-6 4z"/></svg>',
  logout: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>',
  chevron: '<svg class="icon user-menu-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
};

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
  trigger.className = "user-menu-trigger";
  trigger.type = "button";
  trigger.setAttribute("aria-haspopup", "true");
  trigger.setAttribute("aria-expanded", "false");

  const avatar = document.createElement("span");
  avatar.className = "avatar avatar-sm";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = `${(user.firstName || "?")[0]}${(user.lastName || "?")[0]}`.toUpperCase();

  const name = document.createElement("span");
  name.className = "user-menu-name";
  name.textContent = user.firstName;

  const chevron = document.createElement("span");
  chevron.innerHTML = MENU_ICONS.chevron;

  trigger.append(avatar, name, chevron);

  const panel = document.createElement("div");
  panel.className = "user-menu-panel";
  panel.setAttribute("role", "menu");
  panel.hidden = true;

  const addItem = (iconMarkup, label, href = null, isDanger = false) => {
    const item = href ? document.createElement("a") : document.createElement("button");
    item.className = `user-menu-item${isDanger ? " user-menu-item-danger" : ""}`;
    item.setAttribute("role", "menuitem");
    if (href) {
      item.href = href;
    } else {
      item.type = "button";
    }
    const ic = document.createElement("span");
    ic.innerHTML = iconMarkup;
    item.appendChild(ic);
    item.appendChild(document.createTextNode(label));
    return item;
  };

  panel.appendChild(addItem(MENU_ICONS.dashboard, "Dashboard", "app.html#/dashboard"));
  panel.appendChild(addItem(MENU_ICONS.saved, "Saved events", "app.html#/saved"));

  const logoutItem = addItem(MENU_ICONS.logout, "Log out", null, true);
  logoutItem.addEventListener("click", () => {
    setOpen(false);
    logout();
    renderAuthNav();
  });
  panel.appendChild(logoutItem);

  menu.append(trigger, panel);

  const setOpen = (open) => {
    panel.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
    menu.classList.toggle("is-open", open);
  };

  const onTrigger = () => setOpen(panel.hidden);
  const onOutside = (event) => {
    if (!menu.contains(event.target) && !panel.hidden) setOpen(false);
  };
  const onKeydown = (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      setOpen(false);
      trigger.focus();
    }
  };

  trigger.addEventListener("click", onTrigger);
  document.addEventListener("click", onOutside);
  document.addEventListener("keydown", onKeydown);

  detachUserMenu = () => {
    trigger.removeEventListener("click", onTrigger);
    document.removeEventListener("click", onOutside);
    document.removeEventListener("keydown", onKeydown);
  };

  actions.appendChild(menu);
}

/** Smooth-scroll the hero CTA to the upcoming-events section. */
function initScrollTargets() {
  document.querySelectorAll("[data-scroll-to]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = document.getElementById(link.dataset.scrollTo);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

/** Non-blocking newsletter feedback in the dark footer. */
function initNewsletter() {
  const form = document.getElementById("newsletter-form");
  const note = document.getElementById("newsletter-note");
  if (!form || !note) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = form.querySelector('input[type="email"]');
    if (!email || !email.value.trim()) return;
    note.hidden = false;
    form.reset();
    window.setTimeout(() => {
      note.hidden = true;
    }, 6000);
  });
}

/** Fade-in landing sections/cards as they enter the viewport. */
function initReveal() {
  document.documentElement.classList.add("js");
  const nodes = document.querySelectorAll("[data-reveal]");
  if (nodes.length === 0) return;

  // Remove the reveal hook once the animation settles so component
  // transitions (e.g. .card-hover lift) take over cleanly.
  const revealDone = (node) => {
    node.classList.add("is-visible");
    window.setTimeout(() => node.removeAttribute("data-reveal"), 900);
  };

  if (!("IntersectionObserver" in window)) {
    nodes.forEach(revealDone);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          revealDone(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -48px 0px", threshold: 0.1 },
  );

  nodes.forEach((node) => observer.observe(node));
}

function boot() {
  const cleanupNav = initNav();
  renderAuthNav();

  const render = (route) => {
    const page = resolvePage(route.page);
    const mount = getMountForPage(page);
    showOnlyView(page);
    setActiveNav(page);
    mount(route);
  };

  render(parseHash(window.location.hash));
  initScrollTargets();
  initNewsletter();
  initReveal();

  const unsubscribe = onRouteChange(render);
  const cleanup = () => {
    cleanupNav();
    unsubscribe();
    if (typeof detachUserMenu === "function") detachUserMenu();
  };

  window.__ceh = { cleanup, unsubscribe };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}