## Community presentation (current)

The active UI has three tabs: Discussions, Clips, and Events & Drops. Discussions leads with compact filters and editorial threads; the permanent sidebar and visible Pulse entry points are removed. Pulse services and retained components remain available to existing API consumers. Old `?pulse=1` links fall back to Discussions.

Events links to existing Watch Together rooms and challenges. Merchandise highlights read the shared Rewards catalog and reuse its product art, with points/availability taken directly from the response. Redemption stays entirely on Rewards (`/rewards#rw-store-h`); a missing catalog shows an integration notice rather than invented products. The local full-preview adapter currently has no Rewards endpoints. Feed and Rewards links live in a compact footer.

Presentation overrides are feature-scoped in `community-refresh.css`, including responsive layouts and reduced-motion handling. No shared routing, backend, schema or teammate feature files are changed by this refinement. Earlier milestone notes below are historical.

## V3 integration (current)

Community preserves the latest local Discussions, social Clips, Pulse, Watch Together, events and challenge UI on the V3 shell. Pulse supports injected curated summaries with a deterministic fallback; it does not import removed coaching or voice modules. Clip links point to creator profiles. Upload stays unavailable until the shared uploader is connected.

For a full memory-only visual preview, run `npx tsx web/src/features/community/full-preview-server.ts` and the existing Vite dev server. This adapter supports V3 cookie login, Home live samples, fan profiles and Recruiting samples. It does not persist to PostgreSQL or provide uploaded video footage. Production verification still requires the team's database configuration. Older notes below describe previous milestones; the pre-V3 onboarding patch is archived and must not be applied.

# Community module

## Unified community experience

The current UI has four top tabs: Discussions, Clips, Events & Drops, and Watch Together. Around the Community is a compact block in the supporting right sidebar alongside a compact featured challenge. On narrow screens these supporting blocks follow the main content. Styling uses the shared light dashboard tokens. The initial setup page also exposes the shared navigation (an earlier local change).

Discussions aggregates the existing board API responses into one globally sorted feed. Existing community records and thread IDs are retained; there is no migration or API contract change. The existing per-board limit of 100 applies before aggregation. Legacy board slugs map to topic filters; newly created threads include a readable `#Topic` header in their existing body field. General uses the existing CS2 board. Tags require no new table or column.

Thread card backgrounds and body text open the detail view. The title remains a keyboard-accessible button. Voting, tags, reports, links and video regions are excluded from card navigation. Nested comments, challenge scoring, and moderation still use the existing endpoints.

Clips reads the shared `GET /api/clips` library for all users, preserving ownership checks when attaching an existing clip. Owned clips offer Share to discussion. No shared uploader or direct-to-storage implementation exists in this checkout; upload is explicitly unavailable until Joe supplies it. `CommunityRoute` accepts an optional `uploadUrl` for the shared uploader route. No duplicate uploader or video-body API is implemented.

Events & Drops is an illustrated showcase with three sample upcoming-event cards and two sample merchandise concept cards. Local SVG arena and jersey illustrations are code-native sample art, not actual venue photographs or official products. All cards include dates and CTAs; store links open the official catalog and do not imply the concept products are for sale. Linked official pages are informational, not evidence that the demo dates are real. Around the Community contains original curated Reddit and X post links; it makes no live/trending claim and performs no scraping. X may require login. Original links were discovered via web search; the X post was linked by https://www.negitaku.org/news/n-27181.

New checks: `npx --no-install tsx --test web/src/features/community/community.test.ts web/src/features/community/discussions.test.ts`. Three tests pass, covering existing interactions plus topic mapping and sorting across legacy boards. Browser checks confirmed card body navigation, independent voting/reporting, and topic filtering.


## Preview

The shared app mounts `/community`. For an explicitly memory-only preview with no database or keys:

```sh
npx --no-install tsx web/src/features/community/preview-server.ts
npm run dev -w web -- --host 127.0.0.1
```

Open http://127.0.0.1:5173/community and select SmokeCheck, Rewind, or NextUp in the shared demo login. This fixture server serves only Community and the login/clip-library response shapes used by this page. Other product modules require the real shared backend. Demo data resets on restart and is not stored in TigerData. The preview deliberately provides no invented gameplay clips. Attachments and playback require actual existing records from Joe's clip service.

## Normal application

With the shared database configured, run the team's migrate/seed commands, then `npm run dev`. The shared seed now calls `seedCommunity` after the shared user/clip seeds. It adds the five boards and missing starter discussions, without deleting or modifying teammate data. All Community routes are mounted through the shared auth identifier.

`CommunityRoute` consumes the shared session and `GET /api/clips` response (`{ clips }`). A share action can link to `/community?board=clips&clip=<existing-id>` to open the composer. It never uploads video. No teammate clip or coaching files were modified.

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

Known MVP limits: 100 threads per board, 1,000 comments per thread, replies rendered up to depth 20, and memory-only preview reports. Watch-room conversations poll every 12 seconds; the main feed has no live subscription. Individual threads support `/community?thread=<id>` links. The frontend bundle still produces the existing large-chunk warning.

## Shared additive changes

- [App.tsx](../../App.tsx): `/community` page mount.
- [AppNav.tsx](../../components/AppNav.tsx): Community navigation and preserving the current community page when switching demo accounts.
- [server app](../../../../server/src/app.ts): Community router mounted with shared auth and database.
- [shared seed](../../../../server/src/db/seed.ts): Community seed hook.

This update changes Community-owned files only. The working tree also retains the previously requested app navigation change. No schema, package, global type contract, teammate feature, upload, coaching, or scouting files were changed for this update. No commits, pushes, merges, or branch switches were performed for this update.


### Showcase layout verification

The primary button style copies the landing page's shared tokens, condensed uppercase type, red fill, hover treatment, and clipped corner, scoped within Community rather than modifying onboarding. Clips uses a responsive media-card grid. The shared uploader remains an external dependency, with the same disabled upload control until its real route is supplied.

After this layout update, build, frontend/backend type checks, and all three Community tests passed. Browser checks confirmed exactly three top section controls, three external sidebar links, three event cards, two loaded merchandise illustrations, and no horizontal page overflow at 390px. The existing large-bundle build warning remains. No shared contracts or teammate feature files were changed for this layout update.

### Compact feed and comment UX

The Community header and navigation now use reduced spacing, with redundant subtitles removed. Topics and sorting share a bordered compact filter bar, and thread cards have tighter padding. A small keyboard-accessible Demo Mode disclosure in the Community header replaces the full-width storage disclaimer and retains the memory-only explanation.

Thread detail has a collapsed Add a comment prompt immediately after the main post, above comments. Opening it reveals the existing clip selector, validated textarea, Submit, and Cancel. Reply mounts that same editor directly below its target comment; one editor is open at a time. Cancel clears the draft without a request, errors preserve it, and successful submissions append the response and collapse the editor.

Verification after refinement: frontend/backend type checks, build, and three API/topic tests passed. Live browser checks passed for collapsed default state, top-level posting, inline nested reply posting, cancelling both editor types, switching reply targets without opening multiple editors, the demo disclosure, and 390px feed layout without overflow. Real clip attachment playback and database persistence remain untested in this memory-only preview, with no uploaded CS2 footage configured.


### Editorial visual refinement

The feed uses title-led rows with bottom rules instead of rounded cards. Metadata and avatars are subdued; vote and action controls use compact monochrome treatments with red selected states. Thread detail starts with a large title and compact author/topic line, followed by body, actions and contextual comments. Root comments use dividers; nested replies use thin vertical guides. Clips, showcases, fields and supporting content use consistent near-square corners and the existing landing-page primary buttons.

Welcome to the HQ and the playbook were removed. A narrower sidebar contains only curated external links and one compact featured challenge. No backend behavior, API contract, storage or shared component changed.

Checks passed: build, both workspace type checks, all three Community tests, and whitespace checks. Live preview checks passed for desktop voting, opening thread detail, posting comments and inline nested replies. Feed and detail were measured at 1440px desktop and 390px mobile widths, with no horizontal overflow. Real uploaded footage and database persistence remain unverified; the preview still uses memory-only demo data.

### Final showcase/filter refinements

Long showcase disclaimers and topic-introduction paragraphs were removed. The global Demo Mode disclosure still explains volatile storage, and individual fictional events/products retain small Sample labels. Functional unavailable-uploader notices remain.

Challenges now maps to the existing `type: 'challenge'` field, regardless of legacy board or body tag. The Challenges filter only includes challenge records; selecting that topic for a new discussion uses the existing challenge type and rules. Featured challenge links use the new filter. No shared contracts or records were migrated.

The featured event is 240px high at desktop; supporting events and merchandise use two columns, dropping to one at mobile widths. Local placeholder illustrations remain in use; no approved real photography was supplied. Dates and CTAs remain visible.

All four Community tests, frontend/backend type checks, build, and whitespace checks passed. Browser checks confirmed challenge filtering and standings, a two-column desktop showcase, no overflow at 390px, and three unique sidebar URLs. Both Reddit destinations were readable on verification. The existing X URL returned no readable page content, so its current post availability could not be fully confirmed; it remains a curated link that may require sign-in. Upload and real clip playback still require Joe's shared integration and actual footage.

### Stable voting, selectors, and text readability

The feed previously ran `sortThreads` during every render, causing score updates to move rows immediately. Thread state now stores the explicitly sorted feed snapshot; filtering keeps that sequence, and vote responses update matching rows in place. Sorting is recalculated on initial loading, changing Hot/New/Top, or Refresh. New posts are inserted at the front, and the selected topic filter follows the created post. No row is removed because of a downvote.

The existing topic selector still writes a readable hashtag in the existing body field, with no API/schema changes. Topic and thread-type selectors now synchronize in both directions: selecting Challenges uses challenge type; leaving Challenges resets to discussion; selecting challenge type selects Challenges. Selectors retain native platform rendering, fit their containers, use readable mobile text, and are disabled while posting.

Removed the duplicated Events & Drops content heading so Upcoming Events leads that view. Body text, metadata, labels, controls, and input text are modestly larger while preserving display headings and the existing design.

Checks: build, both workspace type checks, all four Community API/topic tests, and whitespace checks passed. Live browser tests covered vote toggles and changes on multiple posts under Hot/Top, retained filtered ordering, unchanged scroll positions, creating a General-tagged thread and finding it in #General, and mobile selector synchronization with 16px input text and no 390px overflow. Real touch-device native menus, uploaded footage, and PostgreSQL persistence remain outside this preview validation.

### Discussions toolbar layout

The repeated Discussions content heading and manual Refresh control are removed. Topic filters and Create Thread share a responsive row, with sorting and count below. The composer expands beneath this toolbar to keep the trigger in place. Existing successful mutations update thread rows and comment counts immediately, without re-sorting votes. Changing Hot/New/Top or reloading the page fetches a fresh sorted snapshot.

Browser verification passed for desktop same-row/right-aligned placement, 390px layout without overflow, stable voting, creating a tagged thread, and updating its comment count without manual refresh. Changes remain within Community-owned files.

## FaZe Pulse and Watch Together expansion

### Routes and navigation

- `/community?pulse=1`: on-demand Pulse, accessible through the Discussions briefing entry.
- `/community?view=watch`: four-category room discovery.
- `/community?watch=sydney-replay`: recorded FaZe Esports CS2 documentary.
- `/community?watch=question-time`: ESL Counter-Strike's archived IEM Sydney 2018 interview.
- `/community?watch=legacy-club` and `?watch=community-screening`: labeled sample rooms awaiting curated media.
- `/community?thread=<id>`: a shareable full discussion link, also used by Pulse sources and rooms.

Room definitions and stable linked thread IDs live in the owned backend router. `seedCommunity` now adds missing watch threads using existing communities/users without deleting records. Run the existing shared seed command for database mode; the memory preview seeds these automatically. No new shared app mount, schema change, package, or teammate-owned file was needed for this expansion.

### Community API additions

- `GET /api/community/pulse`: source-linked recap for up to 60 public threads from the last seven days and up to 200 retrieved comments.
- `GET /api/community/watch/rooms`: category/status/source catalog.
- `GET /api/community/watch/rooms/:roomId`: room and poll results.
- `POST /api/community/watch/rooms/:roomId/poll`: `{ option: number }`, authenticated exclusive choice with change support.
- `GET /api/threads/:id`: full source discussion with existing response fields.

Messages and podcast questions post through the existing comments endpoint. Questions are ordinary `[Question] ` comments, ranked by the existing comment votes. Poll ballots use reserved `[watch-ballot] ` comment records on each room's own thread, with one row per account enforced through a thread lock in the database write transaction. Ballots are independent of upvotes and are excluded from ordinary comment reads/counts and Pulse. The existing comment endpoint rejects reserved ballot-prefix submissions. No separate chat or poll database was introduced.

### Pulse accuracy and AI

Pulse reuses `generateText` and `withTimeout` from the team's server-side Gemini module by importing them without edits. When configured, Gemini selects validated existing thread/comment IDs for editorial curation. All displayed facts, excerpts, scores, comment counts and questions are constructed from retrieved records rather than accepting arbitrary generated factual prose. This deliberately favors source-grounded curation over unrestricted summaries. Individual excerpts are attributed and never labeled as community consensus. No API key is sent to the browser.

Missing credentials, provider errors, timeout (8 seconds), malformed JSON, or invalid source IDs yield a deterministic digest. The UI labels this as Data recap / no AI. Generation is on demand, cached for five minutes by content fingerprint, invalidated by source changes, and deduplicated for concurrent identical requests. Tests can disable or inject generation through the router dependency for offline validation. Live Gemini generation has not been exercised in this environment.

### Media and conversation

YouTube IDs and Twitch channel/video paths are allowlisted and validated before constructing official player URLs. Twitch uses the current browser hostname as its required parent. Sources are never proxied, downloaded, or rebroadcast. Replay content is never labeled live, and there is no synchronized playback. Both genuine YouTube sources returned video metadata and embed HTML through YouTube oEmbed on verification. Browser iframe loading was observed, but actual audiovisual playback was not established; the original source links and manually tested player fallback remain available for restrictions or failures. Legacy/community placeholders do not pretend to contain video.

Room conversations poll every 12 seconds while mounted, without overlapping reads. Local successful writes appear immediately; a mutation epoch prevents stale poll responses from replacing them. Returning to a room reuses its discussion comments. Polls and questions remain in the same persistent Community tables in database mode, or volatile server memory in this preview. Copy room link has a readable URL fallback if clipboard access fails.

### Validation

Run `npx --no-install tsx --test web/src/features/community/community.test.ts web/src/features/community/discussions.test.ts web/src/features/community/expansion.test.ts`, `npm run lint`, `npm run build`, and `npm test`.

All seven Community tests, both workspace type checks, build, and existing scouting tests passed. Coverage includes official/unsafe media URLs, Twitch parent construction, source-linked fallback and caching, room message isolation, returning to conversations, question upvotes, exclusive/changeable/concurrent poll choices, invalid identities/options/rooms, and exclusion of ballots from conversations/recaps.

Live browser verification passed for Pulse-to-source navigation, category filtering, shared thread navigation, deep-link reloads, room message/question posting, question upvotes, changing a poll choice, source-player fallback, copying a room link, and a second user's message appearing through the 12-second poll. Desktop room columns and 390px stacked layout were checked without overflow. PostgreSQL execution, live Gemini requests, audiovisual playback, and Joe's missing clip upload integration remain unverified. The existing large-bundle build warning remains.

Injected-generator tests also verify that invalid AI source IDs are rejected, valid existing IDs are accepted, and provider fallback is cached. These do not represent live Gemini API verification.

## Optional full-application mock preview (local only)

To inspect teammate screens without PostgreSQL, stop the Community-only preview API and run:

```sh
npx --no-install tsx web/src/features/community/full-preview-server.ts
npm run dev -w web -- --host 127.0.0.1
```

Open `/coaching`, `/u/nextup`, `/leaderboards`, `/recruiting`, `/timeline`, or `/community` on port 5173. Choose an account marked MOCK in the shared login picker. The adapter supplies sample profiles, trends, scores, clip metadata and recruiter prospects, with the real Community and mentorship routers running in memory. It is a visual/API-shape preview, not verification of PostgreSQL or external services. All writes reset on server restart. Sample gameplay footage is intentionally unavailable; the shared storage uploader is not connected. No removed AI coaching or voice modules are imported. Profile-card export is not supplied by this adapter.

## Watch Together viewing polish

Discovery uses one featured thumbnail and a responsive grid of the remaining rooms. Room views pair a 16:9 player with an aligned, scrollable fan-chat panel. Secondary Polls, Discussion and podcast Fan questions are progressively disclosed through keyboard-accessible tabs. Share links, original-source links, player fallback, linked discussion, legacy challenge link, room polling and existing mutations remain unchanged. Styling is isolated in `watch-together.css`; backend/data contracts and other feature components are untouched.

Verified in the local mock preview: desktop 74/26 player/chat split, 820px tablet and 390px mobile without horizontal overflow, chat posting, question submission/upvotes, poll selection, arrow-key tab navigation, copied room URL, refresh, player fallback/retry, discovery categories, legacy placeholder, related discussion, and Events/Pulse navigation. Type checks, build, seven Community tests and scouting test passed. External audiovisual playback and real database execution remain unverified. No commits or pushes were made for this polish.

## Social clip feed and Pulse refinement

Clips uses shared clip records in a vertical feed, with lazy native/official embedded playback, offscreen pause/unmount, no automatic playback and real creator/profile links. An injected `uploadUrl` connects Joe's shared uploader when available; otherwise Upload Clip stays disabled with an integration notice. There is no duplicate uploader or media storage. The shared library refreshes on focus and every 20 seconds while visible.

Social state reuses existing `threads`, `comments`, and `votes`. `GET /api/community/clip-threads?ids=...` returns one existing discussion per clip, regardless of how many discussions explicitly reference that clip. `POST /api/community/clips/:clipId/discussion` returns an existing discussion or lets the clip owner create the first one. A database clip-row lock serializes concurrent first-publication requests; no schema changes are required. Other users cannot publish on the owner's behalf; once published, everyone with a demo account can participate. Unpublished clips do not display invented scores or comment counts. Native comment/reply controls stay inline, and sharing uses `/community?view=clips&clip=<id>`.

Discussions features a compact, two-highlight Pulse preview. The full recap uses a lead story, additional conversations, attributed comment excerpts, original sources, and a collapsible explanation. The deterministic V3 recap, source validation, caching and optional injected curation remain intact. Stored topic markers display as tags rather than repeating in bodies; sample starter posts retain small labels.

Historical onboarding proposals are excluded from this release. The V3 shell supplies the global navigation; no onboarding implementation is changed here.
