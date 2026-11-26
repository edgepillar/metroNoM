# Data sources and the time model

Everything on the page comes from two public sources, read directly by the browser. There is no backend,
no API key and no environment variable.

| Source | Transport | Used for | Required? |
|---|---|---|---|
| Zenon `znnd` public nodes | WebSocket JSON-RPC, `wss://<host>:35998` | momentums, account blocks, pillars, history, notary | yes (otherwise the page falls back to a labelled simulation) |
| mempool.space (or any compatible instance) | HTTPS REST + WebSocket | Bitcoin tip, recent blocks, the Bitcoin interstitial, notary timestamp context | no (dependent scenes explain unavailable data) |
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
| `ledger.getDetailedMomentumsByHeight` | `[height, count ≤ 1000]` | `list[].momentum.{height,timestamp,hash,producer}`, `list[].blocks[]` (account blocks, below) | initial 1,000; catch-up; back-fill to 8,640 momentums |
| `ledger.getMomentumsByHeight` | `[height, count]` | `list[].{height,timestamp}`; momentum #1 `data` (base64) | up to 240 history samples in batches of 8; genesis; reconnect overlap check |
| `embedded.pillar.getAll` | `[0, 500]` | `list[].{name, producerAddress, weight, currentStats.{producedMomentums, expectedMomentums}}` | every 60 s |
| `ledger.getAccountBlockByHash` | `[hash]` | account block + `confirmationDetail.{numConfirmations, momentumHeight, momentumHash, momentumTimestamp}` | time notary |
| `ledger.getAccountBlocksByPage` | `[address, 0, 1]` | newest block of an address | time notary (address input) |

Account block fields the page reads: `blockType` (2 user send, 3 user receive, 4 contract send, 5 contract
receive), `address`, `toAddress`, `amount` (string, base units), `tokenStandard`, `token.{symbol,decimals}`,
`usedPlasma`, `fusedPlasma`, `difficulty` (> 0 reports proof-of-work plasma), `hash`,
`fromBlockHash` (a receive's link to its send), `momentumAcknowledged.height`.

Embedded contracts are recognised by address prefix `z1qxemdeddedx` followed by `pyllar`, `sentynel`, `stake`,
`plasma`, `lyquydyty`, `accelerat0r`, `t0ken`, `htlc`, `drydge`, `swap`, `sp0rk`.

`weight` is a decimal string in base units (÷ 1e8). `currentStats` is cached by the node and can lag production,
so attributed misses can be delayed: the page diffs consecutive pillar lists
(`setPillars`) and logs the pillars whose `expectedMomentums` rose more than `producedMomentums`.
Those counters are used by Waterfall, not as a substitute for loaded epoch coverage.

Detailed ranges must contain exactly the requested count, contiguous heights, strictly increasing aligned
timestamps, valid hash shapes and account-block arrays. Boundaries must agree with loaded adjacent records;
a conflicting known hash is rejected. These are response-shape and consistency checks, not proof verification.
Incomplete ranges cannot establish that intervening slots were missed. Initial failure rotates to another node;
failed older-history loads retry in the background. A reconnect compares the loaded frontier hash before
catching up. If the gap exceeds the retention window, it loads a new recent snapshot instead of replaying an
unbounded gap.

## mempool.space endpoints

| Endpoint | Response used |
|---|---|
| `GET /api/v1/blocks` | recent blocks: `height`, `id`, `timestamp`, `tx_count`, `extras.pool.name` |
| `GET /api/v1/blocks/{height}` | 15 blocks ending at `height` (back-fill) |
| `GET /api/blocks/tip/height` | plain-text height (45 s poll; periodic full refresh also repairs changed metadata) |
| `WS /api/v1/ws`, send `{"action":"want","data":["blocks"]}` | first message `{blocks:[…]}`, then `{block:{…}}` per new block |
| `GET /api/v1/mining/blocks/timestamp/{unix}` | `{height, hash, timestamp}` of the block at or before a time (notary) |

Change the instance with `?btcapi=https://your-mempool`. The REST endpoints answer cross-origin requests.
Blocks are ordered by height. A changed hash or timestamp at the same height replaces the cached block;
a snapshot whose highest block is below the current displayed tip is ignored. This keeps a lagging CDN
response from rewinding a socket update and replaying its announcement. The display reconciles replacements
once the source supplies them at or above its current height. A later socket update also supersedes an
in-flight HTTP snapshot. The block notification computes Zenon interval counts only for increasing miner
timestamps within a day and labels partial coverage.

## Time model

| Constant | Value | Meaning |
|---|---|---|
| `GENESIS_TS` | `1637755200` (2021-11-24 12:00:00 UTC) | timestamp of momentum #1 |
| `TICK` | 10 s | one slot |
| `ROUND` | 30 slots (300 s) | one election round: the producer schedule for 30 slots |
| `EPOCH` | 86,400 s = 8,640 slots | epochs start at 12:00 UTC, counted from genesis |

- A momentum's `timestamp` is exactly the start of its slot, so `slot = (timestamp − GENESIS_TS) / 10`.
- `height` counts momentums, `slot` counts clock ticks. Cumulative missed share uses the latest observed
  momentum: `1 − height / (observedSlot + 1)`. The clock axis can advance while this observation remains unchanged.
- A missing slot is **missed** only when it lies inside contiguous loaded height coverage, before a later
  observed momentum. Earlier unloaded slots are **unknown**. Slots after the last observation and up to the
  current clock slot are **pending**. Later slots are **future**. A delayed notification does not itself prove a miss.
- The epoch rug partitions exactly 8,640 slots into produced, missed, unloaded, pending and future.
  "With account blocks" is a subset of produced slots, not an additional category. Epoch fill is
  `produced / (produced + missed)` over observed coverage; unloaded and pending counts are disclosed.
  The mean interval is `(last.timestamp − first.timestamp) / (count − 1)` for loaded records in that epoch.
- `watchSlots()` triggers the missed-slot effect only after a later observation confirms a bounded gap.
  Bitcoin × Zenon intervals use slot starts in `[start, end)` and disclose unknown or pending coverage.
- Retention is 8,640 **momentums**, not a guaranteed 24 hours. Timeline and Heat separately filter by timestamp
  for their last-24-hour samples. History and Spiral interpolate sampled heights; their final point advances
  with the latest observed frontier rather than the ticking wall clock.
- History becomes usable after the first valid sample group instead of waiting for all groups. During loading,
  its point count and partial status remain explicit. The current observed frontier provides the endpoint.
  Incomplete sampling retries without overlapping loaders or replacing a richer partial sample with a smaller one.
- The selected node reports the chain timestamps surrounding an account block: not before the momentum it acknowledged
  (`momentumAcknowledged`), not after the momentum that confirmed it. The notary maps both bounds to Bitcoin
  through the mempool timestamp endpoint. These are miner-reported timestamp correlations, not a cryptographic timestamp proof. The page does not independently verify account inclusion, chain canonicality, consensus finality or wall-clock creation time.
- Momentum #1's `data` field is base64 for
  `000000000000000000004dd040595540d43ce8ff5946eeaa403fb13d0e582d8f#We are all Satoshi#Don't trust. Verify`.
  The hash is Bitcoin block #710,968 (2021-11-23 11:01:13 UTC), about 25 h before Zenon genesis. The page reads
  it live when that lookup succeeds. The configured mainnet reference remains available before the lookup
  and in simulation; displaying that reference alone does not prove that a live genesis lookup succeeded.
- Bitcoin block timestamps are not monotonic (observed −1 s and −85 s steps). Code that orders Bitcoin blocks
  sorts by height, never by time.

## Observed on mainnet, 2026-11-16

The following are the earlier initial-release observations, retained as dated evidence, not current constants.
See [the scene re-review](SCENE-REVIEW.md) for the later release and availability checks.

- All three default nodes answered over `wss://` at the same height, `go-zenon v0.0.10`, 98 pillars
  (10:35 UTC: momentum #14,675,533).
- Long-run missed share since genesis ≈ 6.57 %. The epoch that started 2026-11-15 12:00 UTC had ≈ 31 % missed.
- No account block paid plasma with proof of work in the preceding 24 h, so the Heat scene honestly shows "cold".
- mempool.space tip #976,106; the REST and WebSocket endpoints worked from a browser under the production CSP.

## Freshness and source boundaries

LIVE requires a frontier timestamp no more than 90 seconds behind or 30 seconds ahead of the reference
clock, plus loaded detailed momentums. The app takes UTC from a bounded same-origin HTTP `Date` request when
available and uses elapsed browser time to advance it. If the request fails, the device clock supplies UTC.
A separate small offset smooths the visual slot clock. On an established connection the watchdog can show
`NO RECENT MOMENTUM` while the node still responds with an old frontier. A fresh observation clears this
status. A socket or RPC failure triggers failover. Initial connection work has a 12-second deadline before
explicit simulation.

Simulation uses synthetic Zenon and Bitcoin data. Automatic fallback closes Bitcoin transport, aborts in-flight
fetches and resets real Bitcoin data before generating the synthetic series. Recovery requires a working
subscription and a complete, fresh snapshot that matches the node's frontier. It replaces the synthetic
state in the same tab, then restarts Bitcoin transport. Forced `?sim` does not contact either public provider.

A pinned scene with an unavailable dependency remains selected and displays a retry explanation. The intro
does not wait indefinitely for optional Bitcoin, pillar or history data. Automatic cycling skips unavailable scenes.

## Scene-specific interpretation

- Mosaic displays at most 1,600 account-block tiles and discloses the total sampled count. It is not a complete transaction explorer.
- Loom samples a bounded window, displays at most 36 account threads and distinguishes sampled blocks from
  blocks on displayed threads. A receive links to its send through `fromBlockHash`. A loose end means no
  receive was observed in this sample, not that none exists globally.
- Heat counts PoW and fusion independently, so a mixed block belongs to both presence counters. Missing
  plasma/difficulty fields are disclosed as incomplete, not converted into a zero-work contract classification.
  The hot percentage uses blocks with reported difficulty. Plasma usage does not establish consensus weight,
  settlement or finality.
- Chain's future cubes represent scheduled slots, without guaranteed production heights. Acknowledgement
  arcs are relationships reported in account-block data, not independent inclusion proofs.
- The `lostlink` scene is an illustrative stochastic model. It uses current delegated weights as **assumed**
  hashpower shares for a small displayed subset. It does not replay a historical whitepaper implementation or
  describe the active consensus algorithm.

## Primary source pins

The source comparisons use `zenon-network/go-zenon` commit
`bb39e31c608dc397a91b98b21b096bca99a9f4d6` (the inspected public master and v0.0.9 reference):
[10-second block time and 30 nodes](https://github.com/zenon-network/go-zenon/blob/bb39e31c608dc397a91b98b21b096bca99a9f4d6/vm/constants/consensus.go),
[24-hour epoch](https://github.com/zenon-network/go-zenon/blob/bb39e31c608dc397a91b98b21b096bca99a9f4d6/consensus/consensus.go),
[embedded genesis](https://github.com/zenon-network/go-zenon/blob/bb39e31c608dc397a91b98b21b096bca99a9f4d6/chain/genesis/embedded_genesis_string.go),
and [plasma constants](https://github.com/zenon-network/go-zenon/blob/bb39e31c608dc397a91b98b21b096bca99a9f4d6/vm/constants/plasma.go).
These source comparisons do not authenticate the software running on a public node that reports v0.0.10.

## Complementary Observatory data

[Zenon Observatory](https://0x3639.com/go-zenon-version/) and its [OpenAPI specification](https://0x3639.com/go-zenon-version/openapi.json), inspected on 2026-11-16, expose peer discovery, self-reported software versions, projected slots, actual production and saved momentum intervals. Production snapshots include `generatedAt`, `status`, `complete`, `frontier` and coverage fields. Projections based on current RPC weights are not guaranteed future production.

The documented routes do not supply detailed account blocks, send/receive links, plasma fields, arbitrary account-block lookups or Bitcoin data. metroNoM therefore continues to use direct ledger RPC for those scenes and mempool.space for Bitcoin. The Observatory is a complementary reference, not an additional runtime dependency. Peer identity counts, IP counts, registered pillars and software versions must not be treated as interchangeable.
