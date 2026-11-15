# FaZe HQ RGB companion

A small local app that lets the `/rgb` page light up a real keyboard. It's optional: without it, the page shows the virtual keyboard.

```bash
cd companion
npm install
npm start               # RGB companion on http://127.0.0.1:7777 (keyboard: found)
npm run test-fx -- ace  # fire one effect: round_win, round_loss, ace, clutch, match_win, match_start
npm test
```

**Supported hardware**
- ASUS ROG laptops with an Aura keyboard (USB `0B05:19B6`), driven directly over HID.
- Tested on the ROG Strix G16 G614JIR: 4 zones plus the light bar.
- Other keyboards report `keyboard: not found`. The server still runs, and the page falls back to the virtual setup.

**API** (binds to `127.0.0.1` only)

| Method and path | Returns |
|---|---|
| `GET /status` | `{ ok, device }` |
| `POST /effect {"type":"round_win"}` | `{ played }` |

**Notes**
- The lights go off after every effect, and when you stop the companion with Ctrl+C.
- Armoury Crate can stay open. If it ever repaints the keyboard mid-demo, close Armoury Crate.
- This is not an npm workspace on purpose. `node-hid` is native, so teammates and Railway never install it.
