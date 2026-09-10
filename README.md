# 🎓 Campus Event & Activity Hub

> A professional frontend-only campus event management platform that helps
> university students discover, save, register for, and manage campus events,
> while providing administrators with tools to manage events and registrations.

---

## 📌 Project Overview

**Campus Event & Activity Hub** is a responsive web application designed to
improve how university students discover and participate in campus activities.

The platform brings campus events such as:

- 🎤 Seminars
- 💻 Technology events
- 🏆 Competitions
- 🚀 Hackathons
- 💼 Career events
- 🛠️ Workshops
- ⚽ Sports activities
- 🎭 Cultural activities
- 📚 Academic activities

into one organized digital platform.

The project was built as a **frontend-only application** using standard web
technologies, with browser `localStorage` used for authentication, event
registrations, saved events, preferences, and application state.

---

## ✨ Key Features

### 👨‍🎓 Student Features

- Create a student account
- Secure login and logout flow
- Student dashboard
- Discover campus events
- Search events
- Filter events by category and date/status
- Sort events
- View complete event details
- Register for events
- Cancel event registrations
- Save/bookmark events
- View registered events
- View saved events
- Event countdown timer
- Upcoming / Live / Completed event status
- Personal calendar
- Profile management
- Account settings
- In-app notifications
- Responsive mobile navigation

### 🛡️ Admin Features

- Dedicated administrator login
- Role-based access control
- Admin dashboard
- Event management
- Create campus events
- Edit event information
- Delete/manage events
- View event statistics
- View student registrations
- Manage campus event information
- Separate admin interface from student dashboard

---

## 🔐 Authentication & Role Management

The application supports two primary roles:

| Role | Access |
|------|--------|
| Student | Student dashboard and event participation |
| Admin | Event and registration management |

### Student Flow

```text
Create Account
      ↓
Login
      ↓
Student Dashboard
      ↓
Discover Events
      ↓
Register / Save Events
      ↓
Manage My Events
