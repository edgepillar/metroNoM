# metroNoM

**tick tock, next momentum**

A live, cinematic view of the Zenon Network of Momentum, streamed straight from public nodes into the browser.
In the spirit of mononaut's "tick tock, next block" for Bitcoin.

**Live:** LIVE_URL

One static HTML file. No backend, no application dependencies, no analytics. The page talks to public `znnd` nodes over
WebSocket JSON-RPC and to mempool.space for Bitcoin. If no node is reachable it says so and plays a clearly
labelled simulation until one comes back.

## Scenes

The page cycles through them, cutting on the arrival of each new momentum. Add `#<id>` to the URL to stay on one.

| id | what it shows |
|---|---|
| `blocks` | account blocks of recent momentums as a mosaic, plus incoming blocks over time |
| `chain` | the momentum chain as cubes, each block arcing back to the momentum it acknowledged |
| `glyphs` | every momentum hash as a 16×16 glyph, one tile per 10 s slot, missed slots crossed out |
| `dial` | the current election round: 30 slots, who produced each, who missed |
| `constellation` | pillars as stars; each round of 30 slots draws its own figure |
| `waterfall` | slots flowing down, pillars across: a spectrogram of block production |
| `clocks` | Bitcoin (work, irregular) and Zenon (schedule, every 10 s) side by side |
| `loom` | account chains as threads, send → receive links across them |
| `timeline` | the last 24 hours and the current epoch |
| `epoch` | the epoch as a rug of 8,640 slots (save it as a PNG) |
| `heat` | which blocks paid plasma with proof of work, and which used fused QSR |
| `lostlink` | today's slot clock next to a simulation of the 2020 whitepaper's PoW-paced epochs |
| `spiral` | the whole history spiralling out of Bitcoin block #710,968, which Zenon's genesis commits to |
| `history` | time-lapse since genesis |
| `pillars` | pillars by weight, flashing as they produce |

Between scenes: a Bitcoin interstitial when a new Bitcoin block lands, and a short glitch when a slot is missed.

## Options

| URL | effect |
|---|---|
| `?node=wss://a:35998,wss://b:35998` | use these nodes (in order, with failover) |
| `?pillar=<name>` | highlight one pillar everywhere |
| `?btcapi=https://your-mempool` | another mempool.space-compatible instance |
| `?overlay` | transparent stream overlay with a ticker bar; add `#dial` (or any id) to hold one scene |
| `?calm` | no glitch, no beat kick (also enabled by reduced-motion preferences) |
| `?sim` | force the labelled simulation |

Keys: `1`–`9` scenes · `←`/`→` step · `0` auto · `Space` pause · `N` time notary · `M` sound · `F` fullscreen.

**Time notary** (`N`, or click a block in the mosaic): paste an account block hash or a `z1…` address. The selected public node reports the momentum it acknowledged and the momentum that confirmed it. Bitcoin timestamps provide context. The copied JSON is an observation, not an independently verified inclusion, finality or timestamp proof. The lookup is sent to the selected node.

**OBS:** add a Browser Source with `LIVE_URL/?overlay&calm#dial` (or no hash to cycle), 1920×1080,
transparent background is automatic.

## Run locally

Any static server works, e.g. `python3 -m http.server` in this folder, then open `http://localhost:8000/`.

Tests (mock node, locked-down embed, Playwright smoke test) live in `test/`:

```sh
cd test && npm ci --ignore-scripts && npx playwright install chromium
npm run regression                 # failure and recovery controls
npm run smoke                      # local mock fixtures
npm run smoke:prod -- LIVE_URL     # against a deployment
```

See `docs/DATA-MODEL.md` for the RPC calls and the time model, and `docs/ARCHITECTURE.md` for the code map.

## Hosting and privacy

Vercel runs `node scripts/build.mjs` and serves only the generated `public/index.html`. The script verifies the CSP hash before producing output. Repository files and tests are excluded independently of the upload ignore file.

The page uses local system fonts. Its network connections are the selected public Zenon node and Bitcoin instance; their operators can see connection metadata. Notary lookups send the entered public address or block hash to the selected node. No wallet, signing, cookies, analytics or browser storage are used. Custom endpoint overrides accept HTTPS and WSS; plain HTTP and WS are limited to local development.

[Zenon Observatory](https://0x3639.com/go-zenon-version/) provides complementary peer-version and production observations. It does not replace the detailed ledger RPC calls or Bitcoin data required by every scene.

See `docs/REVIEW.md` for findings, release checks and remaining limitations. No license has been added.
