# Yao sandbox (TEMPORARY)

A throwaway harness for testing Yao's **Coaching + Scouting** features before Joe's scaffold exists. The real code already lives at its final paths:

- `server/src/lib/{ai,faceit,scouting,voice}/`, `server/src/routes/{coaching,players,scouting,voice}.ts`, `server/src/config/scouting-rules.json`, `server/src/lib/yao-deps.ts`
- `web/src/features/{coaching,recruiter}/`
- `scripts/test-faceit.mjs`

This folder only adds the tiny Express app, Vite page, schema subset and seed needed to run that code. **Delete `sandbox/` once the merge checklist below is done.**

## Run it

```bash
cd sandbox
npm install
npm run link                 # junctions server/node_modules + web/node_modules -> sandbox/node_modules
cp .env.example ../.env      # fill in DATABASE_URL + keys (repo root .env, gitignored locally)
npm run db:migrate           # applies yao-schema.sql (hypertable if TimescaleDB exists)
npm run db:seed              # only touches its own seed handles, safe on a shared DB
npm run test:engine          # pure checks, no DB/network

# two terminals:
npm run server               # API on :3001
npm run web                  # UI on :5173
```

Optional: put real CS2 clips in `sandbox/demo-clips/` named after the seed keys (`prospect-great-clip.mp4`, …) so the video player and live Gemini mode have something to play and analyze.

**Smoke tests:** `npm run smoke:faceit -- <nickname>`, `npm run smoke:gemini -- <clip.mp4|url> [map] [side]`, `npm run smoke:elevenlabs`.

## The demo loop

1. Log in as **Vyper**. The scout progress bar sits at about 99%: every stat passes except avg clip score (77.5 against the 80 bar).
2. Pick "1v3 clutch on A site" and hit **Analyze clip**. It scores 92, the last-5 average becomes 80.4, a banner says the threshold was crossed, and a scout report is created.
3. Log in as **FaZe Recruiter**. Within 5s Vyper shows up highlighted as NEW. Open the profile for the voice briefing, trends, top clips and status workflow.
4. Back on Vyper's clip: **Talk to your coach** (see `ELEVENLABS_AGENT.md`).

Re-run `npm run db:seed` to reset the demo. On stage, use `COACHING_MODE=cache`: it's instant-ish, works offline and always scores 92. Don't FACEIT-sync Vyper, because real stats would overwrite the seeded just-under-threshold numbers.

## Merge checklist (when Joe's scaffold lands)

1. Rebase `yao/coaching` on main. Remove the junctions: `rm server/node_modules web/node_modules`.
2. **Shared-file changes (additive, tell the team):**
   - `server/src/app.ts`:
     ```ts
     app.use('/api/coaching', createCoachingRouter({ db, auth }));
     app.use('/api/players',  createPlayersRouter({ db, auth }));
     app.use('/api/scouting', createScoutingRouter({ db, auth }));
     app.use('/api/voice',    createVoiceRouter({ db, auth }));
     ```
     `auth` needs `identify` (sets `req.user = { id, role }`) and `requireRole(...roles)`. See `server/src/lib/yao-deps.ts`.
   - `server/src/db/schema.sql`: add `coaching_reports.summary text` and the `player_stats` index from `yao-schema.sql`.
   - `server/src/db/seed.ts`: call `seed(db)` from `seed-yao.ts` (move it to `server/src/db/seed-yao.ts`).
   - Dependencies: server needs `zod @google/genai`, web needs `@elevenlabs/react`.
   - `.env.example`: add `GEMINI_MODEL, COACHING_MODE, COACHING_TIMEOUT_MS, COACHING_CACHE_DELAY_MS, ELEVENLABS_TTS_MODEL, DEMO_CLIP_BASE`.
3. Joe: put `<CoachingReportPanel clipId={id} onSeek={(s) => (video.currentTime = s)} />` on the clip detail page and add a `/recruiter` route that renders `<RecruiterDashboard />` (staff only).
4. Swap `authHeaders()` in `web/src/features/coaching/api.ts` for the shell's auth helper.
5. Briefing audio: change `server/src/lib/voice/audioStore.ts` `saveAudio()` to upload to the team's blob storage (Vercel disk isn't persistent).
6. Omar: `GET /api/scouting/progress/:userId` returns `primary.progress` (0 to 1) plus a per-criterion breakdown. The `player_stats` metric names are `elo, faceit_level, kd, kr, hs_pct, adr, win_rate, matches`.
7. Delete `sandbox/`.

## Contract notes for the team

- `coaching_reports.summary` column added (§7.3 has `summary`, §7.2 didn't).
- New route file `routes/players.ts` for the `/api/players/*` routes listed in §7.4.
- New routes: `GET /api/scouting/progress/:userId`, `GET /api/scouting/prospects/:id`, `GET|PUT /api/scouting/rules`, `GET /api/voice/audio/:file`.
- The prospect sort score lives in `scout_reports.evidence.score` (no schema change).
- `POST /api/coaching/analyze/:clipId` is **synchronous** (returns the report). Background jobs die on serverless; if we host on Vercel, set `maxDuration` ≥ 60.
