# PHC Planner (offline web app)

Treatment-plan framework for DMV (VA/MD/DC) arborists: pick the site and problem(s) and get best-practice
chemical, cultural, mechanical, and diagnostic mitigations, with application type, active ingredients, timing
windows, and compliance flags. No application rates. Works offline once added to the Home Screen.

## Layout
- `web/`: **the app** (static files; host this folder anywhere with HTTPS)
  - `data/knowledge_base.json`: **all content**. Edit here; no code changes needed for content.
  - `engine.js`: rules (timing windows, crown-loss thresholds, MD neonicotinoid, bloom/pollinator, near-water,
    sensitive sites, cost-share eligibility, annual schedule, text export).
  - `app.js`, `index.html`: screens (Plan, Library, Reference).
  - `sw.js`: offline cache. **Bump `VERSION` after any change** so installed copies update.
- `tests/engine.test.mjs`: data-integrity and rules tests: `npm test`
- `Sources/`, `App/`, `project.yml`: shelved native iOS version (shares the same JSON via symlink).

## Run locally
`cd web && python3 -m http.server 8765`, then open http://localhost:8765

## Install on a phone
Open the hosted URL in Safari (iPhone) or Chrome (Android), then Share → **Add to Home Screen**.
Open it once while online; after that it works with no connection. Content updates download the next time
the app is opened online.

## Content status
Normalized from Blake's "DMV PHC Knowledge Base v1.0" (Aug 2026); **unreviewed**. Each condition's `reviewFlags`
lists corrections and items needing verification (shown in Library). Set `meta.reviewStatus` after sign-off.
