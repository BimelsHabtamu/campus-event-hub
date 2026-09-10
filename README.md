
<<<<<<< HEAD
=======
A frontend-only web app that helps university students **discover, search, and
register for campus events** — workshops, hackathons, career events, seminars,
sports, competitions, and cultural activities.

Built with **zero frameworks and zero backend**: just HTML5, CSS3, vanilla
JavaScript (ES6+ modules), and `localStorage`.

## Features (roadmap)

- Event listing with cards
- Live search & category/date filtering
- Event detail page with registration form
- Saved (bookmarked) events
- Personal dashboard (registered events, stats)
- Countdown to event start
- Month calendar view
- All persistence via `localStorage`

> Note: UI foundation (Stage 1), authentication (Stage 2), the landing
> page (Stage 3), event discovery (Stage 4), event details + countdown
> (Stage 5), registration (Stage 6), the saved/my-events dashboard views
> (Stage 7), and the dashboard + calendar (Stage 8) are complete.

## Pages

- `html/index.html` — public landing + discovery: professional navbar, hero,
  featured events, category cards, upcoming events, CTA band, footer
- `html/events.html` — browse events: search, category/date filters, sorting,
  and cards linking to `event-details.html?id=...`
- `html/event-details.html` — event details: dynamic load via query param `?id=...`,
  live countdown ticker, status badges (upcoming, live, completed), bookmarking,
  event metadata, and "event not found" recovery state
- `html/app.html` — private dashboard shell (auth-gated): sidebar, topbar, and the live
  Dashboard, My Events, Saved, and Calendar views (`#/dashboard`, `#/my-events`,
  `#/saved`, `#/calendar`)
- `html/login.html` — login with inline validation + LocalStorage sessions
- `html/register.html` — registration with validation, success banner → login

## Technology

| Concern              | Choice                                      |
| -------------------- | ------------------------------------------- |
| Markup               | HTML5 (semantic, accessible landmarks)      |
| Styling              | CSS3 custom properties + flexbox/grid       |
| Logic                | Vanilla JS, ES6+ modules (`type="module"`)  |
| Routing              | Hash-based SPA router (`#/home`, `#/event/:id`, `#/dashboard`) |
| State / persistence  | `localStorage` behind a single `store.js` module |
| Data                 | Static mock dataset in `js/data.js`         |

No build step, no package manager, no frameworks. Serve the folder with any
static file server (ES6 modules are blocked on `file://` in Chrome).

## Folder structure

```
campus-event-hub/
├── html/
│   ├── index.html               # Public site shell (landing, browse view, footer)
│   ├── events.html              # Standalone browse-events page (Stage 5)
│   ├── event-details.html       # Standalone event detail + registration page (Stage 5)
│   ├── app.html                 # Dashboard shell (sidebar + topbar + views)
│   ├── login.html               # Login layout (UI only)
│   └── register.html            # Registration layout (UI only)
├── css/
│   ├── variables.css            # design tokens: color, type, spacing, radii, breakpoints
│   ├── base.css                 # reset + element defaults + typography + utilities
│   ├── components.css           # buttons, cards, badges, forms, avatars, search
│   ├── layout-public.css        # navbar, hero, features, footer (responsive)
│   ├── layout-dashboard.css     # sidebar shell, topbar, sections (responsive)
│   └── auth.css                 # login/register split layout (xl screens)
├── js/
│   ├── app.js                   # public shell entry point (auth-aware nav)
│   ├── dashboard.js             # app.html controller: auth gate, shell, view mounts (Stage 7-8)
│   ├── auth.js                  # register/login/logout, validation, SHA-256 hashing
│   ├── login.js                 # login page controller
│   ├── register.js              # registration page controller
│   ├── events-page.js           # events.html browse controller (search/filter/sort)
│   ├── event-details.js         # event-details.html controller (detail + countdown + register)
│   ├── site-nav.js              # public navbar mobile toggle
│   ├── data.js                  # mock dataset (19 events) + categories
│   ├── store.js                 # localStorage layer (saved, registrations, prefs, users)
│   ├── router.js                # hash router: parseHash, navigate, onRouteChange
│   ├── filters.js               # pure search/filter/sort (+ URL param helpers)
│   ├── event-status.js          # pure event state classification (status/label/badge)
│   ├── lists.js                 # pure saved/registered view-model builders (Stage 7)
│   ├── countdown.js             # countdown math + component (Stage 2)
│   ├── calendar.js              # month-grid math + day grouping (buildMonthGrid/shiftMonth)
│   ├── utils.js                 # date/string/DOM helpers
│   └── views.js                 # public-shell mount registry
├── images/
│   ├── event.png
│   └── placeholder-event.svg
└── README.md
```

## Architecture decision

A **hash-routed shell built on ES6 modules**, split into two entry points:

1. **Public shell** (`app.js` + `views.js`): landing + browse pages, with the
   responsive navbar handled by `site-nav.js`.
2. **Dashboard shell** (`dashboard.js`): the private layout — sidebar routing,
   section switching, and the responsive drawer/collapse behavior.

Rules that keep it maintainable:

- Each route maps to a **mount function** with a stable signature.
- All persistence goes through `store.js` — the only module that touches
  `localStorage`. Keys are namespaced (`ceh:saved`, `ceh:registrations`,
  `ceh:prefs`, `ceh:users`, `ceh:current-user`).
- Passwords are stored as salted SHA-256 hashes (`crypto.subtle`) — no
  plaintext credentials in `localStorage`.
- `data.js` owns the static dataset; **dates are generated relative to today**
  so upcoming/past filtering always has demo data.
- `filters.js`, `countdown.js`, and `calendar.js` are pure modules — views
  consume them without side effects.
- Imports are one-way: `views → data/filters/countdown/calendar`,
  `views → store`, `entry points → router + views`.

## Setup

```
# Serve the folder with any static file server (needed for ES modules):
npx serve .
python -m http.server        # or: php -S localhost:8000
```

## Status

### Stage 1 — Professional UI foundation ✅

- [x] Global design tokens (color, type, spacing, radii, shadows, breakpoints)
- [x] Reusable components (buttons, cards, forms, badges, avatars, switches)
- [x] Responsive public navbar + footer (off-canvas mobile menu, hamburger)
- [x] Dashboard layout with left sidebar (drawer < 1024px, icon collapse ≥ 1024px)
- [x] Sidebar: Dashboard · My Events · Saved Events · Calendar · Profile · Settings · Logout
- [x] Login and register page layouts (split-screen on large screens)
- [x] Responsive across desktop / tablet / mobile
- [x] Semantic HTML, accessible focus states, reduced-motion support

### Stage 2 — Login & register ✅

- [x] Register: inline validation (name, email, password strength, confirm, terms)
- [x] Passwords salted + SHA-256 hashed, stored in `ceh:users`
- [x] Duplicate email rejection (case-insensitive) with field + banner errors
- [x] Login: inline validation, distinct "no account" vs "incorrect password" errors
- [x] Current session persisted to `ceh:current-user`
- [x] Logout clears the session and returns to the public site
- [x] `app.html` / dashboard gated behind auth; login/register bounce signed-in users
- [x] Public navbar swaps CTA for a "Dashboard" button when signed in
- [x] Success banner after registration → auto-redirect to login
- [x] Register → login → logout flow verified (Node test: 25/25 assertions)

### Stage 3 — Professional home/landing page ✅

- [x] Navbar: brand + Home · Events · Saved · Dashboard, with Log in/Get started
      buttons that swap to an avatar user-menu (Dashboard, Saved, Log out) when signed in
- [x] Hero: "Discover What's Happening on Campus" + supporting text, Explore Events
      and Upcoming Events CTAs, stats row, decorative event preview card
- [x] Featured events section (curated mock events)
- [x] Category cards with per-category accent colors + live event counts
- [x] Upcoming events section (next 6, sorted by start time, rendered from mock data)
- [x] Gradient call-to-action band (Create account / Explore events)
- [x] Professional footer with newsletter feedback
- [x] Fully responsive (mobile/tablet/desktop), non-blocking newsletter form
- [x] Subtle professional motion: hero entrance, card hover lift, scroll-reveal
      (IntersectionObserver, respects `prefers-reduced-motion`, JS-gated)

### Stage 4 — Event discovery ✅

- [x] Live search across title, description, organizer, location, category, and tags
      (multi-token, debounced, no page reloads)
- [x] Category filter (seeded from the dataset) and date/status filter
      (All · Upcoming · Today · This week · Past)
- [x] Sorting: nearest date (default) · latest date · A–Z, case-insensitive
- [x] All 19 events rendered as rich cards: cover image, category badge, date ·
      time, location, "View details" link, Save toggle (`ceh:saved`)
- [x] Live result count ("N of 19 events found") + professional empty state
      with context-aware copy when filters conflict or searches miss
- [x] Search/filter/sort state lives in the URL (`#/events?q=&cat=&range=&sort=`)
      — back/forward and refresh preserve the view
- [x] `filters.js` implements the pure matching/sorting engine (`applyFilter`,
      `sortEvents`, `filterToParams`/`filterFromParams`) — no DOM, shareable by
      future dashboard/calendar views
- [x] Card cover images with hover zoom, badge overlaid on the cover, actions
      pinned to the card bottom; landing-page cards unchanged
- [x] Responsive auto-fill grid; full keyboard/screen-reader labels on controls
- [x] Verified: all JS `node --check`, HTML↔JS hooks, filter/sort tests
      (22/22 assertions), Stage 2 (25/25) and Stage 3 (12/12) still pass

### Stage 5 — Event Details + Countdown ✅

- [x] `html/event-details.html` fully functional standalone detail page
- [x] `html/events.html` browse events page connecting "View Details" to `event-details.html?id=${id}`
- [x] Dynamic URL query parameter parsing (`?id=...` with hash fallback)
- [x] Dynamic event loading from existing dataset (`data.js`)
- [x] Comprehensive event metadata presentation:
      - Event cover image with fallback placeholder handling
      - Title, Category badge, Organizer information
      - Description & tag chips
      - Formatted date & start/end time duration
      - Location & capacity breakdown
      - Registration & access details (admission info, Stage 6 note)
- [x] Live ticking countdown timer for upcoming events (Days, Hours, Minutes, Seconds)
- [x] Three distinct event state handlings:
      - **Upcoming**: live countdown ticker + "Upcoming" badge
      - **Happening Now**: live pulse dot banner + active hours notice
      - **Completed**: past event notice banner + completed badge
- [x] Save/Bookmark event toggle persisted to `localStorage` via `store.js`
- [x] Professional "Event Not Found" state with recovery actions
- [x] Fully responsive mobile, tablet, and desktop layouts
- [x] Zero external frameworks or libraries — pure HTML5, CSS3, ES6+ modules

### Stage 6 — Event Registration ✅

- [x] Interactive registration form on `event-details.html`
- [x] Auth-gated: requires login before registration with return redirect
- [x] Pre-fills user profile information (name, email)
- [x] Field validation (name length, university email format, student ID)
- [x] LocalStorage persistence under `ceh:registrations` via `store.js`
- [x] Duplicate registration prevention for the same event
- [x] User registration status card with confirmation details
- [x] One-click registration cancellation with seat release
- [x] Dynamic capacity tracking (Total capacity vs. remaining available seats)
- [x] Sold-out / capacity-reached state handling
- [x] Responsive layout conforming to the design tokens system

### Stage 7 — Saved Events + My Events ✅

- [x] Functional **Saved Events** view (`app.html#/saved`): bookmarked events listed
      nearest-date-first with cover image, live status badge, date · time, and location
- [x] Functional **My Events** view (`app.html#/my-events`): everything the signed-in user
      registered for, joined to their registration record and shown earliest-first
- [x] Auth-gated via the existing shell guard — guests are redirected to `login.html`
- [x] Profile-scoped data via `store.js`: new `getUserRegistrations(email)` (email normalized),
      existing `getSavedEventIds` / `saveEvent` / `unsaveEvent` / `cancelEventRegistration`
- [x] Live per-view counts: `N saved events` / `N registered events` (updated after every action)
- [x] Summary stat cards on the dashboard reflect registered + saved totals, kept in sync
- [x] Card actions: **View Details**, **Remove from Saved**, **Cancel Registration** (with confirm)
- [x] Registration status badge ("Registered · since …") on My Events cards; full status badge
      (Upcoming / Live Now / Completed) on every card
- [x] Professional empty states with icon + CTA back to `events.html`
- [x] Pure, reusable logic extracted: `js/event-status.js` (status/label/badge classification)
      and `js/lists.js` (`getSavedEvents`, `getRegisteredEvents` view models)
- [x] Fixed latent bug: `events-page.js` now imports `getEventStateVisuals` from
      `event-status.js` instead of a non-existent export in `event-details.js`
- [x] Fully responsive (reuses the auto-fill `.events-grid` + dashboard shell)
- [x] Data-layer + hook tests pass; existing auth (25), filters (22), login/register hooks stay green

### Stage 8 — Dashboard + Calendar ✅

- [x] **Dashboard home** (`app.html#/dashboard`) fully functional for the logged-in user
- [x] Four live summary cards — **Registered**, **Saved**, **Upcoming**, **Completed** — all
      recalculated from the same LocalStorage registrations/saved lists on every mount
- [x] Upcoming registered-events list (compact date-box rows with live status badges),
      empty state with "Browse events" CTA, and a live `N upcoming` count badge
- [x] Quick actions: **Browse Events**, **Saved Events**, **My Events**
- [x] **Calendar** (`app.html#/calendar`) fully functional: registered events shown on their
      exact dates via `js/calendar.js` (`buildMonthGrid`, `groupEventsByDay`)
- [x] Click any day cell to view that day's events in a companion panel
- [x] Previous/next month navigation (wraps across years via `shiftMonth`)
- [x] Today highlighted (`is-today`) and event dates marked (`has-event`) + legend
- [x] Selected day persisted in LocalStorage (`ceh:calendarPrefs`) so the view survives reloads
- [x] Professional day-empty + month dashboard-empty states
- [x] Single source of truth in `store.js` keeps dashboard and calendar synchronized
      (register/save/cancel anywhere → both views reflect it immediately on render)
- [x] Auth-gated via the existing shell guard; existing sidebar + responsive layouts reused
- [x] Data-layer (10) + hook/wiring checks pass; auth (25), stage 7 (11), login/register hooks stay green

### Roadmap

- [ ] Profile & Settings views — remaining shell routes untouched by Stages 7–8
>>>>>>> f35d9c0 (second commit)
