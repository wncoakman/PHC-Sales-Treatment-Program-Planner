# PHC Planner (offline web app)

Treatment-plan framework for DMV (VA/MD/DC) arborists: pick the site and problem(s) and get best-practice
chemical, cultural, mechanical, and diagnostic mitigations, with application type, active ingredients, timing
windows, and compliance flags. No application rates. Works offline once added to the Home Screen.

## Layout
- `web/`: **the app** (static files; host this folder anywhere with HTTPS)
  - `data/knowledge_base.json`: generated content. **Do not edit by hand**; run `npm run build:kb`.
  - `engine.js`: rules (timing windows, crown-loss thresholds, MD neonicotinoid, bloom/pollinator, near-water,
    sensitive sites, cost-share eligibility, annual schedule, minimum-visit framework, text export).
  - `app.js`, `index.html`: screens (Plan, Library, Reference).
  - `sw.js`: offline cache. **Bump `VERSION` after any change** so installed copies update.
- `reference/pest-management-reference.md` (**local only, gitignored**): **primary content source**, a structured transcription of the
  2024 Southeast Pest Management Recommendations manual (no rates). Edit here, then `npm run build:kb`.
- `reference/current-supplement.md`: current information the manual lacks (e.g. beech leaf disease, boxwood dieback,
  elm zigzag sawfly) and updates merged into manual entries, with sources and a verified date. The build also prints
  hosts with thin coverage as candidates for new supplement entries.
- `reference/blake-kb-v1.1.json`: Blake's KB, kept for VA/MD/DC rules, cost-share, EAB thresholds and abiotic disorders.
- `scripts/build-kb.mjs`: markdown + Blake overlays → `web/data/knowledge_base.json` (fails on unknown hosts/methods/months).
- `tests/engine.test.mjs`: data-integrity and rules tests: `npm test`
- `Sources/`, `App/`, `project.yml`: shelved native iOS version (shares the same JSON via symlink).

## Job logistics (backstage)
The work address on the first page is geocoded (OpenStreetMap Nominatim) and routed to every base in
`web/data/bases.json` (public OSRM router). The closest base, business-hours drive time (free-flow × `trafficFactor`)
and band (15 min or less / 15–30 / over 30) are stored with the plan and logged on the device; view at `#ops`.
Add bases to `web/data/bases.json` (name, address), then `npm run geocode:bases`. Note: the file is served publicly.

## Run locally
`cd web && python3 -m http.server 8765`, then open http://localhost:8765

## Install on a phone
Open the hosted URL in Safari (iPhone) or Chrome (Android), then Share → **Add to Home Screen**.
Open it once while online; after that it works with no connection. Content updates download the next time
the app is opened online.

## Content status
Primary source: the 2024 Southeast Pest Management Recommendations manual (v2.0 data, Oct 2026). Months are DMV
approximations of the manual's phenology/GDD timing, and ✓ default programs are editorial picks; both are **unreviewed**.
Regulatory flags, cost-share and abiotic disorders come from Blake's KB v1.0. Set `meta.reviewStatus` after sign-off.

## Publish updates
Live at https://wncoakman.github.io/PHC-Sales-Treatment-Program-Planner/ (GitHub Pages, `gh-pages` branch = the `web/` folder).
After changing anything in `web/`: bump `VERSION` in `web/sw.js`, commit, then `npm run deploy`.
