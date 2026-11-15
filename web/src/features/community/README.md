# Community module

## Preview

The shared app mounts `/community`. For an explicitly memory-only preview with no database or keys:

```sh
npx --no-install tsx web/src/features/community/preview-server.ts
npm run dev -w web -- --host 127.0.0.1
```

Open http://127.0.0.1:5173/community and select SmokeCheck, Rewind, or NextUp in the shared demo login. This fixture server serves only Community and the login/clip-library response shapes used by this page. Other product modules require the real shared backend. Demo data resets on restart and is not stored in TigerData. The preview deliberately provides no invented gameplay clips. Attachments and playback require actual existing records from Joe's clip service.

## Normal application

With the shared database configured, run the team's migrate/seed commands, then `npm run dev`. The shared seed now calls `seedCommunity` after the shared user/clip seeds. It adds the five boards and missing starter discussions, without deleting or modifying teammate data. All Community routes are mounted through the shared auth identifier.

`CommunityRoute` consumes the shared session and `GET /api/clips?userId=...` response (`{ clips }`). A share action can link to `/community?board=clips&clip=<existing-id>` to open the composer. It never uploads video. No teammate clip or coaching files were modified.

The router factory in [community.ts](../../../../server/src/routes/community.ts) accepts a shared pg Pool, optional user identification adapter, keyword list, report callback, or explicit memory fixtures. Database failures return errors and never silently become memory writes. Responses are `{ data, mode: 'database' | 'demo' }`; errors are `{ error }`.

## Routes

- `GET /api/communities`
- `GET /api/communities/:slug/threads?sort=hot|new|top`
- `POST /api/communities/:slug/threads`: `{ title, body, type?: 'post'|'challenge', clip_id?: string|null }`
- `GET /api/threads/:id/comments`
- `POST /api/threads/:id/comments`: `{ body, parent_id?: string|null, clip_id?: string|null }`
- `POST /api/votes`: `{ target_type: 'thread'|'comment', target_id, value: -1|0|1 }`
- `POST /api/community/reports`: `{ target_type, target_id, reason }`

All writes validate identity and references. Attachments must be the current user's existing CS2 clips. Replies must reference the same thread. Votes are idempotent and zero removes a vote. Database votes lock the target row, replace the previous vote, and update its score by the delta. Challenge submissions lock their thread to prevent concurrent duplicate root submissions. Each account gets one submission; comment votes form the challenge standings, independently of player leaderboards.

## Moderation and content

Reports are functional in the preview, with a bounded process-local buffer and explicit demo notice. Durable database reports intentionally return 503 until the team supplies the router's `report` callback. No unauthorized moderation schema was introduced. Keyword filtering is intentionally basic and configurable, and input lengths and vote values are validated server-side.

History discussions cover 2010, 2016 and Antwerp 2022, citing FaZe's [history](https://fazeclan.com/pages/about) and [team page](https://fazeclan.com/pages/team). Historical CS:GO references do not expand the product's CS2-only gameplay scope. Event discussions are hypothetical demo fixtures, not an asserted current schedule. Challenges have no prizes or implied official affiliation.

## Verification

```sh
npm run lint
npm run build
npx --no-install tsx --test web/src/features/community/community.test.ts
```

All three passed after integration. The API test covers a real HTTP server with the memory adapter: five boards, existing clip sharing, vote repeat/reversal/removal/concurrency, comments/replies, invalid parents/references/ownership/accounts, validation, challenge submissions/duplicates, and reports. Real PostgreSQL transactions require a database smoke test; no database credentials are present in this checkout.

Browser verification confirmed shared demo login, thread creation, posting a comment, and a 390px mobile viewport with no horizontal page overflow. Further scripted browser actions timed out, so nested replies, vote transitions, alternate-user interactions, and sorting are covered by API tests or remain manual UI checks rather than a claimed browser pass. The API test uses an existing clip fixture; real CS2 video playback remains dependent on the clip owner providing accessible uploaded footage.

Known MVP limits: 100 threads per board, 1,000 comments per thread, no polling/live subscriptions, replies rendered up to depth 20, memory-only preview reports, and no deep links to individual threads. The frontend bundle still produces the existing large-chunk warning.

## Shared additive changes

- [App.tsx](../../App.tsx): `/community` page mount.
- [AppNav.tsx](../../components/AppNav.tsx): Community navigation and preserving the current community page when switching demo accounts.
- [server app](../../../../server/src/app.ts): Community router mounted with shared auth and database.
- [shared seed](../../../../server/src/db/seed.ts): Community seed hook.

No schema, package, global type contract, teammate feature, upload, coaching, or scouting files changed. No commits, pushes, or branch switches.
