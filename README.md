# FaZe HQ

**Your clips. Your community. Your place in FaZe culture.**

Built for **HackUTA 2026**.

FaZe HQ brings gameplay, creators and community into one home base for new fans and people who grew up with FaZe. Link your video sources, let the pipeline find the moments worth watching, and land on your own HQ with a playable reel organized into categories that make your best content easier to find and share.

Beyond your profile, a mixed-media Feed puts fan clips, discussions, challenges and FaZe videos into one scroll. Human mentorship, community rewards and an interactive history tree give fans places to contribute, improve and explore.



---

## What it does

1. **Bring your content.** Link Twitch, YouTube or a local recordings folder. The pipeline finds, cuts and categorizes your best moments.
2. **Build your HQ.** Get a personal profile with a categorized reel of your best moments.
3. **Find your community.** Scroll a Feed powered by fan posts, Reddit discussions, videos, challenges and watch rooms. Join a conversation or give people something to talk about.
4. **Take the next step.** Request human mentorship, earn community rewards, climb the leaderboards and explore FaZe's history.

## Why it matters

**Bring the old fans back. Give the next generation somewhere to start.** People who grew up with FaZe remember more than match results: trickshots, montages, personalities and a community that made creating feel possible. HQ reconnects that history with what fans are watching and making today. Returning fans bring the stories; new fans bring their own content and perspective.

Clipping a moment and posting it is only the beginning. A clip library can store your plays, and a content feed can give them views, but neither alone gives you useful feedback, people to build with or a clear next step. HQ connects those pieces: **find the moment → build your reel → share with the community → get feedback → improve.** Human mentorship gives that path somewhere to lead beyond another upload.

**FaZe helped turn gamers into some of the internet's biggest creators. Why shouldn't it be where the next ones get started?** HQ makes that ambition accessible before someone has an audience. You can arrive with recordings, find something worth sharing and start participating. Discovery and recruiting are possible outcomes, alongside learning, collaboration and belonging.

The Feed keeps those paths connected. Community discussions, Reddit conversations, reels, challenges and FaZe videos sit together in one scroll. A clip can start a debate; a debate can inspire a challenge; a challenge can give someone their next video idea. The goal is a reason to return and contribute, with fresh content coming from the community itself.

## How clip analysis works

```text
Twitch / YouTube / local folder
              |
              v
    yt-dlp + ffmpeg preparation
              |
       +------+------+
       |             |
       v             v
  Audio signals   ElevenLabs Scribe
  Loudness and    Words, timestamps,
  sharp bursts    speakers, audio events
       |             |
       +------+------+
              v
    Scoring rules propose moments
              |
              v
    TigerData stores timed signals
              |
              v
    AI agent inspects candidates
              |
              v
    ffmpeg cuts clips + thumbnails
              |
              v
      Pro / Funny / Content reel
```

### ElevenLabs: hear what makes the moment matter

**ElevenLabs Scribe turns reactions into signals.** It transcribes stream audio with timestamps, speaker labels and events like laughter. We can locate the joke after a fail or the reaction after a clutch, giving the agent context that gameplay frames alone cannot provide.

### TigerData: turn a recording into a searchable timeline

**TigerData makes hours of footage queryable by the second.** Loudness, sharp bursts, speech and laughter become half-second signals in a TimescaleDB hypertable. The agent queries the buildup, action and reaction around each candidate moment instead of reviewing footage blindly.

It also stores processing progress, clip boundaries, categories, scores and explanations, so completed analysis can be reused instantly. Beyond clips, TigerData connects community activity, creator history, mentorship requests and the points ledger.

### Gemini API: see the moment and make the call

**The Gemini API turns candidate moments into a curated reel.** The agent queries signals, searches the transcript and watches video segments to choose what to keep, where to cut and how to categorize it. Each clip gets a title, content score and explanation.

### ffmpeg: make the reel playable

**yt-dlp gets the footage; ffmpeg makes the clips.** Twitch and YouTube recordings are downloaded, or local files enter directly. ffmpeg extracts audio, cuts the selected moments into MP4s and generates thumbnails, ready for the onboarding collage and the player's HQ.

## Tech stack

- **Frontend:** React, Vite and TypeScript, with CSS and SVG animations.
- **Backend:** Node.js, Express and TypeScript, serving the API and production frontend from one service.
- **Data:** TigerData / PostgreSQL, TimescaleDB hypertables and continuous aggregates.
- **Analysis:** ElevenLabs Scribe and the Gemini API, with a selectable OpenAI provider.
- **Video:** `yt-dlp`, `ffmpeg` and `ffprobe`.
- **Integrations:** YouTube and Reddit feeds with cached fallbacks; FACEIT with mock fallback; an optional local RGB companion using `node-hid`.

---

Built by **Joe, Yao, Dahiya and Omar** for HackUTA 2026.

## Screenshots

<p align="center">
  <img src="https://github.com/user-attachments/assets/ea994389-1d1e-462c-a895-dd1e36e99083" alt="FaZe HQ screenshot 1" width="49%">
  <img src="https://github.com/user-attachments/assets/6a050817-4402-49e0-bec4-4e48116bb68a" alt="FaZe HQ screenshot 2" width="49%">
</p>
<p align="center">
  <img src="https://github.com/user-attachments/assets/8ef2d3a0-665a-4ead-9c82-671d2facb324" alt="FaZe HQ screenshot 3" width="49%">
  <img src="https://github.com/user-attachments/assets/83a17200-1e42-49f3-bd4d-5b05fb50ed04" alt="FaZe HQ screenshot 4" width="49%">
</p>
