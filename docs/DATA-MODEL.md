# Data sources and the time model

Everything on the page comes from two public sources, read directly by the browser. There is no backend,
no API key and no environment variable.

| Source | Transport | Used for | Required? |
|---|---|---|---|
| Zenon `znnd` public nodes | WebSocket JSON-RPC, `wss://<host>:35998` | momentums, account blocks, pillars, history, notary | yes (otherwise the page falls back to a labelled simulation) |
| mempool.space (or any compatible instance) | HTTPS REST + WebSocket | Bitcoin tip, recent blocks, the Bitcoin interstitial, notary Bitcoin bounds | no (Bitcoin parts stay empty) |
| Local system fonts | none | Arial and monospace fallbacks | no external font requests |

Default nodes (in this order, with failover): `wss://node.zenonhub.io:35998`, `wss://node.atsocy.com:35998`,
`wss://my.hc1node.com:35998`. Override with `?node=wss://a:35998,wss://b:35998`. On an HTTPS page only `wss://`
works: browsers block `ws://` from HTTPS pages as mixed content.

## Zenon JSON-RPC calls

All calls go over one WebSocket. `id` matching handles responses; batches (an array of requests in one message)
are answered with an array.

| Method | Params | Fields the page uses | Where |
|---|---|---|---|
| `ledger.subscribe` | `["momentums"]` | returns a subscription id; notifications arrive as `{method:"ledger.subscription", params:{subscription, result:[{hash, height, …}]}}` | `onConnected` |
| `ledger.getFrontierMomentum` | `[]` | `height`, `timestamp` | `onConnected`, watchdog every 5 s if notifications stall for 25 s |
| `ledger.getDetailedMomentumsByHeight` | `[height, count ≤ 1000]` | `list[].momentum.{height,timestamp,hash,producer}`, `list[].blocks[]` (account blocks, below) | initial 1,000; catch-up; back-fill to 8,640 (~24 h) |
| `ledger.getMomentumsByHeight` | `[height, count]` | `list[].{height,timestamp}`; momentum #1 `data` (base64) | history since genesis (240 samples in one batch); genesis data |
| `embedded.pillar.getAll` | `[0, 500]` | `list[].{name, producerAddress, weight, currentStats.{producedMomentums, expectedMomentums}}` | every 60 s |
| `ledger.getAccountBlockByHash` | `[hash]` | account block + `confirmationDetail.{numConfirmations, momentumHeight, momentumHash, momentumTimestamp}` | time notary |
| `ledger.getAccountBlocksByPage` | `[address, 0, 1]` | newest block of an address | time notary (address input) |

Account block fields the page reads: `blockType` (2 user send, 3 user receive, 4 contract send, 5 contract
receive), `address`, `toAddress`, `amount` (string, base units), `tokenStandard`, `token.{symbol,decimals}`,
`usedPlasma`, `fusedPlasma`, `difficulty` (> 0 means the plasma was paid with proof of work), `hash`,
`fromBlockHash` (a receive's link to its send), `momentumAcknowledged.height`.

Embedded contracts are recognised by address prefix `z1qxemdeddedx` followed by `pyllar`, `sentynel`, `stake`,
`plasma`, `lyquydyty`, `accelerat0r`, `t0ken`, `htlc`, `drydge`, `swap`, `sp0rk`.

`weight` is a decimal string in base units (÷ 1e8). `currentStats` is cached by the node and refreshes roughly
every 5 minutes, so "who missed a slot" is attributed with that delay: the page diffs consecutive pillar lists
(`setPillars`) and logs the pillars whose `expectedMomentums` rose more than `producedMomentums`.

## mempool.space endpoints

| Endpoint | Response used |
|---|---|
| `GET /api/v1/blocks` | 15 newest blocks: `height`, `timestamp`, `tx_count`, `extras.pool.name` |
| `GET /api/v1/blocks/{height}` | 15 blocks ending at `height` (back-fill) |
| `GET /api/blocks/tip/height` | plain-text height (45 s poll, backup for the socket) |
| `WS /api/v1/ws`, send `{"action":"want","data":["blocks"]}` | first message `{blocks:[…]}`, then `{block:{…}}` per new block |
| `GET /api/v1/mining/blocks/timestamp/{unix}` | `{height, hash, timestamp}` of the block at or before a time (notary) |

Change the instance with `?btcapi=https://your-mempool`. The REST endpoints answer cross-origin requests.

## Time model

| Constant | Value | Meaning |
|---|---|---|
| `GENESIS_TS` | `1637755200` (2021-11-24 12:00:00 UTC) | timestamp of momentum #1 |
| `TICK` | 10 s | one slot |
| `ROUND` | 30 slots (300 s) | one election round: the producer schedule for 30 slots |
| `EPOCH` | 86,400 s = 8,640 slots | epochs start at 12:00 UTC, counted from genesis |

- A momentum's `timestamp` is exactly the start of its slot, so `slot = (timestamp − GENESIS_TS) / 10`.
- `height` counts momentums, `slot` counts clock ticks. `missed slots = slot + 1 − height`. The HUD shows both
  axes and the missed share.
- `watchSlots()` declares a slot missed when no momentum for it has arrived 3.5 s after it opened (this drives
  the glitch and the red HUD flash). Late momentums still fill the slot when they arrive.
- The selected node reports the chain timestamps surrounding an account block: not before the momentum it acknowledged
  (`momentumAcknowledged`), not after the momentum that confirmed it. The notary maps both bounds to Bitcoin
  through the mempool timestamp endpoint. These are miner-reported timestamp correlations, not a cryptographic timestamp proof. The page does not independently verify account inclusion, chain canonicality, consensus finality or wall-clock creation time.
- Momentum #1's `data` field is base64 for
  `000000000000000000004dd040595540d43ce8ff5946eeaa403fb13d0e582d8f#We are all Satoshi#Don't trust. Verify`.
  The hash is Bitcoin block #710,968 (2021-11-23 11:01:13 UTC), about 25 h before Zenon genesis. The page reads
  it live and uses the built-in copy only in simulation.
- Bitcoin block timestamps are not monotonic (observed −1 s and −85 s steps). Code that orders Bitcoin blocks
  sorts by height, never by time.

## Observed on mainnet, 2026-11-16

These were measured during development and are useful as sanity checks, not as constants.

- All three default nodes answered over `wss://` at the same height, `go-zenon v0.0.10`, 98 pillars
  (10:35 UTC: momentum #14,675,533).
- Long-run missed share since genesis ≈ 6.57 %. The epoch that started 2026-11-15 12:00 UTC had ≈ 31 % missed.
- No account block paid plasma with proof of work in the preceding 24 h, so the Heat scene honestly shows "cold".
- mempool.space tip #976,106; the REST and WebSocket endpoints worked from a browser under the production CSP.

## Freshness and source boundaries

LIVE requires a frontier timestamp no more than 90 seconds behind or 30 seconds ahead of the browser clock, plus loaded detailed momentums. The watchdog checks freshness every five seconds and removes LIVE while reconnecting. Initial connection work has a 12-second deadline before explicit simulation. A socket that opens without RPC responses does not qualify as a usable node.

Simulation uses synthetic Zenon and Bitcoin data. Automatic fallback closes Bitcoin transport, aborts in-flight fetches and resets real Bitcoin data before generating the synthetic series. Recovery probes every configured Zenon endpoint and requires a fresh frontier before reloading. Forced `?sim` does not contact either public data provider.

## Complementary Observatory data

[Zenon Observatory](https://0x3639.com/go-zenon-version/) and its [OpenAPI specification](https://0x3639.com/go-zenon-version/openapi.json), inspected on 2026-11-16, expose peer discovery, self-reported software versions, projected slots, actual production and saved momentum intervals. Production snapshots include `generatedAt`, `status`, `complete`, `frontier` and coverage fields. Projections based on current RPC weights are not guaranteed future production.

The documented routes do not supply detailed account blocks, send/receive links, plasma fields, arbitrary account-block lookups or Bitcoin data. metroNoM therefore continues to use direct ledger RPC for those scenes and mempool.space for Bitcoin. The Observatory is a complementary reference, not an additional runtime dependency. Peer identity counts, IP counts, registered pillars and software versions must not be treated as interchangeable.
