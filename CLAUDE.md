# CLAUDE.md

Instructions for AI coding agents (Claude Code, Codex, etc.) working on this repo. Read this fully before making changes. Product details live in `REQUIREMENTS.md`; read the section for whatever feature you're touching.

## Project

**FaZe HQ**, our HackUTA 2026 entry for the FaZe Challenge ("Be the CTO of FaZe Clan"). A FaZe fan hub that puts FaZe into fans' everyday gaming life and rebuilds hype:
- **Phase 1 (foundation):** Home showcase with a live banner and counters, Community, fan Profile, public Leaderboards, and a staff-only Recruiting tab.
- **Phase 2 (features):** Broadcast HUD (CS2 GSI overlay), RGB Sync, FaZe Guessr and The Wall (r/place). All of them are driven by a FaZe Live event bus and an admin director console.

**Removed in the V3 pivot:** AI clip coaching, the voice coach, AI scout-report writing and coaching subscriptions. Don't re-add them. The old code is at git tag `pre-pivot`.

This is a **hackathon build**. Optimize for a working, demo-able experience (`REQUIREMENTS.md` §4) over completeness or perfect architecture.

## Stack

- **Frontend:** React + Vite + TypeScript, in `web/`. Tiny path router in `web/src/App.tsx` (no router dependency).
- **Backend:** Node.js + Express + TypeScript, in `server/`. `server/src/app.ts` exports the app and `server/src/index.ts` creates the HTTP server.
- **Database:** TigerData (Postgres + TimescaleDB hypertables), plain SQL via `pg` (`server/src/db/client.ts`).
- **Realtime (Phase 2):** socket.io on the same Express server.
- **Hosting:** one always-on Node service (Railway). Express serves `web/dist`, the API and sockets on one origin. **Not Vercel**: its functions can't hold WebSockets.
- **CS2 data:** FACEIT Data API v4 (`FACEIT_MODE=mock|live`, mock by default).
- **Local companion (Phase 2):** a Node app on the user's PC for CS2 Game State Integration and RGB devices.

## Repo layout

```
shared/types.ts                  Cross-cutting types (LiveEvent, LiveStatus, LiveCounters, Role): shared
web/src/components/              App shell, AppNav, RequireRole, ui/ kit, live/: shared (Joe owns the design)
web/src/features/home/           Joe
web/src/features/onboarding/     Joe (/join)
web/src/features/community/      Dahiya
web/src/features/profile/        Omar (profile + leaderboards)
web/src/features/recruiting/     Yao (staff-only tab: pipeline uses Omar's ProspectBoard)
web/src/features/admin/          Yao (admin overview; Phase 2 director console)
web/src/features/{hud,rgb,guessr,wall,admin}/   Phase 2 (Joe HUD visuals, Yao admin/director, Omar guessr, Dahiya wall)
server/src/routes/auth.ts        Yao (shared demo auth)
server/src/routes/live.ts        Yao
server/src/routes/admin.ts       Yao
server/src/routes/players.ts     Yao
server/src/routes/scouting.ts    Yao
server/src/routes/community.ts   Dahiya
server/src/routes/profiles.ts    Omar
server/src/routes/clips.ts       Joe
server/src/db/                   Shared: schema.sql, leaderboards.sql, migrate.ts, seed.ts, client.ts
server/src/config/               scouting-rules.json (Yao)
server/src/lib/faceit/, lib/scouting/, lib/live/   Yao
companion/                       Local RGB companion (Yao): standalone package, NOT an npm workspace (native node-hid). cd companion && npm install && npm start
scripts/                         Smoke tests
```

## Commands

```bash
npm install            # install all workspaces
npm run setup          # migrate + seed (fresh DB → full-looking app)
npm run dev            # web on :5173 (Vite proxies /api to :3001), server on :3001
npm run db:migrate     # apply schema.sql (+ leaderboards.sql on TimescaleDB)
npm run db:seed        # reset demo data
npm run build          # production web build
npm start              # production: Express serves web/dist + API on $PORT
npm test               # server tests
npx tsx --test web/src/features/community/*.test.ts   # community tests
```

## Ownership rules (four people work in parallel)

1. **Stay in your feature folder.** Only edit files for the feature you were asked to work on. If a change is needed in another person's folder, stop and say so, unless the human explicitly asked you to work across folders.
2. **Shared files need a heads-up:** `shared/types.ts`, `server/src/db/schema.sql`, `server/src/db/seed.ts`, `web/src/components/`, `web/src/App.tsx`, `server/src/app.ts`, `server/src/index.ts`, root `package.json`, this file, and `REQUIREMENTS.md` §7. Make additive changes only (new tables, columns, components); never rename or delete existing ones. Call the change out clearly in your summary.
3. **Contracts are in `REQUIREMENTS.md` §7** (DB schema, `LiveEvent`, API routes). Match them exactly.
4. **Read, don't recompute.** Profile and Recruiting read the same `player_stats` / FACEIT data; scouting progress comes from `lib/scouting/engine.ts`.

## Conventions

- TypeScript everywhere, `strict` on. Cross-cutting types live in `shared/types.ts` (type-only imports).
- API responses are JSON. Errors: `{ "error": "message" }` with a sensible status code.
- Routes are prefixed `/api/...` and grouped by feature file. Routers take dependencies as arguments (`createXRouter({ db, auth })`).
- SQL: snake_case. Time-series data goes in hypertables (`player_stats`, `social_stats`, `live_events`, `pixel_events`).
- Frontend: function components + hooks. Fetch calls go in an `api.ts` per feature. Use the shared `components/ui` kit and `theme.css` tokens instead of one-off styles.
- Keep dependencies minimal. Ask before adding anything heavy.

## Demo safety (this matters more than clean code)

- The demo in `REQUIREMENTS.md` §4 must always work. Don't merge anything that breaks it.
- Every external dependency needs a **fallback**: FACEIT, match feeds, YouTube/Twitch, Steam → mock/seeded data; CS2 → recorded GSI replay; RGB hardware → on-screen virtual setup; live feed → director console. Hackathon Wi-Fi is unreliable.
- Never upload video through the Express API body.
- Realtime: enforce cooldowns and rate limits on the server, never trust the client.

## Secrets and env

- All keys go in `.env` (local) and Railway env vars (deployed). Never commit keys, and never put them in frontend code (no `VITE_` secrets).
- Keep `.env.example` updated when you add a variable.

## Product rules agents must respect

- **Roles:** `user`, `recruiter`, `admin`. Recruiting needs recruiter/admin; Admin and the director console need admin. Check on the server (`requireRole`) **and** in the UI (`RequireRole`).
- Scouting thresholds live in `server/src/config/scouting-rules.json`, not hardcoded.
- No AI coaching, AI editing or AI-written reports. Use templates.
- Every user is assumed opted in and 18+ for the MVP.
- Recruiter notifications only go to our own dashboard. Never email real FaZe addresses.
- Don't claim FaZe, Valve or FACEIT endorsement anywhere in the UI.

## How to work

- Before coding, restate the task in a sentence and list the files you plan to touch.
- Git: pull and merge `origin/main` first, run typecheck/build/tests, then push to `main` (no feature branches).
- Make small, focused changes. After a change, run the app or the relevant script and confirm it works before saying it's done.
- If something in this file or `REQUIREMENTS.md` conflicts with the request, point out the conflict instead of guessing.
- End with a short summary: what changed, files touched, any shared-file changes the team needs to know about, and anything left undone.
