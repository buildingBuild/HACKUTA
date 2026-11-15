# AGENTS.md

This repo's agent instructions live in **`CLAUDE.md`**, and product requirements live in **`REQUIREMENTS.md`**. Read both before making any change. They apply to Codex and every other agent exactly as written.

The short version, in case you only read this file:

1. Hackathon build: **FaZe HQ, a FaZe fan hub** (CS2 focus). Phase 1 = Home, Community, Profile, Leaderboards, staff-only Recruiting. Phase 2 = Broadcast HUD, RGB Sync, FaZe Guessr, The Wall, on a live event bus.
2. **No AI coaching, AI editing or AI-written reports.** These were removed in the V3 pivot (old code at tag `pre-pivot`).
3. Stay inside the feature folder you were asked to work on. Shared files (`shared/types.ts`, `server/src/db/*`, `web/src/components/`, `web/src/App.tsx`, `server/src/app.ts`, root `package.json`) get additive changes only, and you must call them out in your summary.
4. Match the contracts in `REQUIREMENTS.md` §7 exactly (DB schema, `LiveEvent`, API routes).
5. Every external dependency needs a mock/seeded fallback (FACEIT, match feeds, CS2 GSI replay, virtual RGB setup).
6. Never commit secrets. Hosting is one always-on Node service (Railway); don't write Vercel-only code.
7. Roles: `user`, `recruiter`, `admin`. Gate staff routes on the server and in the UI.
8. Git: pull/merge `origin/main`, verify, push to `main`.
