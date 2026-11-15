# AGENTS.md

This repo's agent instructions live in **`CLAUDE.md`**, and product requirements live in **`REQUIREMENTS.md`**. Read both before making any change. They apply to Codex and every other agent exactly as written.

The short version, in case you only read this file:

1. Hackathon build, game is **CS2**. A working end-to-end demo loop (`REQUIREMENTS.md` §4) beats everything else.
2. Stay inside the feature folder you were asked to work on. Don't edit other people's folders.
3. Shared files (`server/src/db/schema.sql`, `seed.ts`, `web/src/components/`, `server/src/app.ts`, `api/index.ts`, `vercel.json`, root `package.json`) get additive changes only, and you must call them out in your summary.
4. Match the contracts in `REQUIREMENTS.md` §7 exactly (DB schema, coaching JSON, API routes).
5. Every external API call (Gemini, FACEIT, ElevenLabs) needs a cached/seeded fallback. Mock data is fine.
6. Never commit secrets. Never upload video through the API body. Keep the server host-agnostic (hosting isn't decided).
7. Two account types: `user` and `recruiter`/`admin`. Scouting consent and 18+ are assumed for the MVP.
