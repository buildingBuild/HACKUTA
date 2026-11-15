# RGB Sync: clip-synced keyboard lighting (design)

Date: 2026-11-15 · Owner: Yao · Status: approved in chat

## Intent

Show the "RGB Sync" pillar of FaZe HQ (REQUIREMENTS §5.2) for real at the demo. A FaZe vs [team] CS2 highlight clip plays on `/rgb`. At each key moment (round win, ace, loss, match win), Yao's laptop keyboard lights up in sync with the clip. An on-screen virtual keyboard shows the same effects, so anyone without the hardware sees them too.

## Goals

- `/rgb` is a real page: a YouTube highlight clip, an on-screen virtual keyboard plus light bar, and a list of the clip's moments.
- Moments fire in sync with the video's playhead. They fire on both the virtual setup and the real keyboard, through the local companion.
- While the clip plays, the board rests on **dim FaZe red** (hardware brightness 1). Each effect flashes at full brightness and returns to it. Pausing or ending the clip, or quitting the companion, turns the lights **off**. *(Change requested after first hardware test; originally "off after each effect".)*
- Marking mode: while the clip plays, press W, A, L or M to record moments, then copy or save them, so the timings can be fine-tuned.

## Non-goals

- The keyboard does **not** react to the live banner, `/api/live`, the demo match or the director console. This is scoped to this feature only. Teammates never need the companion.
- No per-key effects (the keyboard has 4 zones plus a light bar), no other brands or OpenRGB, no sockets, no server changes.

## Anti-goals

- The page must not break or look empty when the companion is off. It falls back to the virtual setup with a clear "keyboard not connected" note.
- Nothing native (`node-hid`) may enter the root npm workspaces, or the Railway install.

## Constraints and findings (from testing on the ROG Strix G16 G614JIR)

- **OpenRGB 1.1 is not usable.** It has no profile for the G614JIR, and its fallback crashes on most launches. Its Direct mode turned the LEDs off.
- **The ASUS Aura HID protocol works directly through `node-hid`.**
  - Device: VID `0x0B05` / PID `0x19B6`.
  - Interface: usage page `0xFF31`, usage `0x79`. Usage `0x76` rejects these commands.
  - Commands are 64-byte feature reports:

    | Command | Bytes |
    |---|---|
    | init | `5D` + `"ASUS Tech.Inc."` |
    | brightness | `5D BA C5 C4 <0-3>` |
    | mode | `5D B3 <zone=0> <mode> R G B <speed E1/EB/F5> <dir> 00` |
    | set | `5D B5` |
    | apply | `5D B4` |

  - Brightness 0 means off.
- **Speed:** one update takes about 2 ms, but the keyboard renders rapid colour changes choppily. Use the keyboard's built-in modes for smooth animation: 0 = static, 1 = breathing, 2 = colour cycle, 10 = strobe/pulse (to verify). Keep host-driven flashes at about 4 Hz or slower.
- **Armoury Crate** kept running during the tests without conflict. It may reapply its own effect later; if so, close it for the demo.

## Approaches considered

1. **OpenRGB SDK.** Covers the most brands, but it crashes and has no profile for this laptop. Rejected.
2. **Windows Dynamic Lighting (LampArray).** Built into Windows, but only the foreground app gets control unless it's a packaged app. On stage the browser is in the foreground. Rejected; kept as an idea only.
3. **Direct Aura HID from a local Node companion: chosen.** Tested working, and it needs no extra installs.

For the trigger, we first planned to poll `/api/live`. The user narrowed scope to "only this feature", so the browser drives the companion directly from the clip's playhead.

## Design

**Companion** (`companion/`, a standalone package, not in the root workspaces)
- Start it with `cd companion && npm install && npm start`. It runs with `tsx` or plain Node ESM.
- `aura.ts`: driver with `init()`, `off()`, `color(r, g, b)`, `mode(m, r, g, b, speed)`. It finds the device by usage page and usage.
- `effects.ts`: effect name → sequence. Every sequence ends in `off()`.

  | Effect | Sequence |
  |---|---|
  | `round_win` | red breathing, about 2 s |
  | `round_loss` | dim red, 1 s |
  | `ace` / `clutch` | red/white at about 4 Hz, 2 s |
  | `match_win` | colour cycle, 4 s |
  | `match_start` | white, then red |

  A new effect cancels the running one.
- HTTP server on `127.0.0.1:7777`:
  - `GET /status` returns `{ ok, device }`.
  - `POST /effect {type}`.
  - CORS plus `Access-Control-Allow-Private-Network: true`, so the page works from localhost or the deployed site.
  - A device that's missing returns `device: false`, and the server keeps running.
- `npm run test-fx -- ace` fires one effect from the CLI.
- On SIGINT/exit it calls `off()`.

**Web** (`web/src/features/rgb/`)
- `RgbPage.tsx`:
  - The YouTube IFrame API player.
  - A requestAnimationFrame loop that reads `getCurrentTime()` and fires cues it crosses. Seeking resets which cues have fired.
  - The cue list (click to jump).
  - Companion status (polls `/status` every 3s).
- `VirtualKeyboard.tsx`: a CSS keyboard with 4 zones plus a light bar. It plays the same effect names with CSS animations and returns to off/dark.
- `clip.ts`: video id, title, opponent, and `cues: {t: seconds, type}[]`.
- `companion.ts`: `fetch('http://127.0.0.1:7777/...')` with a short timeout; failures fall back silently.
- Marking mode: a toggle. W/A/L/M add a cue at the current time, and "Copy cues" copies the JSON.
- `/rgb` routes to `RgbPage` in `App.tsx`. `features.ts` sets RGB Sync to `status: 'live'`.

**Clip choice and cues (builder's call):** a recent FaZe CS2 highlight video against a well-known team. Draft cue times from the casters' commentary in the auto-captions, then fine-tune with marking mode.

## Left to the builder

- The exact clip, the cue times, the virtual keyboard look (FaZe theme tokens), and the exact effect timings.
- Whether `mode 10` really strobes on this firmware (fall back to host-driven flashes).
