import {
  getCurrentUser,
  isLoggedIn,
  logout,
  isAdmin,
  updateUserProfile,
} from "./auth.js";

const Icons = {
  error: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>',
  success: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>',
};

let originalProfileData = {};
let pendingProfileImage = "";

/* ------------------------------------------------------------
   Alert banners
   ------------------------------------------------------------ */

function showMessage(kind, text) {
  const box = document.getElementById("profile-message");
  if (!box) return;
  box.className = `form-message form-message--${kind}`;
  box.innerHTML = `${kind === "success" ? Icons.success : Icons.error}<span>${text}</span>`;
  box.hidden = false;
  box.setAttribute("aria-live", "polite");
}

function clearMessage() {
  const box = document.getElementById("profile-message");
  if (box) box.hidden = true;
}

function showFieldError(id, message) {
  const input = document.getElementById(id);
  const error = document.getElementById(`${id}-error`);
  input?.classList.add("is-invalid");
  if (error) {
    error.innerHTML = `${Icons.error}<span>${message}</span>`;
    error.hidden = false;
  }
}

function clearFieldError(id) {
  document.getElementById(id)?.classList.remove("is-invalid");
  const error = document.getElementById(`${id}-error`);
  if (error) error.hidden = true;
}

function clearAllErrors() {
  ["profile-first", "profile-last"].forEach((id) => clearFieldError(id));
  clearMessage();
}

/* ------------------------------------------------------------
   Data population
   ------------------------------------------------------------ */

function populateProfile(user) {
  if (!user) return;

  pendingProfileImage = user.profileImage || "";

  const initials = `${(user.firstName || "?")[0]}${(user.lastName || "?")[0]}`.toUpperCase();
  const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User";
  const userRole = user.role === "admin" ? "admin" : "student";
  const isUserAdmin = userRole === "admin";
  const roleLabel = isUserAdmin ? "Administrator" : "Student";
  const badgeClass = isUserAdmin ? "badge badge-danger" : "badge badge-brand";

  // Topbar
  const topbarName = document.getElementById("topbar-name");
  const topbarRole = document.getElementById("topbar-role");
  const topbarAvatar = document.getElementById("topbar-avatar");
  const topbarBadge = document.getElementById("topbar-role-badge");

  if (topbarName) topbarName.textContent = fullName;
  if (topbarRole) topbarRole.textContent = isUserAdmin ? "Administrator" : user.email;
  if (topbarAvatar) {
    topbarAvatar.replaceChildren();
    if (user.profileImage) {
      const image = document.createElement("img");
      image.src = user.profileImage;
      image.alt = `${fullName} profile photo`;
      topbarAvatar.appendChild(image);
    } else {
      topbarAvatar.textContent = initials;
    }
  }
  if (topbarBadge) {
    topbarBadge.textContent = roleLabel;
    topbarBadge.className = badgeClass;
  }

  // Profile Card
  const profileAvatar = document.getElementById("profile-avatar");
  const displayName = document.getElementById("profile-display-name");
  const displayEmail = document.getElementById("profile-display-email");
  const roleBadge = document.getElementById("profile-role-badge");
  const displayStudentId = document.getElementById("profile-display-student-id");
  const displayAccountType = document.getElementById("profile-display-account-type");
  const displayMemberSince = document.getElementById("profile-display-member-since");

  if (profileAvatar) {
    profileAvatar.replaceChildren();
    if (user.profileImage) {
      const image = document.createElement("img");
      image.src = user.profileImage;
      image.alt = `${fullName} profile photo`;
      profileAvatar.appendChild(image);
    } else {
      profileAvatar.textContent = initials;
    }
  }
  if (displayName) displayName.textContent = fullName;
  if (displayEmail) displayEmail.textContent = user.email || "—";
  if (roleBadge) {
    roleBadge.textContent = roleLabel;
    roleBadge.className = badgeClass;
  }
  if (displayStudentId) {
    displayStudentId.textContent = user.studentId || (isUserAdmin ? "ADM-001" : "Not registered");
  }
  if (displayAccountType) displayAccountType.textContent = roleLabel;
  if (displayMemberSince) {
    if (user.createdAt) {
      try {
        const date = new Date(user.createdAt);
        displayMemberSince.textContent = date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
      } catch {
        displayMemberSince.textContent = "2026";
      }
    } else {
      displayMemberSince.textContent = "2026";
    }
  }

  // Form Inputs
  setInputValue("profile-first", user.firstName || "");
  setInputValue("profile-last", user.lastName || "");
  setInputValue("profile-email", user.email || "");
  setInputValue("profile-student-id", user.studentId || "");
  setInputValue("profile-role-input", `${roleLabel} (${isUserAdmin ? "All administrative privileges" : "Standard campus member"})`);
  setInputValue("profile-major", user.major || "");
  setInputValue("profile-year", user.year || "");
}

function setInputValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function showPhotoError(message) {
  const error = document.getElementById("profile-photo-error");
  if (!error) return;
  error.textContent = message || "";
  error.hidden = !message;
}

function readProfileImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(new Error("Unable to read image.")));
    reader.readAsDataURL(file);
  });
}

/* ------------------------------------------------------------
   Role-based navigation
   ------------------------------------------------------------ */

function applyRoleNavigation(user) {
  const isUserAdmin = user && user.role === "admin";
  const studentSection = document.getElementById("student-nav-section");
  const adminSection = document.getElementById("admin-nav-section");

  if (isUserAdmin) {
    if (studentSection) studentSection.hidden = true;
    if (adminSection) adminSection.hidden = false;
  } else {
    if (studentSection) studentSection.hidden = false;
    if (adminSection) adminSection.hidden = true;
  }
}

/* ------------------------------------------------------------
   Edit mode controls
   ------------------------------------------------------------ */

function setEditing(editing) {
  const editableIds = ["profile-first", "profile-last", "profile-student-id", "profile-major", "profile-year"];
  editableIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = !editing;
  });

  const actions = document.getElementById("profile-actions");
  const editBtn = document.getElementById("profile-edit-btn");

  if (actions) actions.hidden = !editing;
  if (editBtn) editBtn.disabled = editing;

  if (editing) {
    document.getElementById("profile-first")?.focus();
  }
}

function initProfileForm() {
  const editBtn = document.getElementById("profile-edit-btn");
  const cancelBtn = document.getElementById("profile-cancel-btn");
  const form = document.getElementById("profile-form");
  const photoInput = document.getElementById("profile-photo");

  photoInput?.addEventListener("change", async () => {
    showPhotoError("");
    const file = photoInput.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      photoInput.value = "";
      showPhotoError("Please choose an image file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      photoInput.value = "";
      showPhotoError("Image must be smaller than 2 MB.");
      return;
    }

    try {
      pendingProfileImage = await readProfileImage(file);
      const user = getCurrentUser();
      populateProfile({ ...user, profileImage: pendingProfileImage });
    } catch {
      pendingProfileImage = "";
      photoInput.value = "";
      showPhotoError("Unable to read that image. Please try another file.");
    }
  });

  editBtn?.addEventListener("click", () => {
    const user = getCurrentUser();
    originalProfileData = {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      studentId: user?.studentId || "",
      major: user?.major || "",
      year: user?.year || "",
      profileImage: user?.profileImage || "",
    };
    clearAllErrors();
    setEditing(true);
  });

  cancelBtn?.addEventListener("click", () => {
    // Restore original values
    setInputValue("profile-first", originalProfileData.firstName);
    setInputValue("profile-last", originalProfileData.lastName);
    setInputValue("profile-student-id", originalProfileData.studentId);
    setInputValue("profile-major", originalProfileData.major);
    setInputValue("profile-year", originalProfileData.year);
    pendingProfileImage = originalProfileData.profileImage;
    if (photoInput) photoInput.value = "";
    showPhotoError("");
    clearAllErrors();
    setEditing(false);
  });

  // Clear errors on input
  ["profile-first", "profile-last"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", () => clearFieldError(id));
  });

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    clearAllErrors();

    const firstName = (document.getElementById("profile-first")?.value || "").trim();
    const lastName = (document.getElementById("profile-last")?.value || "").trim();
    const studentId = (document.getElementById("profile-student-id")?.value || "").trim();
    const major = (document.getElementById("profile-major")?.value || "").trim();
    const year = (document.getElementById("profile-year")?.value || "").trim();

    const NAME_RE = /^[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F' -]{2,50}$/;

    let hasError = false;
    if (!firstName) {
      showFieldError("profile-first", "First name is required.");
      hasError = true;
    } else if (!NAME_RE.test(firstName)) {
      showFieldError("profile-first", "Use 2–50 letters for first name.");
      hasError = true;
    }

    if (!lastName) {
      showFieldError("profile-last", "Last name is required.");
      hasError = true;
    } else if (!NAME_RE.test(lastName)) {
      showFieldError("profile-last", "Use 2–50 letters for last name.");
      hasError = true;
    }

    if (hasError) {
      showMessage("error", "Please fix the errors indicated below.");
      return;
    }

    const saveBtn = document.getElementById("profile-save-btn");
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";
    }

    const result = updateUserProfile({
      firstName,
      lastName,
      studentId,
      major,
      year,
      profileImage: pendingProfileImage,
    });

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save changes";
    }

    if (!result.ok) {
      showMessage("error", result.error || "Failed to update profile.");
      return;
    }

    // Success: sync with UI
    showMessage("success", "Profile updated successfully! All changes have been saved to your account.");
    setEditing(false);
    populateProfile(result.user);
    pendingProfileImage = result.user.profileImage || "";
    if (photoInput) photoInput.value = "";
  });
}

/* ------------------------------------------------------------
   Sidebar & Layout interactions
   ------------------------------------------------------------ */

function initSidebar() {
  const shell = document.getElementById("app-shell");
  const toggle = document.getElementById("sidebar-toggle");
  const close = document.getElementById("sidebar-close");
  const overlay = document.getElementById("sidebar-overlay");
  const mediaDesktop = window.matchMedia("(min-width: 64rem)");

  const setDrawerOpen = (open) => {
    shell?.classList.toggle("sidebar-open", open);
    if (overlay) overlay.hidden = !open;
    toggle?.setAttribute("aria-expanded", String(open));
  };

  toggle?.addEventListener("click", () => {
    if (mediaDesktop.matches) {
      shell?.classList.toggle("sidebar-collapsed");
    } else {
      const isOpen = shell?.classList.contains("sidebar-open");
      setDrawerOpen(!isOpen);
    }
  });

  close?.addEventListener("click", () => setDrawerOpen(false));
  overlay?.addEventListener("click", () => setDrawerOpen(false));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && shell?.classList.contains("sidebar-open")) {
      setDrawerOpen(false);
    }
  });
}

function initLogout() {
  const logoutLink = document.getElementById("logout-link");
  logoutLink?.addEventListener("click", (e) => {
    e.preventDefault();
    logout();
    window.location.replace("login.html");
  });
}

/* ------------------------------------------------------------
   Initialization
   ------------------------------------------------------------ */

function init() {
  if (!isLoggedIn()) {
    window.location.replace("login.html");
    return;
  }

  const user = getCurrentUser();
  applyRoleNavigation(user);
  populateProfile(user);
  initProfileForm();
  initSidebar();
  initLogout();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
