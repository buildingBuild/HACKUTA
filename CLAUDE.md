# CLAUDE.md

Instructions for AI coding agents (Claude Code, Codex, etc.) working on this repo. Read this fully before making changes. Product details live in `REQUIREMENTS.md`; read the section for whatever feature you're touching.

## Project

**FaZe HQ (working name)**, our HackUTA 2026 entry for the FaZe Challenge ("Be the CTO of FaZe Clan") and the ElevenLabs track. A FaZe-branded platform that streamlines how FaZe recruits top **Counter-Strike 2** talent: players upload clips, get AI coaching, talk to a voice coach, discuss in Reddit-style threads, and build a public portfolio. Players who cross a performance threshold get an AI scout report sent to a FaZe recruiter dashboard.

This is a **hackathon build** (one weekend). Optimize for a working, demo-able end-to-end loop over completeness, scale, or perfect architecture.

## Stack

- **Frontend:** React + Vite + TypeScript, in `web/`
- **Backend:** Node.js + Express + TypeScript, in `server/`. `server/src/app.ts` exports the app, `server/src/index.ts` calls `listen`. Keep it host-agnostic
- **Database:** TigerData (managed Postgres with TimescaleDB hypertables). Use plain SQL via `pg` (or the query builder the team picks, check `server/src/db/client.ts` first)
- **AI:** Gemini API for video clip analysis; LLM for scout report text
- **Voice:** ElevenLabs conversational agent (voice coach) + text-to-speech (scout report briefings)
- **Storage:** Blob storage for clips with direct browser uploads (check `server/src/lib/` for which one is wired up)
- **CS2 data:** FACEIT Data API v4 (`FACEIT_API_KEY`), with seeded data as fallback. Mocked data is fine for the MVP
- **Hosting:** Not decided yet. Default is Vercel (`api/index.ts` wraps the Express app); local or Vultr are options. Don't write code that only works on one host

## Repo layout

```
web/src/features/clips/        Joe
web/src/features/coaching/     Yao
web/src/features/recruiter/    Yao
web/src/features/community/    Dahiya
web/src/features/profile/      Omar
web/src/components/            Shared UI + FaZe design system (Joe)
server/src/routes/clips.ts     Joe
server/src/routes/coaching.ts  Yao
server/src/routes/scouting.ts  Yao
server/src/routes/voice.ts     Yao
server/src/routes/community.ts Dahiya
server/src/routes/profiles.ts  Omar
server/src/db/                 Shared: schema.sql, seed.ts, client.ts
server/src/config/             scouting-rules.json (Yao)
server/src/lib/ai/             Yao
server/src/lib/faceit/         Yao
server/src/lib/voice/          Yao
server/src/lib/social/         Joe
scripts/                       Smoke tests (test-faceit.mjs)
api/index.ts                   Only if hosting on Vercel: wraps the Express app
```

If the repo is still empty, scaffold this layout first, get a hello-world running end to end (web calls `/api/health`, server reads the DB), then build features.

## Commands

Update this section once the scaffold exists so it matches `package.json`.

```bash
npm install            # install all workspaces
npm run dev            # web on :5173 (Vite proxies /api to :3001), server on :3001
npm run db:migrate     # apply server/src/db/schema.sql to TigerData
npm run db:seed        # load demo data (users, stats history, clips, threads, prospect)
npm run build          # production build
npm run lint
node scripts/test-faceit.mjs <nickname>   # check the FACEIT key works (needs FACEIT_API_KEY)
```

## Ownership rules (important, four people are working in parallel)

1. **Stay in your feature folder.** Only edit files for the feature you were asked to work on. If a change is needed in another person's folder, stop and say so instead of editing it.
2. **Shared files need a heads up:** `server/src/db/schema.sql`, `server/src/db/seed.ts`, `web/src/components/`, `server/src/app.ts`, `api/index.ts`, `vercel.json`, root `package.json`, this file, and `REQUIREMENTS.md` §7 (Shared Contracts). Make additive changes only (new tables/columns/components), never rename or delete existing ones, and call out the change clearly in your summary so the human can tell the team.
3. **Contracts are in `REQUIREMENTS.md` §7.** The DB schema, coaching report JSON shape, and API routes there are what other features build against. Match them exactly.
4. **Read, don't recompute.** Profile/leaderboards read scores that coaching/scouting writes. Community references clips by `clip_id`. Don't duplicate another feature's logic.

## Conventions

- TypeScript everywhere, `strict` on. Shared types go in one place (e.g. `server/src/types.ts`, mirrored or imported by `web`).
- API responses are JSON. Errors: `{ "error": "message" }` with a sensible status code.
- Routes are prefixed `/api/...` and grouped by feature file.
- SQL: snake_case tables and columns. Time-series data goes in hypertables (`player_stats`, `social_stats`), not regular tables. Use continuous aggregates for leaderboards and trend charts.
- Frontend: function components + hooks. Keep fetch calls in a `api.ts` file per feature.
- Styling follows the FaZe brand (red/black/white, bold condensed headings). Use the shared components instead of one-off styles.
- Keep dependencies minimal. Ask before adding anything heavy.

## Demo safety (this matters more than clean code)

- The P0 demo loop in `REQUIREMENTS.md` §4 must always work. Don't merge anything that breaks it.
- Every external call (Gemini, FACEIT, ElevenLabs, YouTube/Twitch) needs a **fallback**: cached/seeded result if the call fails, times out, or hits a rate limit. Hackathon Wi-Fi is unreliable.
- Never upload video through the Express API body. Browser uploads go directly to blob storage; the API only receives the URL.
- Long AI calls: keep clips short, show an "analyzing" state in the UI, and if hosted on Vercel set the function `maxDuration`.
- Seed data must include one prospect who sits just below the scouting threshold, so a live clip upload can push them over during the demo.

## Secrets and env

- All keys in `.env` (local) and Vercel env vars (deployed). Never commit keys, never put them in frontend code.
- Expected vars: `DATABASE_URL`, `GEMINI_API_KEY`, `FACEIT_API_KEY`, `BLOB_READ_WRITE_TOKEN` (or storage equivalent), `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_VOICE_ID`, `YOUTUBE_API_KEY`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`.
- Keep `.env.example` updated when you add a variable.

## Product rules agents must respect

- **Two account types:** `user` (players/fans) and `recruiter` / `admin` (FaZe staff). Recruiter and admin routes and pages must check the role.
- For the MVP, every user is **assumed opted in to scouting and 18+**. Don't build consent or age-gate flows unless asked.
- Scouting thresholds live in `server/src/config/scouting-rules.json`, not hardcoded in logic.
- AI coaching output must match the JSON shape in `REQUIREMENTS.md` §7.3 and be validated (e.g. zod) before saving.
- Recruiter notifications only go to our own demo inbox / dashboard. Never email real FaZe addresses.
- Don't claim FaZe, Valve, or FACEIT endorsement anywhere in the UI.

## How to work

- Before coding, restate the task in a sentence and list the files you plan to touch.
- Make small, focused changes. After a change, run the app or the relevant script and confirm it works before saying it's done.
- If something in this file or `REQUIREMENTS.md` conflicts with the request, point out the conflict instead of guessing.
- End with a short summary: what changed, files touched, any shared-file changes the team needs to know about, and anything left undone.
