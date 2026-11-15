# Overnight hand-off: V3 fan-hub pivot, Phase 1 (from Yao)

While you were asleep, Phase 1 of the pivot landed on `main`. I worked across everyone's folders (team call). This note lists what changed in **your** area and what's left for you. Product details: `REQUIREMENTS.md` (rewritten for V3). Agent rules: `CLAUDE.md`.

**Coaching is gone.** No more Gemini clip analysis, voice coach, AI scout summaries or coaching scores. The old code is at git tag `pre-pivot` if you ever need it. Player metrics (FACEIT stats, trends, scouting thresholds) stay, and they power the Recruiting tab.

## Run it

```bash
git pull
npm install
npm run setup   # migrate + seed (resets demo data on the shared DB)
npm run dev     # web :5173, API :3001
```

**Demo login** is in the user menu, top-right; when signed out it sits next to **Join** in the nav. It now sets a server cookie via `POST /api/auth/login`. In production, `npm run build && npm start` serves the web app and API from one port (Railway, see `railway.json`).

## Routes

| Path | What | Access |
|---|---|---|
| `/` | Home showcase: live banner, counters, feature cards, community + roster strips | public |
| `/join` | Onboarding (moved from `/`) | public |
| `/community` | Community | public, writes need sign-in |
| `/leaderboards` | Leaderboards | public |
| `/u/:handle`, `/me` | Fan profile | public |
| `/hud` `/rgb` `/guessr` `/wall` | Branded "coming soon" pages (Phase 2) | public |
| `/recruiting`, `/recruiting/p/:id`, `/recruiting/rules` | Recruiting tab | recruiter, admin |
| `/admin` | Admin overview (Phase 2 director console goes here) | admin |

## Shared pieces you should build on

- **UI kit:** `web/src/components/ui/` provides `Button`, `Card`, `PageHeader`, `Badge`, `EmptyState`, `Loading` and `Page`. Tokens are in `theme.css`.
- **Features registry:** `web/src/components/features.ts` drives the nav Features menu, the Home cards and the placeholder pages. When a Phase 2 feature ships, set `status: 'live'` and route its path to the real page in `App.tsx`.
- **Live state:** `web/src/components/live/` has `useLive()`, `LiveBanner` and `LiveCounters`. Data comes from `GET /api/live`, a clock-driven mock in `server/src/lib/live/mock.ts`. Phase 2 swaps in the event bus with the same shape.
- **Shared types:** `shared/types.ts` defines `LiveEvent`, `LiveStatus`, `LiveCounters` and `Role`.
- **Phase 2 tables (empty):**
  - `live_events` (hypertable)
  - `pixel_events` (hypertable)
  - `guessr_puzzles`
  - `guessr_guesses`
- **Fetch helper:** `web/src/components/api.ts` exports `api<T>()`. **Guards:** `RequireRole` in the UI, `requireRole` on the server.

## Joe

- I drafted the new **AppNav** (Home · Community · Leaderboards · Features menu + user menu), the **UI kit** and the **Home page** (`web/src/features/home/`). All three are yours to restyle; keep the class names and props stable if you can.
- Onboarding moved to `/join`. I only changed copy: no more "AI coach" or "scouts". It now says Guessr, The Wall, and lights/HUD reacting to FaZe live.
- The Home roster strip uses your `/games/cs2/roster/*.webp` images.
- Phase 2 for you: Home polish + HUD overlay visuals.

## Dahiya

- **Pulse no longer calls Gemini.** The pluggable `pulseGenerate` curator is kept, so your tests still inject one. The provider label is now `curated` (was `gemini`). All 7 community tests pass.
- The clip card link "View clip & coaching" now goes to the clip owner's profile.
- I added **`server/src/db/seed-fanhub.ts`**: 11 backdated threads, 23 nested comments and 91 votes across all five boards. Hot/new/top and Pulse now have real data.
  - **Why it was needed:** the seed recreates the demo users, and threads cascade-delete with their authors, so every reseed used to leave only fresh, empty starters.
  - **Your files:** your seed and starters are untouched.
- Phase 2 for you: **The Wall** (`pixel_events` is ready; see REQUIREMENTS §5.2).

## Omar

- **The profile is fan-first now:**
  - New: editable bio (`PATCH /api/profiles/:handle`, owner only), joined date, an **Activity** panel (recent threads/comments + karma) and **Fan badges** slots (Guessr streak, pixels placed, synced setup). The new pieces are in `FanSections.tsx`.
  - Game stats only show when there's real FACEIT data. FACEIT linking is an optional sidebar card.
- **Scout data is staff-only, enforced by the server:** `scout` comes back `unavailable` and `dossier` is `null` unless the viewer is a recruiter or admin.
- **Server changes in `profiles.ts`:**
  - Owner checks use the session (`auth.identify`), not a raw `x-user-id` header.
  - New `activity` field in the response.
  - Removed: coaching SQL, the AI skill profile and the `clip-score` leaderboard.
  - The share card shows WIN % instead of AI score.
- **Deleted:** `ClipReview`, because it rendered coaching notes. I also removed the voice briefing from `RecruiterLens`.
- **`FaceitLink`:** a mock sync (`source: "mock"`) now counts as a success instead of showing "Couldn't reach FACEIT".
- **Fixed:** in the welcome checklist, the text was squeezed into the number column.
- **`ProspectBoard`:**
  - It is now the main `/recruiting` page.
  - New optional `hrefFor` prop: Recruiting opens the prospect detail, and the default still opens the profile lens.
  - The AI column is now WIN%.
- Phase 2 for you: **FaZe Guessr** (`guessr_puzzles` / `guessr_guesses` are ready).

## Yao (me), still to do

- **S6, connect real APIs:**
  - FACEIT (live mode, mock fallback kept).
  - PandaScore match schedule for the live banner.
  - YouTube/Twitch.
  - Steam.
- Deploy to Railway.
- **Phase 2:** event bus (socket.io + `live_events`), director console at `/admin`, local companion app.

## Demo notes

- Recruiting moment: Vyper is just under the bar (18 of the 20 recent matches the rule needs).
  1. Log in as **Vyper**, open **My profile**, and hit **↻ Sync stats** in the FACEIT card. That "plays a few matches" and crosses the bar.
  2. Switch to **FaZe Recruiter**. Vyper shows up as a new prospect on `/recruiting` (the board polls every 5s).
  3. Run `npm run db:seed` to reset.
- The live banner is a deterministic demo match: everyone sees the same score. It's labeled "demo feed" until the director console exists.
