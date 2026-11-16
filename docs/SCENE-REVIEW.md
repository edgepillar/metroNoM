# Detailed scene re-review

Reviewed on 2026-11-16. This review revisits the published metroNoM application, all fifteen scene pins,
public data connections and narrow, landscape and tablet layouts. The initial release record remains in
[REVIEW.md](REVIEW.md); its successful rendering sweep did not establish every data relationship or label.
The new controls intentionally exposed additional defects before corrections were made.

## Scope, identity and source pins

- Baseline production commit: `1d169bcc7c8fe1e6466746cc47e0b16faa13e3f0`.
- Baseline application SHA-256: `cb444e6ff41ef7801f695c743574334095b51e1559aeb7cc6270e29e7d098eac`.
- Revised application commit: `156acc01e61d1aeeade18a0005679f1820a37332`.
- Revised application SHA-256: `31808b221538b5a1d4302f7b2c379748a218530a1bc60fcb8178251b35735ce7`.
- Repository: private `edgepillar/metroNoM`, branch `main`. Vercel project: `metronom` in `edgepillar`.
- Production: [metronom-gamma.vercel.app](https://metronom-gamma.vercel.app/).

Source review, deterministic mock tests, real public-node observations, local browser tests and Vercel build
status are separate evidence. There is no claim of independent consensus, inclusion, finality or timestamp
verification. Project files and commit identities use English and the edgepillar identity. Test logs and
screenshots containing local tooling details remain private and outside the deployed output.

## Defects reproduced and corrected

The baseline failed 14 of 24 deterministic data controls. Eleven of the sixty scene/viewport combinations
had canvas text beyond the viewport, despite no JavaScript exceptions. A baseline live audit also timed out;
that attempt remains a failure with an undetermined cause, not a retrospective success.

| Finding | Corrected behavior |
| --- | --- |
| An unobserved slot after the frontier could become “missed” before a later observation bounded the gap. | Pending observations, unloaded history, future slots and bounded misses are distinct. HUD missed share stops at the observed timestamp while the clock continues. |
| Epoch produced and future counts could include the same current slot, totaling 8,641. | One shared partition assigns each of the 8,640 slots exactly once; “with account blocks” is a produced subset. |
| The shared epoch panel could substitute cached pillar counters and show an inconsistent fill fraction. | Fill uses produced and bounded-missed slots in loaded coverage. Unloaded and pending counts are disclosed. Mean interval uses loaded epoch timestamps. |
| Bitcoin interval statistics counted unobserved trailing slots as missed. | The half-open interval counts produced, bounded-missed, unknown and pending slot starts separately. Partial coverage is visible. |
| History and Spiral could remain frozen at their initial sampling frontier or wait for every historical query before displaying available samples. | Their last sample advances with the observed frontier. Groups of eight publish partial samples immediately; incomplete sampling retries with a single loader. |
| A short RPC response could qualify as complete coverage. | Exact count, contiguous heights, timestamp alignment/order, hash shape and loaded boundaries are checked before ingestion. Incomplete initial data fails over; older coverage remains unknown until loaded. |
| Chain cubes could retain an old cache after bulk catch-up. | Bulk ingestion rebuilds the cube cache. Future cubes describe scheduled slots rather than guaranteed future momentum heights. |
| A pillar weight update with the same list length could leave stale constellation sizes. | Pillar updates invalidate the constellation layout. Labels avoid each other, with current/followed producers prioritized. |
| Mixed PoW/fusion blocks were omitted from fusion presence counts; absent fields looked like zero-work contracts. | Heat counts both work sources independently, discloses mixed blocks and incomplete fields, and avoids unsupported consensus-weight claims. |
| A changed Bitcoin block at an already known height could be ignored. | Hash/timestamp changes replace cached data, height controls ordering, authoritative snapshots can lower the tip, and stale HTTP responses cannot overwrite newer socket updates. |
| A pinned Bitcoin scene could hold the intro indefinitely if the Bitcoin dependency was unavailable. | The requested scene is selected with a retry explanation. Automatic cycling skips unavailable scenes. |
| Mosaic and Loom captions could imply that every sampled block was displayed. | Mosaic discloses its 1,600-tile cap; Loom distinguishes sampled blocks from blocks on at most 36 displayed account threads. |
| The illustrative PoW model could produce non-finite values with fewer than eight pillars. | It uses positive weights and bounds the finishing threshold to the available displayed subset. Assumed hashpower and simulation status remain explicit. |
| Mobile labels clipped or overlapped, and the filled mosaic could extend behind the HUD. | Loom margins, clock text, model graphs, epoch headings, Heat summaries, Spiral's endpoint and constellation labels adapt to the available space. Small glyph labels stay within their tile. The mosaic measures its legend and available height below the HUD before sizing. |
| Mosaic tooltips still described signing time and a “time certificate.” | They now describe node-reported acknowledgement/confirmation references and time context, consistent with the notary trust boundary. |
| Invisible navigation retained a pointer hit area over scene actions. | Hidden navigation ignores pointer input; keyboard focus still reveals it. Moving over an export button does not reveal an overlapping navigation panel. |

## Fifteen-scene assessment

| Scene | Data and calculation checked | Result and interpretation |
| --- | --- | --- |
| **Blocks** `#blocks` | Account blocks come from detailed momentums; native asset classification uses token standards, not token symbols. A 1,601-block fixture produces exactly 1,600 displayed tiles and an accurate cap disclosure. | Corrected. The incoming chart bins the loaded span, which may exceed 24 hours. Visual amounts use JavaScript numbers, not accounting precision. |
| **Chain** `#chain` | Observed heights and producers, bulk-cache recovery, acknowledgement references and future-slot labels. | Corrected. Acknowledgement arcs reflect RPC fields; partial offscreen cubes are intentional. A scheduled slot does not guarantee production. |
| **Glyphs** `#glyphs` | A known hexadecimal pattern maps to the expected 256 hash bits; slot state is shared with the other clock views. | Verified by fixture and source inspection. Missed and pending labels are bounded to each tile on narrow screens. |
| **Clock** `#dial` | Thirty ten-second slots per round, observed producer counts, bounded misses and pending slots. | Shared slot semantics corrected. The dial does not derive a future elected-producer schedule. |
| **Stars** `#constellation` | Producer mapping, delegated-weight sizes, current and two preceding rounds, same-count pillar refresh. | Cache corrected. Text avoids collisions; faint historical figures are a visual history, not additional current-round production. |
| **Waterfall** `#waterfall` | Slot/producer matrix and per-pillar `max(expected − produced, 0)` deficits. | Fixture verified. The deficit bars are explicitly cached node production counters; they can lag and do not identify a missing slot's producer immediately. |
| **Bitcoin × Zenon** `#clocks` | Bitcoin height ordering despite nonmonotonic timestamps, same-height replacement, half-open Zenon interval counts and dependency failure. | Corrected. Unknown/pending coverage is disclosed. Bitcoin timestamps are miner-reported; timestamp order is not chain order. |
| **Loom** `#loom` | `fromBlockHash` links a receive to a sampled send. A 50-block fixture spanning 51 accounts displays 36 threads and 35 applicable blocks. | Fixture verified; count disclosure corrected. A loose end means no receive was observed in this bounded sample. |
| **24 h** `#timeline` | Timestamp cutoff excludes retained records older than 24 hours. The accompanying epoch panel uses the same observed-slot arithmetic as the rug. | Fixture verified and panel corrected. Retaining 8,640 momentums does not itself define a 24-hour window. |
| **Epoch** `#epoch` | Exactly 8,640 mutually exclusive produced/missed/unloaded/pending/future slots; fill fraction and observed mean interval. PNG export includes the coverage categories and is disabled for simulation. | Fixture verified and arithmetic corrected. “With account blocks” is a subset, not another term in the total. |
| **Heat** `#heat` | Native plasma fields, independent PoW/fusion presence, mixed usage, missing fields and a timestamp-filtered sample. | Fixture verified and classification corrected. Positive difficulty reports account-block PoW activity; it does not establish consensus weight or finality. |
| **PoW model** `#lostlink` | Finite execution with fewer than eight positive-weight pillars, displayed-subset normalization and short-screen graph sizing. | Corrected. Current delegated weights are assumed hashpower shares in a stochastic illustration; this is not active mainnet consensus or a faithful historical protocol replay. |
| **Spiral** `#spiral` | Genesis Bitcoin reference, sampled height/time interpolation, interval missed-share color and current observed endpoint. | Endpoint corrected and narrow label clamped. Interpolation between sampled heights is an approximation. |
| **History** `#history` | Up to 240 sampled heights, observed endpoint refresh, smoothed intervals and cumulative missed share. | Endpoint and request/retry handling corrected. Sampling and smoothing remain disclosed. |
| **Pillars** `#pillars` | Treemap area equals the available plot area and relative areas follow node-reported delegated weight; producer flashes use current observations. | Area fixture verified. Production colors use cached current-epoch counters and can lag; the latest-record caption refreshes on bulk ingestion. |

## Source comparison

The inspected public `zenon-network/go-zenon` master and v0.0.9 reference resolve to
`bb39e31c608dc397a91b98b21b096bca99a9f4d6`. Relevant primary sources are
[consensus constants](https://github.com/zenon-network/go-zenon/blob/bb39e31c608dc397a91b98b21b096bca99a9f4d6/vm/constants/consensus.go),
[epoch duration](https://github.com/zenon-network/go-zenon/blob/bb39e31c608dc397a91b98b21b096bca99a9f4d6/consensus/consensus.go),
[embedded genesis](https://github.com/zenon-network/go-zenon/blob/bb39e31c608dc397a91b98b21b096bca99a9f4d6/chain/genesis/embedded_genesis_string.go),
[plasma constants](https://github.com/zenon-network/go-zenon/blob/bb39e31c608dc397a91b98b21b096bca99a9f4d6/vm/constants/plasma.go),
and [RPC ledger types](https://github.com/zenon-network/go-zenon/blob/bb39e31c608dc397a91b98b21b096bca99a9f4d6/rpc/api/ledger_types.go).
These support the ten-second target, thirty-slot round, 24-hour epoch and genesis reference used here.
The [official RPC reference](https://github.com/zenon-network/znn-wiki/blob/master/api.md) describes cached pillar
statistics and plasma fields. Source inspection does not authenticate a running node's self-reported v0.0.10.

The owner-supplied [Zenon Observatory](https://0x3639.com/go-zenon-version/) remains a complementary source
for peer/version and production observations. Its documented API does not replace the detailed account-block,
transfer-link, plasma and Bitcoin data used by these scenes. No new runtime dependency was added.

## Verification record

The first corrected intermediate source, `7bfc551e59c1f1f1bb58a8b443c478abf8d9a77b`, passed 24/24 data,
19/19 regression and 20/20 smoke controls but failed two narrow Spiral endpoint-label checks. The next source,
`ee97109ef013c06edd8ab5a2892aa4c63bce12f8`, passed 29/29 data, 19/19 regression, 61/61 responsive and
20/20 smoke controls with actual exit 0. Its application SHA-256 is
`7490400916bfdc21c124d402f0fbc06b6efd5b3f36d60d21b2db4f233cd96348`.
Further screenshot inspection prompted glyph, constellation, clock-label, mosaic and wording refinements.
The `bd3ad5d2fe3bc715e1c867b5b52c6360306a923e` attempt passed regression, responsive, smoke and 20/20 live
controls, including agreement at momentum #14,677,568 between atsocy and HC1. One of its 29 data checks
failed: it observed scene selection before the next animation frame made the unavailable-data notice visible.
The fixture now waits for both conditions together and uses an endpoint that rejects both Bitcoin transports.
The later screenshot inspection also exposed mosaic/HUD overlap, so that relationship is now checked explicitly.
Each earlier failed attempt remains retained with its actual result.

The mosaic correction at `c9df1b537973c533e48257f653d4ec5e7684598b` passed 29/29 data, 19/19 regression,
61/61 responsive and 20/20 mock smoke controls. The final source adds the navigation hit-area correction and
`test/live-details.mjs`, which checks a nonempty ledger sample, independently summed native send amounts,
live epoch arithmetic, a real PNG download and the mobile time-lookup dialog. Those controls also run against
the production deployment rather than relying on a mocked export.

The responsive matrix is 320 × 568, 390 × 844, 844 × 390 and 768 × 1024. Each of the fifteen scenes is pinned
at each size. The final harness waits for scene transitions, measures visible canvas text bounds and document
overflow, checks the mosaic against the HUD, saves screenshots and records page errors. It deliberately excludes clipped drawing regions and
does not prove all internal labels avoid collisions. Screenshot inspection complements those checks.
This is Chromium viewport/touch emulation, not physical iOS or Android hardware qualification.

| Control | Source | Result |
| --- | --- | --- |
| Static output and exact CSP script hash | `f971709` | Passed; `index.html` only |
| Deterministic scene-data controls | `f971709` | 29/29 passed |
| Failure/recovery and trust-boundary regression | `f971709` | 19/19 passed |
| Local responsive matrix and browser errors | `c9df1b5` | 61/61 passed, including 60 scene/viewport combinations |
| Local scene, overlay, simulation and sandbox smoke | `c9df1b5` | 20/20 passed |
| Nonempty sample, amount sums, epoch partition, PNG and dialog with controlled data | `f971709` | 7/7 passed |

The final navigation correction preserves the scene drawing and data functions tested at `c9df1b5`; its
changed hit behavior is exercised by the export/dialog controls. The production matrix is checked again
against the final application bytes. The controlled PNG was 1,856 × 944 pixels and 108,658 bytes.

Production results are added after deployment and live verification. Public deployment is not inferred from
these local results.

The first production recheck at deployment commit `25df1c51abd6fccc48dcefaec29ea3c9f8791c3c` retained the
`f971709` application bytes. Its 21 smoke controls failed one check: history did not become ready inside the
45-second bound in that session. A later 20/20 live audit loaded history and found two-node agreement at
momentum #14,677,627. All 61 responsive controls passed. The additional live-details run timed out on its
fresh detailed-momentum lookup before completing its assertions. These are retained failures, not passed checks.

The `63d303c` correction publishes validated history groups progressively and labels partial coverage. It
reduces concurrent history queries from twenty to eight, retries incomplete sampling and guards against
overlapping loaders. A controlled source supplies the first group while withholding later groups; the new
data control requires History to become usable while still marked partial. The direct sample recheck uses
the same explicit 15-second bound as the application's detailed-range reader. The prior timeout remains
recorded; public-source latency is not established as having one exclusive cause.

At `63d303c`, 30/30 data, 19/19 regression, 20/20 mock smoke and 7/7 controlled interaction checks passed.
The `156acc0` follow-up rejects historical timestamps beyond the observed frontier and adapts Spiral's
curve subdivisions to large partial-sample gaps. This keeps the spiral smooth while the remaining samples load.

## Availability observations and remaining limits

A source probe at momentum #14,677,546 found fresh responses from `node.zenonhub.io` and `node.atsocy.com`,
both reporting v0.0.10 and 98 pillars. `my.hc1node.com` timed out during that attempt. mempool.space answered
with Bitcoin height #976,179 and an allow-all CORS response. An earlier isolated attempt to atsocy failed to
open; a later success does not rewrite that failure. These are dated endpoint observations, not uptime guarantees.

- The runtime trusts the selected public node. A repeated sample and second-node hash agreement are bounded
  cross-checks, not independent validation of an entire chain or every account block.
- Initial/back-fill history can be incomplete while LIVE frontier data is fresh. Unknown coverage is shown and
  retries continue; data availability and the existence of a fresh frontier are different properties.
- Node counters are cached, history is sampled, Bitcoin timestamps may move backward and the client clock
  influences freshness and slot display. These limitations are visible in the interface or documented here.
- Public WSS/HTTPS services may fail, block clients or impose limits. Unavailable dependent scenes explain the
  condition; simulation remains explicitly labelled and isolated from real Bitcoin transport.
- Canvas scenes remain primarily visual. Keyboard navigation and the labelled notary dialog do not provide a
  complete nonvisual equivalent of every chart. No physical-device or exhaustive assistive-technology claim is made.
- Only `public/index.html` is deployed. No license, analytics, cookies, wallet features, custom domain or paid
  infrastructure was added. Repository privacy and deployment exclusions must remain verified at release time.
