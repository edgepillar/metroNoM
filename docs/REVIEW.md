# metroNoM release review

This is the initial publication record. The later [detailed scene re-review](SCENE-REVIEW.md) supersedes its
application assessment where behavior changed; the original source pins and test results below remain historical.

Reviewed on 2026-11-16. metroNoM is a visual client for public Zenon ledger observations and Bitcoin block data. It does not hold funds, sign transactions or independently verify consensus. During this initial release review, the repository was private under `edgepillar`; the deployed page was intended for public viewing.

## Scope and source provenance

The supplied archive contained a single HTML application, Vercel configuration, two maintainer documents, a deployment handoff and local test fixtures. The archive SHA-256 was `ef2acf4ed292839639f1ad792e6071227200d6db4fdd462d9e7be1b1e84d14e4`. The original `index.html` SHA-256 was `5c4053f3eb5168ff2829663ec18b5034d1a9cfc5b056d5fe9975cf0a03b3682d`. The separately supplied handoff matched the archived copy.

The review covered all application sections: endpoint configuration, JSON-RPC transport, subscriptions, ingestion and retention, simulation, Bitcoin transport, fifteen scenes, sound, PNG export, time lookup, navigation, browser accessibility, security headers, deployment exclusions, dependency locking and test harnesses. The supplied claim of earlier successful tests was treated as historical delivery information. Release checks were executed again against the revised source.

The handoff's default public `zenon-live` repository was superseded by the requested private `edgepillar/metroNoM` repository. The internal handoff was replaced with a concise English maintenance guide before committing. Local paths, account credentials and the original private delivery narrative are excluded from repository content.

## Findings and changes

| Area | Observed behavior | Release behavior |
| --- | --- | --- |
| Initial connection | The simulation deadline was cleared when a socket opened, before a successful RPC response. A silent server could leave startup pending. | Transport and RPC calls are bounded. A complete initial data load is required for LIVE; otherwise startup reaches labelled simulation. |
| Node freshness | A connected node could be labelled LIVE with an old frontier. | A frontier more than 90 seconds old or 30 seconds ahead of the client clock is rejected. The watchdog checks every five seconds. |
| Reconnection | The display's state could remain LIVE while the status pill said reconnecting. The overlay reads the state directly. | Reconnection changes the state as well as the visible status, including the overlay ticker. |
| Pending requests | Explicitly closing a socket did not immediately reject every pending RPC call. | Closing cancels connection work and rejects pending calls, preventing delayed work from reviving a discarded connection. |
| Simulation recovery | Recovery repeatedly tested the first configured endpoint and reloaded on transport opening alone. | Recovery tries each configured endpoint and requires a fresh frontier before reloading. |
| Bitcoin fallback | Real Bitcoin data and its background transport could survive a Zenon simulation fallback. | Automatic fallback cancels fetches, closes the socket, clears polling and resets the real series before generating simulated data. |
| Endpoint overrides | Empty or insecure query values could remove useful defaults or cause blocked remote transports. | Overrides reject credentials, fragments and insecure remote schemes; invalid values retain defaults. Local HTTP and WS remain available for development. |
| Fonts and requests | Google Fonts added a separate third-party request. | Local system fonts remove that request. Bitcoin fetches omit credentials and referrers and have a timeout. |
| Script policy | CSP permitted arbitrary inline scripts and same-origin script resources. | CSP permits the exact application script SHA-256. The build rejects a stale hash. Animated inline styles and configurable HTTPS/WSS data providers remain supported. |
| Deployment boundary | Exclusion depended on upload filtering while the repository root also contained documents and test code. | A small dependency-free copy step produces `public/index.html` only. Vercel serves that directory. Unexpected output files cause a build failure. |
| Native assets | Transfer classification could trust an arbitrary token symbol, allowing a custom ZNN label to look like the native asset. | Native classification and native volume totals use the token standard. |
| Time lookup | The action and exported object could be mistaken for an independently verified timestamp certificate. | The interface and copied JSON describe a node-reported observation. Bitcoin mapping is timestamp context, not a timestamp proof. Inconsistent time bounds are rejected. |
| Dialog interaction | The time lookup lacked dialog semantics, an input label and a keyboard focus boundary. | The dialog is labelled, focus moves to its input, Tab stays inside it and Escape closes it. |
| Motion and navigation | Calm mode was available only through a query parameter, and hidden navigation lacked a keyboard visibility rule. | Reduced-motion preferences enable calm effects; focused navigation stays visible. |
| Responsive graphics | Some mobile canvas headings, axis labels and legends were clipped despite the scenes rendering without exceptions. | Narrow layouts wrap legends and captions, separate epoch headings and reduce crowded dial labels. |
| Test toolchain | The stated Node.js 18 floor did not match the locked Playwright requirement. | Node.js 20 is required and the reviewed development dependencies are pinned exactly. Production has no package install. |

## Application and data assessment

The runtime has no external JavaScript, browser persistence, cookies, wallet integration, authentication or backend. Node-provided names and token labels that reach HTML are escaped. The remaining canvas and text-content rendering paths display strings without evaluating them. Configuration allows alternative public endpoints, so source trust and availability remain the viewer's responsibility.

The main state keeps at most 8,640 detailed momentums. The mosaic highlight set is bounded to 1,600 entries, including when another scene stays pinned. Disconnects do not establish missed slots after the last observation. Rendering uses Canvas 2D for most scenes and a small DOM cube sequence for the momentum chain. The history view samples ledger heights; it is not an exhaustive independent reconstruction. Amounts are converted to JavaScript numbers for visualization and should not be used as accounting records. Pillar production counters are cached by the selected node and can lag current chain activity.

The notary reads an account block, its acknowledged momentum and its node-reported confirmation detail. It does not validate signatures, inclusion proofs, canonicality, consensus finality or a binding between Bitcoin proof of work and the account block. A genesis reference to Bitcoin is not evidence that every later account block is timestamped by Bitcoin. Miner-reported Bitcoin timestamps are not monotonic wall-clock measurements.

A loose end in the loom means a receive was not observed in the loaded window; it does not establish that the transfer remains unreceived globally. The historical whitepaper animation is explicitly a simulation, including when other scenes use live data. Software-version information must not be inferred from a momentum's protocol version or a relay address.

## Observatory source assessment

The [Zenon Observatory](https://0x3639.com/go-zenon-version/) and its [API specification](https://0x3639.com/go-zenon-version/openapi.json) were inspected as an additional source. Its documented read-only routes cover observed peers and IPs, software reports, projected momentum slots, actual production, saved momentum intervals and a missed-slot study. Freshness, coverage and completeness fields are essential to interpreting those observations.

These routes do not provide all fields needed by metroNoM: detailed account blocks, transfer links, plasma usage, arbitrary account-block lookup and Bitcoin data still require the original sources. Adding the Observatory as an unconditional third runtime dependency would not replace those requests. It is documented as a complementary reference. Its projected producer assignments and self-reported software versions are not consensus or software attestations.

## Verification record

The reviewed `index.html` SHA-256 is `cb444e6ff41ef7801f695c743574334095b51e1559aeb7cc6270e29e7d098eac`.

| Control | Result |
| --- | --- |
| Static output and exact script CSP hash | Passed; `index.html` only |
| Failure and recovery regression controls | 19/19 passed, actual exit 0 |
| Local smoke controls | 20/20 passed, actual exit 0 |
| Scene rendering | All 15 scenes on desktop, 390 × 844 mobile and an opaque-origin sandboxed iframe |
| Sandboxed fallback | Labelled simulation ready in 1.1 seconds |
| Live source probe | All three Zenon endpoints answered, v0.0.10, 98 pillars; mempool.space answered |
| Staged privacy and language scan | 16 source files passed before publication |
| Production smoke controls | 21/21 passed against the public deployment, actual exit 0 |

Production is [metronom-gamma.vercel.app](https://metronom-gamma.vercel.app/), hosted as Vercel project `metronom` in the `edgepillar` account and connected to `edgepillar/metroNoM` on `main`. Vercel requires lowercase project identifiers; the repository and application retain the `metroNoM` spelling. The platform assigned the production hostname shown here.

The production browser run reached LIVE through `node.zenonhub.io`, initially at momentum #14,676,227 with a three-second frontier age. Bitcoin height #976,137, 98 pillars and history since genesis loaded. All fifteen scene pins and `?overlay#dial` worked. The page had zero browser page errors and zero CSP violations. The eight checked non-public paths returned 404, including documentation, tests, build configuration, Git metadata and environment-file paths. The exact deployed HTML bytes and CSP matched the reviewed source.

The production browser run used source commit `ac9d5f3f5619ae5ccdeafe6ac5228e7196f49f13` and the HTML SHA-256 above. Final documentation updates preserve these application bytes. Vercel's hosted static build succeeded; automated browser checks ran locally against the public production URL.

Mobile epoch, pillar and history screenshots were inspected after the layout corrections. The automated scene sweep checks navigation and execution; visual inspection also checked that the corrected headings and legends fit. Failed attempts remain in private qualification evidence with their original exit status; a later passing attempt does not rewrite them.

The first revised-source attempt exposed an accidental timer-name edit during the font replacement and a watchdog regression fixture that left its deliberately corrupted timestamp in place. The attempt failed four regression checks and two smoke checks. Its live-source probe succeeded against all three Zenon endpoints with 98 pillars and against mempool.space. The timer edit and fixture were corrected, then the complete local suite passed. The earlier logs remain failure evidence; no frozen source snapshot or successful qualification of that intermediate edit is claimed.

Dependency installation used the committed lockfile with install scripts and executable links disabled. npm reported zero known vulnerabilities for the four-package development graph at that observation time. This is a dependency advisory check, not a guarantee of application security.

## Remaining limits

- Public node responses are trusted observations. There is no independent chain verifier or multi-node agreement requirement.
- Availability depends on the viewer reaching public WSS endpoints, including port 35998, and the chosen Bitcoin API. Network restrictions and rate limits can reduce functionality.
- Freshness compares with the client clock. A materially wrong clock can reject good data or misclassify timing; the visualization cannot independently establish UTC.
- Canvas scenes remain primarily visual. Dialog and navigation semantics improve keyboard use but do not provide a complete nonvisual equivalent of every scene.
- This release adds no license, custom domain, analytics, paid infrastructure or guarantee of long-term service availability.
