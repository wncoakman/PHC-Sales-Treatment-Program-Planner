# PHC Planner (iOS, offline)

Treatment-plan framework for DMV (VA/MD/DC) arborists: pick the site and problem(s) and get best-practice
chemical, cultural, mechanical, and diagnostic mitigations, with application type, active ingredients, timing
windows, and compliance flags. No application rates. Fully offline; all data ships in the app.

## Layout
- `Sources/PHCKit/Resources/knowledge_base.json`: **all content**. Edit here; no code changes needed for content.
- `Sources/PHCKit/PlanEngine.swift`: rules (timing windows, crown-loss thresholds, MD neonicotinoid, bloom/pollinator,
  near-water, sensitive sites, cost-share eligibility, annual schedule).
- `Sources/PHCKit/PlanExport.swift`: plain-text export (share sheet).
- `Sources/PHCUI`: SwiftUI screens (Plan, Library, Reference).
- `App/`: iOS app entry point. `project.yml`: XcodeGen spec.

## Build
1. Install Xcode (Mac App Store) and `brew install xcodegen`.
2. `xcodegen generate && open PHCPlanner.xcodeproj`
3. Set `DEVELOPMENT_TEAM` in `project.yml` (or in Xcode Signing) to the RTEC team; run on device / archive for TestFlight.

Tests (data integrity + rules, no Xcode needed): `swift test`

## Content status
Content was normalized from Blake's "DMV PHC Knowledge Base v1.0" (Aug 2026) and is **unreviewed**.
Each condition's `reviewFlags` lists corrections made and items needing verification (shown in the Library
detail screen). Set `meta.reviewStatus` once a certified arborist / PHC lead signs off.
