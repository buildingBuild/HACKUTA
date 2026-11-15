# FaZe HQ: Requirements Doc (V3, fan hub)

HackUTA 2026 · FaZe Challenge: "Be the CTO of FaZe Clan" (main track) + MLH tracks we can stack
Team: Joe, Yao, Dahiya, Omar
Stack: React + Vite + TypeScript · Node.js (Express) · TigerData (Postgres + TimescaleDB). Hosting: one always-on Node service (Railway), see §8
Game focus: **Counter-Strike 2** (design stays game-agnostic: `cs2 | r6 | cod`)

> This doc is the shared source of truth for humans and agents. Owners can flesh out their own feature section, but anything in **Shared Contracts (§7)** needs a quick team check before it changes.
>
> **V3 pivot (Nov 15).** AI clip coaching, the ElevenLabs voice coach, AI scout-report writing and coaching subscriptions are **removed** (old code is at git tag `pre-pivot`). Recruiting and player metrics stay, moved into their own staff-only tab.

---

## 1. One-liner

**FaZe HQ is the fan hub that puts FaZe into fans' everyday gaming life.** A pro broadcast HUD on your stream, RGB lights that flash red when FaZe wins a round, a daily FaZe Guessr, and a shared pixel wall that paints faster when FaZe plays well. Every feature quietly puts the FaZe brand on fans' screens, streams and rooms, and rebuilds the hype FaZe had in its early years.

## 2. Why this fits FaZe right now

- Judges' feedback: rebuild hype, make the social side different from other platforms, and don't lean on AI as the main feature.
- Recruiting has been done before (#FAZE5 in 2013, 2014 and 2020, and FaZe1 in 2022), so it stays as a supporting tab, not the pitch.
- FaZe refocused on esports in 2026 (creator division closed in Jan, FaZe Up Next academy launched in Apr), and CS2 is the flagship. Live-match features tie fan attention to FaZe's competitive games.
- Reference: HardScope's lionsgateclub.com fan hub, with clear feature pillars and calls to action on the home page.

## 3. Target users

| User | What they want | What we give them |
|---|---|---|
| **Returning fans** (grew up on FaZe) | Nostalgia, a reason to care again | FaZe Guessr (legendary plays), FaZe History board, The Wall |
| **Esports fans** | Feel part of FaZe's live matches | Live banner, RGB Sync, The Wall hype mode, match threads |
| **Small streamers** | Look pro for free | FaZe-branded Broadcast HUD (CS2 Game State Integration) |
| **Players** | Show off, get noticed | Profile with game stats, public leaderboards; Recruiting tab on FaZe's side |
| **FaZe recruiters / admins** | Find talent; run live moments | Recruiting tab (prospects, thresholds), Director console (Phase 2) |

## 4. The demo (what judges experience)

1. Home page with the live banner: "FaZe is live: 9 to 7 vs Vitality."
2. Admin hits **round win** on the director console. At once: an RGB keyboard/bulb flashes red, the on-screen virtual setup pulses, The Wall enters hype mode, and the banner score updates.
3. Judges scan a QR code and place pixels on The Wall from their phones.
4. Judges play today's FaZe Guessr.
5. Broadcast HUD plays a recorded CS2 session in OBS (live if we have CS2 running).
6. (Short) Recruiting tab: a recruiter syncs a player's FACEIT stats, the player crosses the threshold, and a new prospect appears.

Every external dependency has a fallback: recorded GSI replay, virtual RGB setup, seeded Guessr data, director console instead of a live feed, mock FACEIT data.

## 5. Phases

### 5.1 Phase 1: foundation (build first)

| Area | What | Done means |
|---|---|---|
| **App shell** | Top nav: Home, Community, Leaderboards, **Features ▾** (HUD, RGB Sync, Guessr, The Wall). User menu: Profile, Recruiting (staff), Admin (admin), demo login, sign out. Shared UI kit in `web/src/components/ui/` | Every nav link works (real page or branded "coming soon") |
| **Accounts + roles** | `user`, `recruiter`, `admin`. Demo login picker with seeded accounts; server-set session cookie. Guards on frontend and backend | Recruiting needs recruiter/admin; Admin needs admin; 401/403 from the API |
| **Home** (`/`) | Hero + "Join FaZe HQ" (opens onboarding at `/join`), live banner, one card per feature with a CTA, live counters. Fed by `GET /api/live` (mock now, event bus in Phase 2) | Looks finished with mock live data |
| **Community** | Boards, threads, nested comments, up/down votes, sort hot/new/top, Watch Together rooms, weekly Pulse digest (non-AI ranking) | Create thread, comment, vote, all saved to the DB |
| **Profile** (`/u/:handle`) | Fan profile: handle, avatar, bio (editable by owner), joined date, community activity. Optional **Game stats** card if FACEIT is linked. Slots for Guessr streak, pixels placed, synced-setup badge | Shows real user data |
| **Leaderboards** (`/leaderboards`) | Public FACEIT-based boards (ELO, 30-day improvement, karma). Guessr and Wall boards join in Phase 2 | Public page renders seeded data |
| **Recruiting** (`/recruiting`) | Prospect board, prospect detail (trends, criteria), threshold rules editor (admin). Data: FACEIT metrics + `player_stats` + scouting rules | Only visible to recruiter/admin |
| **Data + dev** | Schema baseline, seed, `.env.example`, one command to run | Fresh clone looks full after `npm run setup` |
| **Phase 2 contracts** | `LiveEvent` types in `shared/types.ts`; empty tables `live_events`, `pixel_events`, `guessr_puzzles`, `guessr_guesses` | Committed |

### 5.2 Phase 2: features

**Shared infrastructure (first)**
- **FaZe Live event bus:** one realtime stream of FaZe's live match (`LiveEvent`, §7.3) over socket.io, logged to the `live_events` hypertable. RGB Sync, The Wall and the Home banner subscribe.
- **Director console** (admin only, `/admin`): buttons for round win/loss, ace, clutch, match win, plus a score editor. In production this would be a real match data feed.
- **Companion app** (Node, runs on the user's PC, `node companion`): receives CS2 GSI, talks to local RGB devices, subscribes to the event bus, serves a setup page at `http://localhost:7777` (pick devices, download GSI cfg, copy OBS overlay URL).

**Broadcast HUD.** "Every CS2 streamer gets a pro tournament broadcast HUD for free, and it's FaZe branded." The companion generates `gamestate_integration_fazehq.cfg`, receives GSI POSTs, and diffs them into events (kill, death, 2K to ACE, round won/lost, bomb planted, MVP). The overlay is an OBS Browser Source (1920x1080, transparent) on a local WebSocket: kill feed, multi-kill stingers, round banner, health/money bar, "FAZE UP" on an ace. GSI is official and read-only (own player data only). **Fallback:** recorded GSI JSON + replay script.

**RGB Sync.** "When FaZe wins a round, every gamer's RGB setup turns red." Event to effect: round win = red pulse; ace/clutch = red/white strobe; match win = crest sweep; round loss = brief dim; your own kill (GSI) = quick flash. Devices: OpenRGB SDK (best coverage), Razer Chroma REST, Philips Hue bridge (about 10 commands/s), Govee LAN (UDP). **Fallback:** on-screen virtual setup on the website.

**FaZe Guessr.** "GeoGuessr, but every location is a legendary FaZe play." A daily screenshot from a famous moment; the player clicks the spot on the map radar and optionally picks the event/year. Score = `5000 * exp(-distance / scale)` + event bonus. The reveal shows the spot, the YouTube clip at a timestamp and a lore blurb. Wordle-style share, daily leaderboard. About 15 to 20 seeded moments with a click-to-set admin tool. Modes: Daily, Endless.

**The Wall.** "r/place, but FaZe's live results control how fast you can paint." 256x256 canvas, 16-color palette, one pixel per 60s cooldown. A FaZe round win starts hype mode (10s cooldown for a minute); an ace gives everyone a free pixel. The server holds a `Uint8Array` canvas, logs placements to the `pixel_events` hypertable (timelapse, stats, rollback), and broadcasts batches every 50 to 100 ms. Cooldowns are enforced server-side.

**Integrations (if time):** share a Guessr result / Wall screenshot into a thread; auto-post a match thread when the director starts a match.

### 5.3 Real data sources (connected after Phase 1 builds)

Each source gets an env key, a `*_MODE=live|mock` switch, a timeout and a seeded fallback.

| Source | Used for |
|---|---|
| FACEIT Data API v4 | Profile Game stats, Leaderboards, Recruiting thresholds |
| PandaScore (or similar) | Real FaZe match schedule / live status on Home |
| YouTube Data API, Twitch Helix | FaZe videos and live streams on Home, Community Watch rooms |
| Steam Web API | Link SteamID: avatar, CS2 hours; later the HUD companion |

## 6. Priorities

| Priority | Scope |
|---|---|
| **P0** | Phase 1 foundation; event bus + director console; The Wall; Guessr; RGB Sync virtual setup |
| **P1** | Broadcast HUD with recorded replay; real RGB device (OpenRGB or Hue); real FACEIT data; real match schedule |
| **P2** | Live CS2 HUD on stage; Govee/Chroma drivers; Guessr Endless/Era modes; Wall timelapse; community share integrations; YouTube/Twitch/Steam |
| **Out of scope** | AI coaching / AI editing, real payments, companion installer, multi-instance scaling (mention Redis in the pitch), mobile app |

## 7. Shared Contracts (change only with a team check)

### 7.1 Repo layout

```
/
├── shared/types.ts       Cross-cutting types (LiveEvent, LiveStatus, LiveCounters, Role). Type-only imports from web + server
├── web/                  React + Vite + TypeScript
│   └── src/
│       ├── components/   App shell, AppNav, RequireRole, ui/ kit, live/ (banner, counters, useLive)
│       └── features/     home/ onboarding/ community/ profile/ recruiting/ (Phase 2: hud/ rgb/ guessr/ wall/ admin/)
├── server/               Express + TypeScript
│   └── src/
│       ├── app.ts        Exports the app; serves web/dist in production
│       ├── index.ts      http server + listen (Phase 2 attaches socket.io)
│       ├── routes/       auth community profiles players scouting live admin clips
│       ├── db/           schema.sql leaderboards.sql migrate.ts seed.ts client.ts
│       ├── config/       scouting-rules.json
│       └── lib/          auth faceit scouting live (Phase 2: bus wall guessr)
├── companion/            Phase 2 local Node app (GSI + RGB)
├── scripts/              smoke tests
├── CLAUDE.md / AGENTS.md
└── REQUIREMENTS.md
```

### 7.2 Database (TigerData / Postgres)

Regular tables:
- `users` (id, handle, display_name, avatar_url, **bio**, role: `user` | `recruiter` | `admin`, created_at)
- `game_accounts` (id, user_id, game, faceit_nickname, faceit_player_id, steam_id64, region, faceit_level, faceit_elo, premier_rating)
- `social_accounts` (id, user_id, platform, handle, url)
- `clips` (id, user_id, blob_url, thumbnail_url, game, map, side, title, social_post_url, status, created_at): fan clips shared in Community
- `communities`, `threads`, `comments`, `votes`: Community
- `scout_reports` (id, user_id, track, rule_id, summary, evidence jsonb, audio_url, status: `new` | `reviewing` | `contacted` | `passed`, created_at). `evidence` holds `score`, `rule_label`, `criteria`, `metrics`
- `guessr_puzzles` (id, day date unique nullable, map, image_url, x, y (0..1 radar coords), event_name, year, youtube_url, t_seconds, blurb, choices jsonb, created_at)
- `guessr_guesses` (id, puzzle_id, user_id, x, y, event_choice, distance, score, created_at), unique (puzzle_id, user_id)
- *(legacy, unused since V3: `coaching_reports`. Never dropped: additive-only rule)*

Hypertables:
- `player_stats` (time, user_id, game, metric, value). Metrics: `elo`, `faceit_level`, `kd`, `kr`, `hs_pct`, `adr`, `win_rate`, `matches`
- `social_stats` (time, user_id, platform, followers, views, engagement_rate)
- `live_events` (time, id, match_id, type, game, opponent, faze_score, opp_score)
- `pixel_events` (time, user_id, canvas, x, y, color)

Continuous aggregates (`leaderboards.sql`): daily/weekly rollups for leaderboards and trend charts.

### 7.3 Live event contract (`shared/types.ts`)

```ts
type LiveEventType = "match_start" | "round_win" | "round_loss" | "ace" | "clutch" | "match_win" | "match_loss" | "match_end";
type LiveEvent = {
  id: string;
  type: LiveEventType;
  game: "cs2" | "r6" | "cod";
  opponent: string;
  score: { faze: number; opp: number };
  ts: number; // server time, ms
};
```
`GET /api/live` returns `{ status: LiveStatus, counters: LiveCounters }`. In Phase 2 the same data also arrives over socket.io (`live:event`, `live:status`), so UI components don't change.

### 7.4 API surface

| Method | Route | Access | Owner |
|---|---|---|---|
| GET | `/api/health` | public | shared |
| GET | `/api/auth/demo-users`, `/api/auth/me` | public | Yao |
| POST | `/api/auth/login` `{userId}` (sets cookie), `/api/auth/logout` | public | Yao |
| GET | `/api/live` | public | Yao |
| GET/POST | `/api/communities`, `/api/communities/:slug/threads`, `/api/threads/:id`, `/api/threads/:id/comments`, `/api/votes` | read public, write signed in | Dahiya |
| GET | `/api/community/pulse`, `/api/community/watch/rooms` | public | Dahiya |
| POST | `/api/profiles` (onboarding creates a user) | public | Omar |
| GET | `/api/profiles/:handle` (staff-only fields stripped for others) | public | Omar |
| PATCH | `/api/profiles/:handle` (bio etc., owner only) | owner | Omar |
| GET | `/api/leaderboards`, `/api/leaderboards/:type` | public | Omar |
| GET | `/api/players/:id/stats`, `/api/players/:id/account` | public | Yao |
| POST/PUT | `/api/players/:id/sync`, `/api/players/:id/faceit` | owner or staff | Yao |
| GET/PATCH | `/api/scouting/prospects`, `/api/scouting/prospects/:id`, `/api/scouting/progress/:userId` | recruiter/admin | Yao |
| GET/PUT | `/api/scouting/rules` | GET staff, PUT admin | Yao |
| * | `/api/admin/*` (director console in Phase 2) | admin | Yao |
| GET/POST | `/api/clips`, `/api/clips/:id` | read public, write signed in | Joe |

### 7.5 Accounts and auth (hackathon version)

Roles: `user`, `recruiter`, `admin`. The demo login picker lists seeded accounts (New Fan, Returning Fan, players, FaZe Recruiter, FaZe Admin). `POST /api/auth/login` sets an httpOnly `fazehq_user` cookie, which is the source of truth (same origin, so it also authenticates Phase 2 socket handshakes). An `x-user-id` header is still accepted for scripts and tests. Gate staff routes with `requireRole` on the server **and** `RequireRole` in the UI. Every user is assumed opted in and 18+ for the MVP.

### 7.6 Seed data

`npm run setup` (migrate + seed) creates: the demo login accounts, about 8 CS2 players from FACEIT Level 5 to 10 with 30 days of stat history, 5 community boards with threads/comments/challenge/watch rooms, existing prospects, and **one player just under the scouting threshold** (a FACEIT sync pushes them over). Phase 2 owners add their own seed modules (Guessr moments, etc.) and call them from `seed.ts`.

## 8. Assumptions and decisions

| Topic | Decision |
|---|---|
| AI | Not a main feature. No AI coaching, editing or scout-report writing. Templates instead of LLM text |
| Player data | FACEIT Data API v4 with mock fallback (`FACEIT_MODE=mock` is the default) |
| Live match data | Admin director console for the demo; real feed (PandaScore etc.) is optional |
| Hosting | **One always-on Node service** (Railway): Express serves `web/dist`, the API and socket.io on one origin. Vercel functions can't hold WebSockets. DB stays on TigerData |
| Realtime | socket.io, single instance. Multi-instance (Redis) is a pitch talking point only |
| Hardware/game access | Only through the local companion app (browsers can't reach local devices or receive GSI) |
| Consent / age | Assumed opted in and 18+ for the MVP |

## 9. Risks

1. **Live demo hardware:** the RGB device or CS2 may fail on stage. Virtual setup + recorded GSI replay are mandatory.
2. **Venue Wi-Fi:** every external call has a mock/seeded fallback, and the director console replaces live feeds.
3. **Realtime load at judging** (many phones on The Wall): server-side cooldowns, batched broadcasts, one instance.
4. **Scope:** Phase 1 foundation first, then the event bus, since three features depend on it.

## 10. Revenue model

| Stream | How |
|---|---|
| **Sponsored live moments** | Brands sponsor hype mode, ace stingers and RGB celebrations ("Ace, presented by X"). Every synced setup and HUD is ad inventory |
| **HUD / RGB theme packs** | Free FaZe theme; paid era packs and sponsor-branded packs |
| **Sponsored Guessr / Wall seasons** | Seasonal events with prizes, merch drops tied to Wall art and Guessr streaks |
| **Talent pipeline** | Recruiting tab: cheaper, data-backed scouting for FaZe Up Next |
| **Ads** | Community feed and Home |

Pitch framing: free tools put FaZe on millions of screens and rooms during every match; that attention is what sponsors buy.

## 11. Judging criteria map

| Criterion | Where we hit it |
|---|---|
| Target audience + problem | §3: returning fans, esports fans, small streamers |
| Creativity | RGB Sync + The Wall reacting to live FaZe results; Guessr through FaZe history |
| Prioritization | §6 P0/P1/P2, Phase 1 then Phase 2 |
| Technical feasibility | Event bus + hypertables (`live_events`, `pixel_events`), GSI companion, fallbacks |
| Engagement + growth | Daily Guessr, shared Wall, HUD on streams = free distribution |

## 12. Tracks

- **FaZe Challenge** (main)
- **MLH, stack what fits:** Best Use of Tiger Data (hypertables + continuous aggregates), Best Use of Vultr (if we host there), GoDaddy Registry domain, DEV Writing Challenge

## 13. Deliverables checklist

- [ ] Working MVP
- [ ] The user problem
- [ ] Proposed experience + priority features
- [ ] Who it's for: new fans, returning fans, or both
- [ ] Why it resonates with them
- [ ] How it generates meaningful revenue
- [ ] Devpost submission + demo video

## 14. Open questions

- Which real RGB device do we bring to judging (Hue bulb vs OpenRGB keyboard)?
- Who has CS2 on a laptop for a live HUD?
- Guessr: final list of 15 to 20 moments + screenshots.
- Railway account owner and domain.
