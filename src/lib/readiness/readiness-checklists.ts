import type { EventCategory, ReadinessTemplate } from "./readiness-types";

// Detect event category from title + description text
export function detectEventCategory(title: string, description?: string): EventCategory {
  const src = `${title} ${description ?? ""}`.toLowerCase();

  if (/\b(recital|performance|showcase|show)\b/.test(src) && /dance|ballet|hip.?hop|ballroom|salsa/.test(src)) return "dance_performance";
  if (/\bdance (class|lesson|practice|training)\b/.test(src) || /\b(hip.?hop|ballroom|salsa|latin|swing|tango) (class|lesson)\b/.test(src)) return "dance_class";
  if (/\b(interview|job interview)\b/.test(src)) return "interview";
  if (/\b(presentation|pitch|demo day|present to|presenting)\b/.test(src)) return "presentation";
  if (/\b(flight|airport|travel|trip|transit)\b/.test(src)) return "travel";
  if (/\b(doctor|dentist|medical|appointment|clinic|physio|therapy|therapist)\b/.test(src)) return "doctor";
  if (/\b(dinner|lunch|brunch|breakfast|restaurant|eat out)\b/.test(src)) return "dinner";
  if (/\b(date|romantic|first date)\b/.test(src)) return "date";
  if (/\b(gym|workout|training|fitness|run|jog|lift|exercise)\b/.test(src)) return "workout";
  if (/\b(networking|conference|mixer|professional event)\b/.test(src)) return "networking";
  if (/\b(meeting|call|sync|standup|one.on.one|1.on.1|client)\b/.test(src)) return "meeting";
  if (/\b(study|studying|review|coding session|deep work|learning session)\b/.test(src)) return "study";

  return "generic";
}

const TEMPLATES: Record<EventCategory, ReadinessTemplate> = {
  dance_performance: {
    category: "dance_performance",
    keywords: ["recital", "performance", "showcase"],
    checklistItems: ["Shoes packed", "Outfit ready", "Water bottle", "Warm-up", "Stretching", "Music/playlist", "Venue arrival time"],
    highPriority: ["Shoes packed", "Outfit ready", "Warm-up"],
    focusHints: [
      "Relax and enjoy the performance — you have prepared for this.",
      "Trust your body. Your muscle memory knows the steps.",
      "Breathe deeply before you go on stage.",
      "Focus on the feeling, not on perfection.",
    ],
  },
  dance_class: {
    category: "dance_class",
    keywords: ["dance class", "dance lesson"],
    checklistItems: ["Dance shoes", "Water bottle", "Comfortable clothes", "Review last lesson", "Leave on time"],
    highPriority: ["Dance shoes", "Water bottle"],
    focusHints: [
      "Focus on one thing you want to improve today.",
      "Quality over quantity — one technique mastered beats ten rushed.",
      "Be present, not perfect.",
      "Ask a question during class — it accelerates your learning.",
    ],
  },
  interview: {
    category: "interview",
    keywords: ["interview"],
    checklistItems: ["Resume ready", "Company research", "Portfolio/work samples", "STAR examples prepared", "Thoughtful question ready", "Outfit planned", "Arrive early"],
    highPriority: ["Resume ready", "Company research", "STAR examples prepared"],
    focusHints: [
      "Speak slower than feels natural — nerves speed you up.",
      "Pause after important answers to let them land.",
      "Ask thoughtful questions — it shows genuine interest.",
      "You are also interviewing them. It's a two-way conversation.",
    ],
  },
  presentation: {
    category: "presentation",
    keywords: ["presentation", "pitch"],
    checklistItems: ["Slides ready", "Timer/pacing rehearsed", "Opening hook memorized", "Backup plan if tech fails", "Water nearby"],
    highPriority: ["Slides ready", "Opening hook memorized"],
    focusHints: [
      "The opening sets the tone — nail the first 30 seconds.",
      "Pause after key points. Silence is powerful.",
      "Know your audience's biggest concern and address it early.",
      "Speak to one person at a time, not the room.",
    ],
  },
  travel: {
    category: "travel",
    keywords: ["flight", "travel", "trip"],
    checklistItems: ["Passport / ID", "Tickets / boarding pass", "Accommodation confirmed", "Packing done", "Chargers", "Local currency / cards", "Arrive at airport early"],
    highPriority: ["Passport / ID", "Tickets / boarding pass", "Packing done"],
    focusHints: [
      "Check in online the night before to save time.",
      "Screenshot your tickets and hotel confirmation — offline access matters.",
      "Charge everything the night before departure.",
    ],
  },
  doctor: {
    category: "doctor",
    keywords: ["doctor", "dentist", "medical"],
    checklistItems: ["Insurance card", "List of questions to ask", "Medical history notes if needed", "Appointment time confirmed"],
    highPriority: ["Insurance card", "Appointment time confirmed"],
    focusHints: [
      "Write your questions down — you'll forget half of them in the room.",
      "It's okay to ask the doctor to repeat or clarify.",
    ],
  },
  dinner: {
    category: "dinner",
    keywords: ["dinner", "lunch", "restaurant"],
    checklistItems: ["Restaurant confirmed", "Leave time planned", "Review last conversation with them", "Reminder set"],
    highPriority: ["Leave time planned"],
    focusHints: [
      "Put your phone away and be fully present.",
      "Ask open questions — let them do most of the talking.",
      "Remember something they mentioned last time and follow up.",
    ],
  },
  date: {
    category: "date",
    keywords: ["date"],
    checklistItems: ["Plan confirmed", "Leave time planned", "Phone charged", "Be present"],
    highPriority: ["Leave time planned"],
    focusHints: [
      "Be curious, not impressive.",
      "Put the phone away — presence is the most attractive thing.",
      "Smile. Relax. Have fun.",
    ],
  },
  workout: {
    category: "workout",
    keywords: ["gym", "workout"],
    checklistItems: ["Water bottle", "Pre-workout nutrition", "Gym bag packed", "Workout plan decided"],
    highPriority: ["Water bottle"],
    focusHints: [
      "Show up — that's 80% of it.",
      "Focus on form over weight.",
      "Track one metric today to measure progress.",
    ],
  },
  meeting: {
    category: "meeting",
    keywords: ["meeting", "call"],
    checklistItems: ["Agenda reviewed", "Notes prepared", "Join link / location ready", "Key points in mind"],
    highPriority: ["Join link / location ready"],
    focusHints: [
      "Know what outcome you want from this meeting.",
      "Listen more than you speak.",
      "Take notes — follow-ups are forgotten without them.",
    ],
  },
  networking: {
    category: "networking",
    keywords: ["networking", "conference"],
    checklistItems: ["Business cards / LinkedIn QR ready", "Know your elevator pitch", "Goal: meet 3 interesting people", "Follow-up plan after"],
    highPriority: ["Know your elevator pitch"],
    focusHints: [
      "Ask more questions than you answer.",
      "Quality over quantity — one real connection beats ten cards.",
      "Remember to follow up within 24 hours.",
    ],
  },
  study: {
    category: "study",
    keywords: ["study", "deep work"],
    checklistItems: ["Phone on Do Not Disturb", "Water and snacks ready", "Clear goal for the session", "Timer / Pomodoro set"],
    highPriority: ["Clear goal for the session", "Phone on Do Not Disturb"],
    focusHints: [
      "Start with the hardest thing — your energy is highest first.",
      "Pomodoro: 25 minutes work, 5 break. Repeat.",
      "Know what done looks like before you start.",
    ],
  },
  generic: {
    category: "generic",
    keywords: [],
    checklistItems: ["Event time confirmed", "Leave time planned", "Phone charged", "Any materials needed"],
    highPriority: ["Leave time planned"],
    focusHints: [
      "Be present and enjoy the moment.",
      "Prepare what you can; let go of the rest.",
    ],
  },
};

export function getTemplate(category: EventCategory): ReadinessTemplate {
  return TEMPLATES[category];
}

// Returns focus hint by rotating based on current hour (stable for a given day)
export function getFocusTip(template: ReadinessTemplate, seed = 0): string {
  const hints = template.focusHints;
  return hints[seed % hints.length] ?? hints[0] ?? "Be present and enjoy.";
}
