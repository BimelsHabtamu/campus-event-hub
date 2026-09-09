/* ============================================================
   Mock event dataset
   ------------------------------------------------------------
   Dates are generated relative to "today" so the demo always
   holds upcoming + past events. Pure static local data, no backend.
   ============================================================ */

const CATEGORIES = [
  { id: "workshop", label: "Workshop" },
  { id: "hackathon", label: "Hackathon" },
  { id: "career", label: "Career" },
  { id: "seminar", label: "Seminar" },
  { id: "sports", label: "Sports" },
  { id: "competition", label: "Competition" },
  { id: "cultural", label: "Cultural" },
];

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));

/* Helper: day offset from today at a given hour:minute (local time). */
function makeDate(dayOffset, hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/* [dayOffset, hour, minute] helpers for readability. */
const TODAY = () => makeDate(0, 18, 30);

const EVENTS = [
  {
    id: "intro-to-ux-design",
    title: "Intro to UX Design",
    category: "workshop",
    description:
      "A hands-on workshop covering user research, wireframing, and usability testing for students new to product design.",
    startDateTime: makeDate(2, 14, 0),
    durationMinutes: 120,
    location: "Design Studio, Building C, Room 204",
    capacity: 30,
    organizer: "Design Club",
    tags: ["design", "beginner", "hands-on"],
    image: "../images/placeholder-event.svg",
  },
  {
    id: "react-bootcamp-weekend",
    title: "React Bootcamp Weekend",
    category: "workshop",
    description:
      "Two-day crash course from components and hooks to state management, ending with a mini project build.",
    startDateTime: makeDate(5, 10, 0),
    durationMinutes: 480,
    location: "Tech Hall, Room 101",
    capacity: 50,
    organizer: "Web Dev Society",
    tags: ["react", "javascript", "beginner"],
    image: "../images/placeholder-event.svg",
  },
  {
    id: "hackathon-24h",
    title: "Campus Hackathon 24h",
    category: "hackathon",
    description:
      "A 24-hour coding marathon. Teams of 2–4 build a prototype around the theme 'Smart Campus'. Food and prizes included.",
    startDateTime: makeDate(8, 17, 0),
    durationMinutes: 1440,
    location: "Innovation Hub, Central Library",
    capacity: 120,
    organizer: "Student Innovation Council",
    tags: ["hackathon", "teams", "prizes"],
    image: "../images/placeholder-event.svg",
  },
  {
    id: "ml-competition",
    title: "Machine Learning Challenge",
    category: "hackathon",
    description:
      "Solve a real-world classification problem using Kaggle-style datasets. Leaderboard updated live.",
    startDateTime: makeDate(12, 9, 0),
    durationMinutes: 300,
    location: "Online (Zoom) + Open Lab",
    capacity: 80,
    organizer: "AI & Data Science Club",
    tags: ["machine-learning", "competition", "python"],
    image: "../images/placeholder-event.svg",
  },
  {
    id: "career-fair-spring",
    title: "Spring Career Fair",
    category: "career",
    description:
      "Meet recruiters from 40+ companies. Bring your resume — on-the-spot internship interviews available.",
    startDateTime: makeDate(15, 9, 30),
    durationMinutes: 420,
    location: "Main Sports Complex",
    capacity: 500,
    organizer: "Career Development Center",
    tags: ["internships", "recruiting", "networking"],
    image: "../images/placeholder-event.svg",
  },
  {
    id: "resume-workshop",
    title: "Resume & LinkedIn Lab",
    category: "career",
    description:
      "One-on-one resume reviews and LinkedIn profile optimization with career coaches.",
    startDateTime: makeDate(3, 16, 0),
    durationMinutes: 90,
    location: "Career Center, Room 12",
    capacity: 20,
    organizer: "Career Development Center",
    tags: ["resume", "linkedin", "coaching"],
    image: "../images/placeholder-event.svg",
  },
  {
    id: "ai-ethics-seminar",
    title: "AI Ethics & Society Seminar",
    category: "seminar",
    description:
      "Guest lecture on bias, fairness, and accountability in artificial intelligence systems.",
    startDateTime: makeDate(6, 18, 0),
    durationMinutes: 90,
    location: "Auditorium B",
    capacity: 200,
    organizer: "Faculty of Computer Science",
    tags: ["ethics", "ai", "lecture"],
    image: "../images/placeholder-event.svg",
  },
  {
    id: "study-abroad-info",
    title: "Study Abroad Info Session",
    category: "seminar",
    description:
      "Everything you need to know about exchange programs, scholarships, and application deadlines.",
    startDateTime: makeDate(10, 12, 0),
    durationMinutes: 60,
    location: "International Office, Hall C",
    capacity: 100,
    organizer: "International Office",
    tags: ["abroad", "scholarships", "info-session"],
    image: "../images/placeholder-event.svg",
  },
  {
    id: "nvz-indoor-soccer",
    title: "Indoor Soccer Tournament",
    category: "sports",
    description:
      "5-a-side indoor tournament. Register as a team or solo and be assigned. Fair-play rules apply.",
    startDateTime: makeDate(4, 19, 0),
    durationMinutes: 180,
    location: "Indoor Arena, Main Sports Complex",
    capacity: 96,
    organizer: "Intramural Sports",
    tags: ["soccer", "5-a-side", "tournament"],
    image: "../images/placeholder-event.svg",
  },
  {
    id: "basketball-3on3",
    title: "3-on-3 Basketball Cup",
    category: "sports",
    description:
      "Fast-paced 3-on-3 basketball bracket. Prizes for winners and a free pizza night after.",
    startDateTime: makeDate(9, 17, 0),
    durationMinutes: 240,
    location: "Outdoor Courts",
    capacity: 48,
    organizer: "Intramural Sports",
    tags: ["basketball", "3x3", "prizes"],
    image: "../images/placeholder-event.svg",
  },
  {
    id: "yoga-morning",
    title: "Sunrise Yoga on the Lawn",
    category: "sports",
    description:
      "Beginner-friendly yoga session led by campus wellness instructors. Mats provided.",
    startDateTime: makeDate(1, 7, 0),
    durationMinutes: 60,
    location: "Central Lawn",
    capacity: 40,
    organizer: "Student Wellness",
    tags: ["yoga", "wellness", "beginner"],
    image: "../images/placeholder-event.svg",
  },
  {
    id: "debate-championship",
    title: "Inter-University Debate Championship",
    category: "competition",
    description:
      "Four university teams compete in elimination rounds. Audience scoring for the final round.",
    startDateTime: makeDate(7, 15, 0),
    durationMinutes: 300,
    location: "Main Auditorium",
    capacity: 300,
    organizer: "Debate Society",
    tags: ["debate", "competition", "eliminations"],
    image: "../images/placeholder-event.svg",
  },
  {
    id: "startup-pitch",
    title: "Student Startup Pitch Night",
    category: "competition",
    description:
      "Pitch your startup idea in 3 minutes to a jury of alumni entrepreneurs. $2 event goal is seed funding exposure.",
    startDateTime: makeDate(11, 18, 0),
    durationMinutes: 150,
    location: "Innovation Hub",
    capacity: 80,
    organizer: "Entrepreneurship Society",
    tags: ["startup", "pitch", "entrepreneurship"],
    image: "../images/placeholder-event.svg",
  },
  {
    id: "chess-open",
    title: "Chess Open Championship",
    category: "competition",
    description:
      "Swiss-system chess tournament, all skill levels welcome. Boards and clocks provided.",
    startDateTime: makeDate(13, 10, 0),
    durationMinutes: 360,
    location: "Student Union Hall",
    capacity: 64,
    organizer: "Chess Club",
    tags: ["chess", "swiss-system", "strategy"],
    image: "../images/placeholder-event.svg",
  },
  {
    id: "international-food-festival",
    title: "International Food Festival",
    category: "cultural",
    description:
      "Taste dishes from 15+ countries prepared by student associations. Proceeds fund student scholarships.",
    startDateTime: makeDate(14, 11, 0),
    durationMinutes: 360,
    location: "Campus Quad",
    capacity: 800,
    organizer: "International Student Association",
    tags: ["food", "culture", "fundraiser"],
    image: "../images/placeholder-event.svg",
  },
  {
    id: "film-night",
    title: "Open-Air Film Night",
    category: "cultural",
    description:
      "Classic cinema on the big screen under the stars. Blankets and popcorn provided.",
    startDateTime: makeDate(1, 20, 30),
    durationMinutes: 150,
    location: "Old Quad",
    capacity: 250,
    organizer: "Campus Entertainment Board",
    tags: ["film", "outdoor", "casual"],
    image: "../images/placeholder-event.svg",
  },
  {
    id: "open-mic-night",
    title: "Open Mic Night: Poetry & Music",
    category: "cultural",
    description:
      "Share your poetry, spoken word, or an acoustic set. Sign-ups at the door from 6:30 PM.",
    startDateTime: makeDate(16, 19, 30),
    durationMinutes: 150,
    location: "Student Union Lounge",
    capacity: 90,
    organizer: "Arts Collective",
    tags: ["poetry", "music", "open-mic"],
    image: "../images/placeholder-event.svg",
  },
  {
    id: "finance-101-seminar",
    title: "Personal Finance 101",
    category: "seminar",
    description:
      "Budgeting, student loans, and investing basics — practical tips you can use immediately.",
    startDateTime: TODAY(),
    durationMinutes: 90,
    location: "Economics Hall, Room 305",
    capacity: 120,
    organizer: "Finance Club",
    tags: ["finance", "budgeting", "investing"],
    image: "../images/placeholder-event.svg",
  },
  {
    id: "past-graduation-gala",
    title: "Graduation Gala 2026 (Recap)",
    category: "cultural",
    description:
      "Photo archive and highlights from this year's gala — a look back before next year's planning begins.",
    startDateTime: makeDate(-14, 20, 0),
    durationMinutes: 120,
    location: "Grand Ballroom",
    capacity: 400,
    organizer: "Student Government",
    tags: ["gala", "recap", "archive"],
    image: "../images/placeholder-event.svg",
  },
];

if (typeof window !== "undefined") {
  window.__MOCK_META__ = { count: EVENTS.length, generatedAt: new Date().toISOString() };
}

export { CATEGORIES, CATEGORY_LABEL, EVENTS };