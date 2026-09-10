export function getEventState(event, now = Date.now()) {
  const startMs = new Date(event.startDateTime).getTime();
  if (!Number.isFinite(startMs)) return "upcoming";

  const durationMinutes = Number(event.durationMinutes) || 60;
  const endMs = startMs + durationMinutes * 60 * 1000;

  if (now >= endMs) return "completed";
  if (now >= startMs && now < endMs) return "live";
  return "upcoming";
}

const STATE_LABELS = {
  upcoming: "Upcoming",
  live: "Live Now",
  completed: "Completed",
};

const STATE_BADGE_CLASSES = {
  upcoming: "badge-upcoming",
  live: "badge-live",
  completed: "badge-completed",
};

export function getEventStateVisuals(event, now) {
  const state = getEventState(event, now);
  return {
    state,
    label: STATE_LABELS[state],
    badgeClass: STATE_BADGE_CLASSES[state],
  };
}