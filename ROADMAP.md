# Talal OS — Roadmap

## v0.2 — AI Capture ✅

Natural language capture. Type messy thoughts; the app organizes them into tasks, ideas, journal entries, and habit notes automatically.

- `/capture` page as the primary entry point
- AI provider abstraction layer (mock, ollama, openrouter, gemini)
- Structured preview before saving
- Tasks, inbox ideas, daily log, and habit completions all saved in one click

## v0.3 — Real AI Integration ✅

Production-quality AI pipeline with Gemini.

- `AIProvider` interface with factory pattern (`AI_PROVIDER` env var)
- Real Gemini integration (`gemini-2.0-flash`) with JSON mode
- Zod validation + repair prompt retry on schema mismatch
- Confidence system (high/medium/low) — low items excluded by default
- Dedicated `prompts.ts` with grounded reflection (no motivational fluff)

## v0.4 — Smart Capture Metadata ✅

Time awareness and priority matrix built into every captured task.

- Time extraction: dueDate, dueTime (morning/evening), timeContext (after_work/tonight)
- Reminder detection: needsReminder flag + reminderAt stored in DB
- Priority matrix: urgency × importance − energy penalty → priorityScore (0–6)
- Today's Top 3 on dashboard: due today OR high urgency/importance, sorted by score

---

## v0.5 — Email Reminders

Send a daily digest email with Today's Top 3 and any habits due.

- Nodemailer or Resend integration
- Cron job (or Vercel cron) at 8 AM local time
- Unsubscribe link in footer
- Uses `needsReminder` and `reminderAt` fields already captured

## v0.6 — PWA Install

Add a web app manifest and service worker so Talal can install the app from the browser.

- `manifest.json` with icon set (192, 512px)
- `next-pwa` or custom service worker
- Install prompt banner on first visit
- Offline fallback page for when there's no connection

## v0.7 — Push Notifications

Browser push for time-sensitive reminders already captured via AI.

- Web Push API + VAPID keys stored in env
- Service worker receives push, shows notification
- Subscribes on install (v0.6 prerequisite)
- Sends notification at `reminderAt` time for tasks with `needsReminder: true`
- Evening review nudge at 9 PM if daily log is empty

## v0.8 — Calendar Sync

Export tasks with due dates to Google Calendar or iCal.

- `/api/calendar/ical` endpoint — returns `.ics` feed Talal can subscribe to
- Google Calendar OAuth flow (optional — subscribe link is simpler)
- Only tasks with `dueDate` are included; `dueTime` mapped to event time

## v0.9 — AI Reprioritization

Once a week (or on demand), re-score all open tasks based on what's changed.

- "Reprioritize" button on the task list
- Sends all open task titles + current scores to AI
- AI returns updated urgency/importance/energy for each
- Diff shown as a preview before applying

## v1.0 — Daily Planning Agent

Morning planning session that picks Today's Top 3 and sets a single intention.

- `/plan` page: shows yesterday's incomplete tasks + today's habits
- AI suggests which 3 tasks to focus on and why
- User confirms or swaps; confirmed tasks pinned as Top 3
- Optional: voice input for the daily intention

---

## Principles for all future versions

- **One recommended action at a time** — every screen should make the right next step obvious.
- **No feature creep** — only build what removes a real pain point. Complexity is the enemy.
- **Offline-first where possible** — capture and review should work without internet.
