# Talal OS — Roadmap

## v0.2 — AI Capture ✅ (current)
Natural language capture. Type messy thoughts; the app organizes them into tasks, ideas, journal entries, and habit notes automatically.

- `/capture` page as the primary entry point
- AI provider abstraction layer (mock, ollama, openrouter, gemini)
- Structured preview before saving
- Tasks, inbox ideas, daily log, and habit completions all saved in one click

---

## v0.3 — Daily Focus
A single-screen morning view showing today's tasks, habits due, and one intention for the day. Replaces the need to navigate across multiple pages for the daily routine.

## v0.4 — PWA Install Support
Add a web app manifest and install prompt so Talal can add the app to his home screen. This removes the friction of opening a browser — the app feels native and is one tap away.

> Note: PWA support will help Talal remember to open the app without relying on browser bookmarks.

## v0.5 — Push Notifications
Browser push notifications for:
- **Morning check-in** — reminder to open the app and set an intention for the day
- **Evening review** — reminder to fill in the daily log
- **Recovery reminders** — gentle nudge on rest days (e.g. "You mentioned being sick — take it easy today")

> Note: Requires v0.4 (PWA) to be in place first.

## v0.6 — Speech-to-Text Capture
Allow Talal to speak instead of type. The spoken text goes through the same AI capture pipeline and gets organized automatically.

> Note: Speech-to-text should let Talal speak messy thoughts — same experience as typing, but hands-free. Useful for capturing ideas on the go.

## v0.7 — Notion Sync
Two-way sync with a Notion database for tasks and projects. Useful for sharing context with others or using Notion as a secondary view.

## v0.8 — AI Weekly Review
At the end of each week, automatically generate a summary of:
- Tasks completed vs planned
- Habits consistency
- Mood and health patterns from the daily log
- One recommendation for next week

---

## Principles for all future versions

- **One recommended action at a time** — Talal gets overwhelmed by too many choices. Every screen should make the right next step obvious.
- **No feature creep** — only build what removes a real pain point. Complexity is the enemy.
- **Offline-first where possible** — the app should work without internet for capture and review.
