# FaZe HQ (working name): Requirements Doc

HackUTA 2026 · FaZe Challenge: "Be the CTO of FaZe Clan" (main track) + ElevenLabs (main track) + MLH tracks we can stack
Team: Joe (Posts/Clips + UI), Yao (Coaching + Scouting), Dahiya (Social/Community), Omar (Profile/Portfolio + Leaderboards)
Stack: React + Node.js (Express) + TigerData (Postgres with time-series). Hosting: open (Vercel by default, see §8)
Game: **Counter-Strike 2**

> This doc is the shared source of truth for humans and agents. Feature owners can flesh out their own section, but anything in **Shared Contracts** needs a quick team check before it changes.

---

## 1. One-liner

A FaZe-branded home base that **streamlines how FaZe finds top CS2 talent**. Players upload clips, get AI coaching, hang out in community threads, and build a public portfolio. When a player (or creator) crosses a performance threshold, FaZe recruiters get an auto-generated scout report on their dashboard. Think of it as an **always-on FaZe5**, feeding talent into FaZe Up Next.

## 2. Why this fits FaZe right now

- FaZe refocused on esports in 2026 after closing its creator division, and CS2 is its flagship game.
- In April 2026 FaZe announced **FaZe Up Next**, an academy for developing future stars. Our platform is the scouting funnel for that academy.
- FaZe is already betting on young CS2 prospects (it brought in 18-year-old AWPer JBOEN on loan in June 2026). We make finding the next one faster and data-backed.
- FaZe already proved fans want a shot at joining: the 2020 **#FaZe5** challenge pulled 211,000+ applicants and 35M+ views in 30 days. We turn a one-off event into a permanent product.

## 3. Target users

| User | What they want | What we give them |
|---|---|---|
| **Aspiring CS2 players** (new fans) | Get better, get noticed | AI clip coaching, progress tracking, scout threshold progress bar |
| **Returning fans** (grew up on FaZe trickshots and montages) | Nostalgia, community, reason to care again | Community threads, FaZe history content (foundation in §5.3, more ideas pending team brainstorm) |
| **Esports fans** | Talk about FaZe CS2 matches and roster moves | Event and talent threads |
| **Aspiring creators** | Grow an audience, get signed | Social stats on their portfolio, creator scouting track (secondary) |
| **FaZe recruiters / admins** (B2B side) | Find talent without scrolling the whole internet | Recruiter dashboard with ranked prospects, AI scout reports, voice briefings |

## 4. The demo loop (P0: this must work end to end)

Every feature plugs into this one story. If we only finish this, we still have a strong demo.

1. **Sign in** as a demo player and link a FACEIT nickname (CS2).
2. **Upload a clip** (Joe). Optionally link it to a social post (YouTube/Twitch/TikTok URL).
3. **AI coaching** reviews the clip and returns CS2-specific feedback with timestamps and scores (Yao).
4. **Talk to the coach** (ElevenLabs voice agent) about the feedback (Yao, P1 but needed for the ElevenLabs track).
5. **Share to community**: post the clip into a thread, others comment and upvote (Dahiya).
6. **Portfolio updates**: FACEIT level/ELO, stats, AI coaching scores, and social numbers show on a public profile and leaderboard (Omar).
7. **Threshold crossed**: the player's stats pass the scouting bar, a scout report is generated, and the **FaZe recruiter dashboard** lights up with a new prospect, with a voice briefing of the report (Yao).

Demo trick: seed a "prospect" account that is *just below* the threshold, so uploading one great clip live pushes them over.

## 5. Features by owner

### 5.1 Posts / Clips (Joe)

**Goal:** get clips into the system and connected to social posts.

- Upload a short clip (target 10 to 60 seconds, mp4/webm). Upload goes **straight from the browser to blob storage** (Vercel Blob client upload, Cloudinary, or similar), never through our API body.
- Attach metadata: game (CS2), map, side (T/CT), weapon focus, title, optional social post URL.
- Link a social post: paste a YouTube/Twitch URL and pull public stats (views, likes) where an easy API exists. TikTok/Instagram/X: manual entry or mocked.
- Clip feed and clip detail page (video player + coaching report panel slot that Yao fills).
- Emits a `clips` row so coaching can pick it up.

**Also owns:** overall UI shell, nav, FaZe branding (use the FaZe Brand Toolkit from the challenge resources), and the shared design system.

### 5.2 Coaching + Scouting (Yao)

**Goal:** turn clips and stats into feedback for players and talent signals for FaZe.

**AI clip coaching (CS2)**
- Send the clip to a video-capable model. Gemini handles video natively and "Best Use of Gemini API" is an MLH track, so it's the default pick.
- Ground the prompt with the player's context: FACEIT level/ELO, map, side, recent match stats.
- Force structured JSON output (see Shared Contracts §7.3). Feedback categories:
  - Crosshair placement (head level, pre-aiming common angles)
  - Movement (counter-strafing before shooting, peeking: wide swing vs jiggle vs shoulder)
  - Spray control (recoil, bursting vs spraying at range)
  - Utility (smokes, flashes, molotovs, HE: timing and usage before entry)
  - Positioning and trades (isolated deaths, crossfires, refrags)
  - Decision making (rotations, economy awareness, clutch choices)
- Output: overall clip score (0 to 100), per-category scores, 3 to 5 timestamped notes, 1 to 2 drills (e.g. aim_botz, prefire maps, recoil master).
- Keep **cached results for the demo clips** so the demo survives bad Wi-Fi or rate limits.

**Performance metrics (CS2)**
- Data source: **FACEIT Data API v4** (free key from developers.faceit.com). Gives FACEIT ELO, skill level, lifetime stats, and match stats.
- Metrics: FACEIT level, ELO, ELO trend, K/D, K/R, HS%, ADR, win rate, matches played (last 20 matches + lifetime).
- Premier CS Rating isn't in an easy official API. Let users self-report it on their profile (optional) or skip.
- Store snapshots in TigerData hypertables so we can chart trends. If the API is down or the user isn't on FACEIT, fall back to seeded data. Mocking is totally fine for the hackathon.
- Smoke test: `node scripts/test-faceit.mjs <nickname>` (see repo).

**Scouting thresholds**
- Two tracks, player track is the focus:
  - **Player track** example rule: FACEIT Level 10 AND ELO ≥ 2,500 AND K/D ≥ 1.25 AND HS% ≥ 50 AND ADR ≥ 85 over last 20 matches AND avg AI clip score ≥ 80.
  - **Creator track** (secondary) example rule: 30-day follower growth ≥ X%, engagement rate ≥ Y%.
- Rules live in a config file (JSON), not hardcoded, so we can tune live.
- When a rule passes: generate a scout report (LLM writes a short summary from stats + best clips), insert into `scout_reports`, show it on the recruiter dashboard.

**Recruiter / admin dashboard (FaZe side)**
- Prospects sorted by score, filters (player vs creator, level, region).
- Prospect detail: scout report, stat trend charts, top clips with coaching notes, status (new → reviewing → contacted → passed).
- **Voice briefing:** ElevenLabs text-to-speech reads the scout report summary out loud ("Here's your new prospect...").
- Admin extras (if time): edit threshold config, moderate community posts.

**ElevenLabs voice coach (P1, ElevenLabs main track)**
- "Talk to your coach" button on the clip report page. An ElevenLabs conversational agent gets the player's latest coaching report and stats as context, answers questions, explains mistakes, and suggests drills.
- Post-match only. Real-time in-game coaching needs screen capture and is out of scope.
- Fallback for demo: a pre-recorded audio clip if the live agent fails.

### 5.3 Social + Community (Dahiya)

**Goal:** a Reddit-style space that keeps people coming back.

- Boards: `FaZe CS2`, `Clips`, `Talent Watch`, `FaZe History`, `Events`.
- Threads with title, body, optional attached clip (references Joe's `clips` table), upvotes, nested comments.
- Sort: hot / new / top.
- Event threads for FaZe CS2 matches (manually seeded for demo).
- **Returning-fan foundation** (team brainstorm will expand this, build these as the base):
  - `FaZe History` board seeded with posts from the FaZe Timeline resource (one per era) so new fans get the lore.
  - "Recreate the classic" challenge thread type: a challenge post with a prompt + clip submissions + upvote leaderboard. Built generic so future challenge ideas plug in.
- Basic moderation: report button, simple keyword filter.

### 5.4 Profile / Portfolio + Leaderboards (Omar)

**Goal:** a public gamer resume that doubles as the leaderboard and what recruiters see.

- Public profile at `/u/:handle`: avatar, bio, linked accounts (FACEIT, Steam, socials), FACEIT level badge + ELO, key stats, trend charts, top clips with coaching scores, social stats, community karma.
- "Scout progress" bar showing how close the player is to the threshold (reads Yao's scoring, doesn't recompute it).
- Leaderboards: by ELO, by AI clip score, by improvement (biggest ELO gain in 30 days), by creator growth, by community karma. Powered by TigerData continuous aggregates.
- Shareable profile card so players post it on socials = free marketing.

## 6. Priorities (judging criterion #3: prioritization)

| Priority | Scope |
|---|---|
| **P0** | Demo loop (§4) end to end with seeded data, user + recruiter/admin accounts, cached AI results as fallback |
| **P1** | ElevenLabs voice coach + scout voice briefing, real FACEIT data for linked accounts, leaderboards, recruiter status workflow |
| **P2** | Social stat import (YouTube/Twitch), creator scouting track, challenge threads, admin threshold editor |
| **Out of scope** | Real payments, real-time in-game coaching, games other than CS2, mobile app, demo (.dem) file parsing |

## 7. Shared Contracts (change only with a team check)

### 7.1 Repo layout (recommended)

```
/
├── web/                 React + Vite + TypeScript (UI shell: Joe)
│   └── src/features/    clips/  coaching/  community/  profile/  recruiter/
├── server/              Express + TypeScript
│   └── src/
│       ├── routes/      clips.ts  coaching.ts  community.ts  profiles.ts  scouting.ts  voice.ts
│       ├── db/          schema.sql  seed.ts  client.ts
│       ├── config/      scouting-rules.json
│       └── lib/         ai/  faceit/  social/  voice/
├── scripts/             test-faceit.mjs and other smoke tests
├── api/index.ts         Only if hosting on Vercel: function entry that exports the Express app
├── CLAUDE.md / AGENTS.md
└── REQUIREMENTS.md
```

Keep the Express app itself host-agnostic (`server/src/app.ts` exports the app, `server/src/index.ts` calls `listen`). Then it runs locally, on a VM, or as a Vercel function without changes.

### 7.2 Database (TigerData / Postgres)

Regular tables:

- `users` (id, handle, display_name, avatar_url, role: `user` | `recruiter` | `admin`, created_at)
- `game_accounts` (id, user_id, game = `cs2`, faceit_nickname, faceit_player_id, steam_id64, region, faceit_level, faceit_elo, premier_rating nullable)
- `social_accounts` (id, user_id, platform, handle, url)
- `clips` (id, user_id, blob_url, thumbnail_url, game, map, side, title, social_post_url, status: `uploaded` | `analyzing` | `done` | `failed`, created_at)
- `coaching_reports` (id, clip_id, overall_score, category_scores jsonb, notes jsonb, drills jsonb, model, created_at)
- `communities` (id, slug, name, description)
- `threads` (id, community_id, user_id, type: `post` | `challenge`, title, body, clip_id nullable, score, created_at)
- `comments` (id, thread_id, parent_id nullable, user_id, body, clip_id nullable, score, created_at)
- `votes` (user_id, target_type, target_id, value)
- `scout_reports` (id, user_id, track: `player` | `creator`, rule_id, summary, evidence jsonb, audio_url nullable, status: `new` | `reviewing` | `contacted` | `passed`, created_at)

Hypertables (time-series, this is where TigerData earns its prize):

- `player_stats` (time, user_id, game, metric, value) e.g. metric = `elo`, `kd`, `hs_pct`, `adr`, `win_rate`
- `social_stats` (time, user_id, platform, followers, views, engagement_rate)

Continuous aggregates: daily/weekly rollups of both for leaderboards and trend charts.

### 7.3 Coaching report JSON shape

```json
{
  "overall_score": 82,
  "category_scores": {
    "crosshair_placement": 85,
    "movement": 70,
    "spray_control": 78,
    "utility": 60,
    "positioning": 88,
    "decision_making": 79
  },
  "notes": [
    { "t": "00:07", "category": "movement", "severity": "high",
      "note": "Fired while still moving after the wide swing, first bullets went wide.",
      "fix": "Counter-strafe: tap the opposite direction key to stop, then shoot." }
  ],
  "drills": [
    { "name": "Counter-strafe + one-tap drill", "where": "aim_botz", "minutes": 10 }
  ],
  "summary": "Strong crosshair height, losing duels by shooting on the move."
}
```

### 7.4 API surface (starting point)

| Method | Route | Owner |
|---|---|---|
| POST | `/api/clips` (register uploaded clip) | Joe |
| GET | `/api/clips`, `/api/clips/:id` | Joe |
| POST | `/api/coaching/analyze/:clipId` | Yao |
| GET | `/api/coaching/:clipId` | Yao |
| GET | `/api/players/:userId/stats` | Yao |
| POST | `/api/players/:userId/sync` (pull fresh FACEIT stats) | Yao |
| GET | `/api/scouting/prospects`, PATCH `/api/scouting/prospects/:id` | Yao |
| POST | `/api/voice/session` (start ElevenLabs agent with context), POST `/api/voice/briefing/:reportId` | Yao |
| GET/POST | `/api/communities/:slug/threads`, `/api/threads/:id/comments`, `/api/votes` | Dahiya |
| GET | `/api/profiles/:handle`, `/api/leaderboards/:type` | Omar |

### 7.5 Accounts and auth (hackathon version)

Two account types: **user** (players/fans) and **recruiter/admin** (FaZe staff). Demo login picker with seeded accounts (a fan, a returning fan, the prospect, a FaZe recruiter, an admin). Store the user id in a cookie/header and gate recruiter/admin routes by role. Real auth only if time allows.

### 7.6 Seed data

`server/src/db/seed.ts` creates: ~15 users across roles, CS2 accounts from FACEIT Level 5 to Level 10, 30 days of stat history per player, ~20 clips with cached coaching reports, 5 boards with threads/comments, FaZe History posts, one challenge thread, and **one prospect just under the threshold**.

## 8. Assumptions and decisions

| Topic | Decision |
|---|---|
| Player data | FACEIT Data API v4 for real data, seeded/mocked data as fallback. Mocking is fine for the MVP. Leetify's API asks apps not to store its data, so it's display-only if we use it at all |
| Scouting consent | **Assumed** for the MVP: every user is treated as opted in. Pitch mentions a real opt-in toggle for production |
| Age / minors | **Assumed** 18+ for the MVP. Pitch mentions guardian consent for production |
| Game | CS2 only for the demo; design stays game-agnostic |
| Focus | Streamlining recruitment of top talent. Creator scouting is secondary |
| Hosting | **Open.** Default Vercel (frontend + Express as a function). Alternatives: run locally for the demo, or host on Vultr (that's also an MLH prize track). Keep the server host-agnostic (§7.1) |
| Returning fans | Foundation features in §5.3, more ideas after team brainstorm |

## 9. Risks

1. **Video + serverless limits** (if on Vercel): direct-to-blob uploads, short clips, raise function `maxDuration`, keep cached demo results.
2. **AI hallucination:** ground prompts with real stats, force JSON schema, label it as AI feedback.
3. **API keys/rate limits:** every external call (Gemini, FACEIT, ElevenLabs, YouTube/Twitch) has a cached fallback.
4. **Scope:** P0 loop is the contract. Integration checkpoint every few hours.

## 10. Revenue model (judging criterion: "how it generates meaningful revenue")

| Stream | How | Notes |
|---|---|---|
| **Coaching subscription** | Free tier (a few clip reviews/week) + paid "FaZe Pro": unlimited reviews, deeper reports, voice coach | Voice coach is the premium hook |
| **Sponsored talent hunts** | Brands fund seasonal challenges ("Road to FaZe, presented by X") with prizes | Proven by FaZe5/FaZe1 sponsor deals; likely the biggest money lever |
| **Ads** | Ads in community feed and free tier | Standard, low effort |
| **Talent pipeline value** | Cheaper, data-backed scouting for FaZe Up Next; finder's fee when other orgs sign talent FaZe passes on | Recruitment is the hook and cost saver, not the main cash line |
| **Merch / drops** | Limited drops tied to challenges and leaderboard seasons | Mention, don't build |

Pitch framing: recruitment is the **hook** that drives engagement and growth; subscriptions and sponsored hunts are the **revenue**.

## 11. Judging criteria map

| Criterion | Where we hit it |
|---|---|
| 1. Target audience + problem | §3 table, recruiter persona, returning vs new fan hooks |
| 2. Creativity of concept | Always-on FaZe5 feeding FaZe Up Next, voice coach + voice scout briefings |
| 3. Prioritization | §6 P0/P1/P2 table, show it on a slide |
| 4. Technical feasibility + MVP quality | Working demo loop, TigerData time-series, AI coaching with JSON schema |
| 5. Engagement + growth potential | Scout progress bar, leaderboards, shareable profile cards, sponsored hunts |

## 12. Tracks

- **FaZe Challenge** (main)
- **ElevenLabs** (main): voice coach + scout voice briefings
- **MLH, stack what fits:** Best Use of Gemini API (clip analysis), Best Use of Tiger Data (hypertables + continuous aggregates), Best Use of Vultr (if we host there), GoDaddy Registry domain, DEV Writing Challenge (post a write-up after)

## 13. Deliverables checklist (from the challenge guide)

- [ ] Working MVP
- [ ] The user problem
- [ ] Proposed experience + priority features
- [ ] Who it's for: new fans, returning fans, or both
- [ ] Why it resonates with them
- [ ] How it generates meaningful revenue
- [ ] Devpost submission + demo video

## 14. Open questions (owners fill in)

- Joe: which blob storage? which social platforms get real API vs mocked?
- Yao: final threshold numbers? Gemini model + per-clip cost for the revenue slide? ElevenLabs agent setup (context via prompt override or dynamic variables)?
- Dahiya: final boards list? polling vs realtime for threads?
- Omar: which leaderboards make the cut? share card format?
- Everyone: product name, hosting choice, returning-fan brainstorm, final submission time, who records the demo video?
