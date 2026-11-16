# metroNoM deployment guide

metroNoM is a browser visualization of public Zenon RPC observations and Bitcoin data. Maintain English project content and use the edgepillar account for repository and deployment operations. The GitHub repository is private.

## Repository and hosting

- Repository: `edgepillar/metroNoM`, branch `main`.
- Hosting: Vercel project `metronom`, with GitHub integration and framework **Other**.
- Production: https://metronom-gamma.vercel.app/
- Install command: empty. Build command: `node scripts/build.mjs`.
- Output directory: `public`. The build verifies the inline script CSP hash and copies only `index.html`.
- No application environment variables, backend or production dependencies are required.
- Keep test output, local credentials and deployment metadata out of Git.

## Verification before a release

Use Node.js 20 or later. The local test fixtures use regular files and local WebSockets. Browser tests need an existing Chromium executable (`CHROME_PATH`) or a separately provisioned Playwright browser. Put temporary downloads and test output in the approved task storage for the environment.

```sh
cd test
npm ci --ignore-scripts
npm run probe
npm run regression
npm run data
npm run responsive -- http://localhost:8857/
npm run smoke
cd ..
node scripts/build.mjs
```

After editing the application script, update its SHA-256 source in the `Content-Security-Policy` header in `vercel.json`. The build refuses a mismatched hash. Never remove the policy to make a deployment pass.

## Verification after a release

```sh
cd test
npm run smoke:prod -- https://metronom-gamma.vercel.app
npm run live -- https://metronom-gamma.vercel.app
npm run live:details -- https://metronom-gamma.vercel.app
npm run responsive -- https://metronom-gamma.vercel.app
```

Verify the actual production URL, exact response bytes and CSP, fresh LIVE status, Bitcoin data, pillar list and history. Test all scene links and `?overlay&calm#dial`. Repository documentation, tests, configuration, environment files and Git metadata must return 404 from the deployment.

A successful mocked test does not demonstrate live service availability. A public RPC response is node-reported data; it is not an independently verified consensus or timestamp proof. Record failures and limits alongside successful checks in `docs/SCENE-REVIEW.md`. Keep the initial publication evidence in `docs/REVIEW.md` unchanged.

The responsive audit checks all fifteen scenes at 320 × 568, 390 × 844, 844 × 390 and 768 × 1024. It measures
canvas text bounds, DOM overflow and errors; it does not replace screenshot inspection or physical-device testing.
The live audit compares a loaded sample with a fresh response and a second reachable public node. Agreement at
one sampled height is limited evidence, not consensus verification. Record each endpoint's actual availability.

## Operational boundaries

Preserve explicit simulation labels. Source outages must never silently turn simulated data into LIVE data. Keep automatic failover and stale-frontier checks. Do not add analytics, external scripts, hidden tracking, a custom domain or a paid service without a corresponding request.

See `docs/DATA-MODEL.md` for data semantics, `docs/ARCHITECTURE.md` for the code map, and `docs/SCENE-REVIEW.md` for current release findings and verification.
