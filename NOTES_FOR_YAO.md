# Notes for Yao (from Omar)

Heads up on recruiter-side work that landed on `main`. **None of your files were changed.** Everything lives in `web/src/features/profile/` and only reads your existing routes.

## What's new

1. **`ProspectBoard`**: a restyled talent pipeline (matches the sign-up / portfolio look).
   - Status stages (new / reviewing / contacted / passed) double as counts and filters.
   - Track, region and level filters. Polls every 5s, with a toast and row flash when a new prospect lands.
   - Rows open the player's portfolio at `/u/:handle`.
   - Reads `GET /api/scouting/prospects`.
2. **Recruiter lens on `/u/:handle`** (recruiter/admin only):
   - Shows the prospect score, AI scout report, voice briefing and a clickable status stepper.
   - Uses `GET/PATCH /api/scouting/prospects/:id` and `POST /api/voice/briefing/:id`.
   - Falls back to the browser's voice if ElevenLabs fails, same as your `ProspectDetail`.
3. **`ClipReview`**: the video player gets a timeline of your coaching `notes` (the `t`, `severity`, `category`, `note` and `fix` fields from §7.3).
   - Click a moment or press J/K to jump with a 2s lead-in; it auto-pauses 4s after.
   - "Play key moments" plays only the flagged windows.
   - Shown to recruiters, and to players on their own profile.

## The one decision we need from you

`/recruiter` in `web/src/App.tsx` (shared) still points to your `RecruiterDashboard`. To use the new board instead:

```tsx
import { ProspectBoard } from './features/profile';
// ...
else if (path === '/recruiter') page = <ProspectBoard />;
```

Or keep both, e.g. yours at `/recruiter/classic`. Your call; just tell the team so only one person edits `App.tsx`.

## Things I relied on from your side (please don't rename)

- `profileScoutProgress` adapter → `scout.report.id`, which the lens uses to load the report.
- `scout_reports.evidence.score` / `evidence.rule_label`, and `coaching_reports.notes[].t` in `"mm:ss"` format.
- Seeded clip URLs `http://localhost:3001/demo-clips/<name>.mp4`. If the file isn't there, the player shows a "video not on this machine" frame and the moments still work. For a real demo, drop the mp4s into `server/demo-clips/`.

## How to see it

```bash
npm run dev
```

1. Demo login → **FaZe Recruiter**.
2. Open `/u/kairo` (lens + clip review).
3. The new board only shows at `/recruiter` once `App.tsx` is switched.

Delete this file once you've read it.
