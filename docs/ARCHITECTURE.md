# Architecture of `index.html`

One self-contained file (~140 KB): CSS, markup and one classic `<script>` with no dependencies, a small static-output copy step
and no external JavaScript. Rendering is Canvas 2D, except the momentum chain scene, which is DOM elements with
CSS 3D transforms. Sound is generated with WebAudio (off until the user turns it on).

Line numbers below refer to the file as delivered (original SHA-256 in `docs/REVIEW.md`). They shift after edits; the
section banners (`/* ====…  scene: … */`) are the stable anchors.

## File layout

| Lines | Content |
|---|---|
| 1–13 | `<head>`: meta, inline SVG favicon, local system-font fallbacks |
| 14–179 | CSS: stage, scenes, HUD, status, nav, tooltip, epoch panel, notary, glitch keyframes, `html.overlay` mode |
| 181–225 | DOM: `#stage` with one `<section class="scene" id="s-<id>">` per scene, `#bfx` (Bitcoin interstitial canvas), `#epoch`, `#hud`, `#status`, `#nav`, `#tip`, `#scan`, `#ticker`, `#notary` |
| 226–1599 | script (sections below) |

## Script sections

| Line | Section | Key names |
|---|---|---|
| 228 | header + URL options + constants | `NODES`, `FORCE_SIM`, `FOLLOW`, `BTC_API`, `OVERLAY`, `CALM`, `BTC_ANCHOR`, `WINDOW`, `GENESIS_TS`, `TICK`, `ROUND`, `slotOf` |
| 253 | utils | `fit(canvas)` (DPR-aware sizing), `fmt*`, `esc`, colour helpers, `bus` (event emitter) |
| 277 | account block classification | `KINDS` (colours/labels), `embName`, `classify` |
| 305 | state | `S` (see below), `mkMomentum`, `ingest`, `setPillars` |
| 343 | node client | `class Node` (`open`, `call`, `batch`), `start`, `reconnect`, `onConnected`, `catchUp`, `loadOlder`, `loadGenesis`, `loadPillars`, `loadHistory` |
| 451 | simulation | `startSim` (only when no node is reachable or `?sim`; clearly labelled), retries all configured real nodes every 30 s and reloads only when one reports a fresh frontier |
| 485 | status / HUD | `setStatus`, `axes` (two time axes), `hud` |
| 496 | Bitcoin | `BT`, `btcMerge`, `btcRefresh`, `btcSocket`, `btcPoll`, `btcStart`, `btcSim` |
| 533 | particles | dot-matrix text for `INTRO` and `OUTRO` (three outro variants: tick tock / genesis phrases / Zeno paradox) |
| 618 | scene `blocks` (`BL`) | account block mosaic + incoming chart, hover tooltip, click → notary |
| 725 | scene `chain` (`CH`) | DOM/CSS-3D momentum cubes with hash-glyph texture, acknowledgement arcs |
| 814 | scene `timeline` (`TL`) | last 24 h + epoch bar (`#epoch` panel) |
| 865 | scene `history` (`HI`) | time-lapse since genesis |
| 911 | scene `pillars` (`PI`) | treemap by weight, live producer flash |
| 966 | slot helpers | `firstSlot`, `slotState` (shared by dial, rug and newer scenes) |
| 980 | scene `dial` (`DI`) | election round dial, 30 slots |
| 1037 | scene `clocks` (`BC`) | Bitcoin × Zenon two clocks |
| 1126 | scene `epoch` (`EPR`) | epoch rug 144 × 60, PNG export (live mode only) |
| 1171 | sound | tick/tock per momentum, silence on a missed slot, Bitcoin chime |
| 1195 | shared helpers | `pillarsByWeight`, `missedEpoch`, `hashBits`, `missColor`, `seeded` |
| 1205 | scene `glyphs` (`GL`) | 16×16 hash glyph per slot |
| 1239 | scene `constellation` (`CO`) | pillars as stars, one figure per round |
| 1277 | scene `waterfall` (`WF`) | slot × pillar spectrogram, missed-this-epoch bars |
| 1312 | scene `loom` (`LM`) | account chains as threads, send → receive links |
| 1352 | scene `spiral` (`SP`) | history spiral out of Bitcoin #710,968 |
| 1380 | scene `heat` (`HT`) | PoW plasma vs fused plasma |
| 1407 | scene `lostlink` (`LL`) | slot clock vs simulated 2020-whitepaper PoW epochs |
| 1443 | time notary | `NT`, `ntOpen`, `ntClose`, `ntRun`, `btcAt` |
| 1488 | cinema | `BX`/`drawBX` (Bitcoin interstitial), `watchSlots` + glitch, overlay `ticker` |
| 1526 | scene manager | `SC`, `PINNABLE`, `go`, `nextScene`, `frame` (the rAF loop), nav, keys, hash pinning, resize |
| 1587 | wiring + `boot()` (1594) | `bus` subscriptions, start-up order |

## Runtime flow

1. `boot()` reads the hash pin, calls `start()` and (unless `?sim`) `btcStart()`, waits up to 1.8 s for the
   display font, then plays the intro (or, with `?overlay`, skips it).
2. `start()` tries each node with a 7 s transport timeout and bounded RPC calls. If every node refuses within 1.5 s (a sandbox or CSP that
   blocks WebSockets) it switches to the simulation immediately; otherwise after 12 s, even if a socket opened but never answered RPC.
3. `onConnected()`: subscribe → frontier → last 1,000 detailed momentums → `markReady()` → pillars, history,
   back-fill to 8,640 momentums, genesis data. Timers: pillars every 60 s, frontier watchdog every 5 s.
4. Every new momentum goes through `ingest()` → `bus.emit('live', [...])`. Scenes react via `onLive` hooks;
   the manager uses the same event to cut scenes on the beat.
5. If the socket drops, `reconnect()` rotates through the node list with back-off and catches up from the
   last known height.

Events on `bus`: `ready`, `live`, `bulk`, `pillars`, `history`, `btcblock`, `missed`.

## State (`S`)

`ms` (momentum records, sorted by height, ≤ 8,640), `byH`, `bySlot`, `frontier`, `lastTs`, `pillars`, `prodName`
(producer address → pillar name), `missLog` (attributed misses, 3 h), `hist`/`hs` (history samples), `btc`
(Bitcoin tip height), `genesis`, `mode` (`connecting` / `live` / `sim`), `node`, `clockOff` (median offset
between momentum timestamps and the local clock), `ready`.

A momentum record: `{h, ts, hash, producer, slot, blocks:[classified account blocks], n, plasma, moved}`.

## Scene interface

```js
const XX = { id:'name', el:$('#s-name'), dur:16000, cv:$('#canvasId') };
XX.ready   = () => S.ready && …;          // may the manager show it yet?
XX.caption = () => '…';                   // HUD caption line
XX.enter   = function(){…};               // optional
XX.exit    = function(){…};               // optional
XX.frame   = function(el, dt, t, leaving){ const {ctx,w,h} = fit(this.cv); … };  // el: seconds in scene
XX.keep    = () => bool;                  // optional: hold the scene (e.g. while hovering)
XX.done    = el => bool;                  // optional: replaces the dur check
```

To add a scene: add a `<section class="scene" id="s-name"><canvas id="…" class="full"></canvas></section>` in
`#stage`, define the object near the other scenes (before the scene manager banner), add it to `SC.list`,
`PINNABLE` and `NAVL`, and, if it caches layout, reset that cache in the `resize` handler. Use
`w < 700` as the narrow-layout switch, as the other scenes do. Then run `npm run smoke` in `test/`.

## Modes and their guards

- **live**: real data; notary and epoch PNG export enabled.
- **sim**: labelled `SIMULATED DATA` in the status pill; no Bitcoin network calls; notary and PNG export
  disabled. Never shown silently.
- `?overlay`: transparent background, HUD/status/nav hidden, ticker at the bottom, `#stage` stops above the
  ticker. `?overlay#dial` (any pinnable id) holds one scene.
- `?calm`: no glitch and no beat kick (for people sensitive to flashing, and for streams).

## Deployment output

`scripts/build.mjs` checks the inline script SHA-256 against `vercel.json` and writes `public/index.html`. Unexpected files in that output directory cause a build failure. Vercel serves that directory only. There are no package installation steps or application dependencies in production.

The CSP authorizes the exact application script hash, permits the inline styles needed for animation and allows HTTPS/WSS data providers. Broad data transport is intentional for endpoint overrides; external JavaScript is not allowed. Query overrides reject credentials, fragments and insecure remote schemes.

`test/smoke.mjs --regression` covers stalled RPC, stale nodes, disconnection, watchdog recovery, simulation data separation, endpoint validation, dialog focus and notary trust labels. `METRONOM_TEST_MODULES`, `CHROME_PATH` and `SHOTS_DIR` can select separately managed local tooling and output without embedding private paths in source.
