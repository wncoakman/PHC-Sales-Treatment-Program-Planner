# Current supplement to the pest management reference

The 2024 manual is the primary reference. This file adds problems it does not cover and updates entries where newer information exists. It uses the same format as `pest-management-reference.md`. An entry with a new heading becomes a new problem. An entry whose heading matches a manual entry is merged into it: its About becomes an "Update" line, and its cultural bullets, chemical rows and sources are appended.

In this file ★ means the best-supported current option, not a manual bold. Last verified: October 2026. Re-check each entry's sources at least yearly.

**Rule-based additions (applied by the build, listed here for review):**
- **Btk for caterpillars:** a Bacillus thuringiensis kurstaki (Btk) foliar row is added to the defoliating caterpillar entries listed in `BTK_FOR` in `scripts/build-kb.mjs`, timed like the entry's main caterpillar spray. Btk is the standard selective option for young larvae and spares natural enemies, but the manual omits it. Sources: Ohio State BYGL (bagworm); UGA and University of Maryland Extension (box tree moth).
- **Currency review rules (`CURRENCY_RULES`):** mite rotation partners, afidopyropen, cyantraniliprole, spirotetramat, chlorantraniliprole bark sprays for clearwing borers, chlorothalonil for conifer needle diseases, and beneficial nematodes for root weevils. Sources are listed in the review section below.
- **Demoted manual rows:** a chemical row marked ✗ in this file removes the manual's preferred and default marks from the matching row and adds the reason (its Timing column) as a note.
- **Product status notes:** mancozeb (pending EPA decision on residential ornamental uses), acephate (EPA proposed keeping only tree injection) and emamectin benzoate (TREE-äge formulations are restricted use) are noted on every option that uses them.

# Insects and mites

## Lace bugs

### Andromeda lace bug
- **Hosts:** pieris, azalea
- **Active:** May–Oct
- **About:** A Japanese lace bug (Stephanitis takeyai) whose preferred host is Japanese andromeda (Pieris japonica), and it also attacks rhododendron. The upper leaf surface turns pale and mottled, with dark excrement, flattened bugs and cast skins underneath. Management follows the azalea lace bug program. Host choice matters: P. phillyreifolia and P. japonica 'Variegata' resisted lace bugs in trials, while 'Cavatine' and 'Temple Bells' were susceptible.
- **GDD:** about 120 (base 50°F from March 1) for first nymphs; reported ranges vary
- **Sources:** UMass Extension Professional Insect & Mite Guide, Stephanitis takeyai; Nair, Univ. of Georgia dissertation (2011); RHS Pieris lacebug profile

**Cultural**
- Site: Plant Pieris in part shade. Sun-exposed plants are damaged most.
- Plant selection: Use resistant Pieris (P. phillyreifolia, P. japonica 'Variegata') for new plantings.
- Biocontrol: Green lacewing larvae.

**Chemical**

| | Method | Active ingredient | Months | Apps | Interval | Repeat | Timing | Notes |
|---|---|---|---|---|---|---|---|---|
| ★✓ | Foliar spray | Flupyradifurone | May–Sep | 1–2 | 7+ d | As needed | At nymph detection | OK in bloom |
| ★ | Soil drench | Imidacloprid | Jul–Sep | 1 | — | Annually | Mid-summer to early fall for next year | Watch for mite flare-ups |
| | Foliar spray | Horticultural oil or insecticidal soap | May–Sep | 2 | 14 d | Per generation | At nymphs | Coverage of leaf undersides is critical |

## Aphids

### Asian woolly hackberry aphid
- **Hosts:** hackberry
- **Active:** May–Oct
- **About:** A white, waxy aphid on hackberry leaf undersides (Shivaphis celti). It drips heavy honeydew and causes sooty mold over cars, patios and paving. Trees are not seriously harmed. Established across the Southeast and reported north to Illinois, but not yet confirmed in VA/MD by extension, so confirm the ID before treating. Treat only where honeydew is unacceptable.
- **Sources:** Mississippi State Extension Bug's Eye View (2022); UC Riverside Center for Invasive Species Research; UC IPM

**Cultural**
- Monitor: Confirm the ID. Use water-sensitive cards under the canopy to gauge honeydew and decide whether to treat.
- Soil & water: Keep trees watered after a systemic treatment so it moves into the tree.

**Chemical**

| | Method | Active ingredient | Months | Apps | Interval | Repeat | Timing | Notes |
|---|---|---|---|---|---|---|---|---|
| ★✓ | Soil drench | Imidacloprid | Mar–Apr | 1 | — | Annually | Late winter to early spring, before or as trees leaf out | Season-long control. Later spring applications still help. Not in late summer or fall |
| | Foliar spray | Insecticidal soap or horticultural oil | Jun–Aug | 1–2 | — | As needed | When colonies build | Short residual. Coverage is hard on large trees |

## Mites

### Baldcypress rust mite
- **Hosts:** baldcypress
- **Active:** Jun–Sep
- **About:** An eriophyid mite (Epitrimerus taxodii) that bronzes and browns bald cypress foliage in summer, worst in dry summers without irrigation. **Bald cypress is very sensitive to horticultural oil, so do not use oil or oil tank mixes on it.**
- **Sources:** University of Arkansas Plant Health Clinic Newsletter (2018); UF/IFAS EDIS EP557 key pests of bald cypress

**Cultural**
- Soil & water: Irrigate in dry summers to reduce mite damage.

**Chemical**

| | Method | Active ingredient | Months | Apps | Interval | Repeat | Timing | Notes |
|---|---|---|---|---|---|---|---|---|
| ★✓ | Foliar spray | Spiromesifen | Jun–Aug | 1–2 | — | As needed | At detection | No horticultural oil on bald cypress |
| | Micro-injection | Abamectin | May | 1 | — | Annually | Spring, on trees with a history | — |

### Filbert big bud mite
- **Hosts:** filbert
- **Active:** Mar–Jun
- **About:** Eriophyid mites (Phytoptus avellanae and Cecidophyopsis vermiformis) live inside hazelnut buds, which swell abnormally ("big bud") and often die. Inside the galls, mites are protected from sprays, so treatments must hit mites as they move to new buds in spring before galls form. Cultivars differ in susceptibility.
- **Sources:** PNW Insect Management Handbook, hazelnut bud mite; Connecticut Agricultural Experiment Station Plant Pest Handbook, Hazelnut/Filbert

**Cultural**
- Prune: On small plants, pick off and destroy swollen buds in late winter.
- Plant selection: Avoid highly susceptible cultivars ('Ennis', 'Lewis', 'Clark') where big bud is common.

**Chemical**

| | Method | Active ingredient | Months | Apps | Interval | Repeat | Timing | Notes |
|---|---|---|---|---|---|---|---|---|
| ★✓ | Foliar spray | Horticultural oil | Apr–May | 1–2 | 14 d | Annually | Spring, as mites migrate to new buds, before galls form | Timing is critical |
| | Foliar spray | Spiromesifen | Apr–May | 1 | — | Annually | Same timing | Not where nuts are harvested unless labeled |

## Gall makers

### Cypress twig gall midge
- **Hosts:** baldcypress
- **Active:** May–Oct
- **About:** Midges lay eggs on new bald cypress growth in late spring, and larvae induce spongy twig galls that turn brown and weigh branches down. Damage is mostly cosmetic. Insecticides are not advised because natural enemies emerging with the midges usually regulate populations.
- **Sources:** UF/IFAS EDIS EP557, cypress twig gall midge

**Cultural**
- Sanitation: Rake up and destroy fallen galls in autumn or early spring, before the midges emerge.

**Chemical:** None recommended. Natural enemies usually keep it in check.

### Hackberry witches' broom
- **Hosts:** hackberry
- **Active:** Year-round
- **About:** Dense clusters of short twigs on hackberry, linked to an eriophyid mite and a powdery mildew fungus. Cosmetic, with no lasting harm to tree health.
- **Sources:** University extension hackberry fact sheets

**Cultural**
- Prune: Prune out brooms where they are unsightly or create dense, weak branching.

**Chemical:** None needed.

## Caterpillars and sawflies

### Larch casebearer
- **Hosts:** larch
- **Active:** Apr–Jul
- **About:** Tiny caterpillars living in cigar-shaped cases mine new larch needles in spring. Heavy populations make trees look bronzed by mid-June. Adults fly late June to early July. Introduced parasitoids and weather usually regulate populations, and extension sources list no routine landscape spray.
- **Sources:** UMass Extension larch casebearer fact sheet; USDA Forest Service FIDL 96; Michigan State University Extension; Oregon Department of Forestry

**Cultural**
- Monitor: Scout new foliage as it emerges in spring for mined, whitened needles and cases.
- Site: Avoid planting larch in open-grown edge sites, which are attacked most.
- Fertility: Water and mulch heavily defoliated trees to support refoliation.

**Chemical:** None routinely recommended. Natural enemies and weather are the main controls.

## Leafminers and midges

### Leafroller caterpillars
- **Hosts:** smoketree, filbert
- **About:** Oblique-banded leafroller rolls smoke tree leaves in June, and leafrollers also attack hazelnut. It rarely needs control on smoke tree. Hand-pick, or use Btk on young larvae.
- **Sources:** UF/IFAS EDIS ST204 (Cotinus coggygria); Oregon State Extension EM 8979 (hazelnut pests)


## Borers and bark beetles

### Emerald ash borer
- **Hosts:** ash
- **About:** Current guidance (Purdue, cited by Ohio State Extension in 2026) says emamectin benzoate injections protect for up to 3 years. Re-treat every 2 years under heavy pressure, and every 3 where EAB has passed its peak. Inject mid-May to mid-June. Azadirachtin (TreeAzin) injection is the organic option, also used by municipalities. Some areas release parasitoid wasps (state and USDA programs) alongside protection of high-value trees.
- **Sources:** Ohio State Extension Q&A (March 2026, citing Purdue); University of Vermont case study (2025)

### Ambrosia beetles – general
- **Hosts:** general
- **About:** Current NC State and UGA guidance for granulate ambrosia beetle: protect high-value, young or stressed trees with pyrethroid trunk sprays re-applied every 2–3 weeks through the spring flight. Flights start in warm spells from mid-February and peak about early April. Sprays only work before beetles bore in. Imidacloprid and other systemics do not work. Highly susceptible hosts include dogwood, redbud, maples, flowering cherry, crape myrtle, magnolia, styrax, sweetgum and azalea.
- **Sources:** NC State Extension, Granulate Ambrosia Beetle pest alert (Buncombe Co., Feb 2025) and NC State publication; UGA Extension granulate ambrosia beetle

**Chemical**

| | Method | Active ingredient | Months | Apps | Interval | Repeat | Timing | Notes |
|---|---|---|---|---|---|---|---|---|
| ★ | Bark spray | Bifenthrin or permethrin | Mar–May | 3–5 | 14–21 d | Annually | From the first warm-spell flight (Feb–Mar) through peak (early Apr) and into May, trunk from 4.5 ft to the ground | Targeted trunk spray to minimize drift. Systemics do not work |

### Crapemyrtle bark scale
- **Hosts:** crapemyrtle
- **About:** A multi-state trial (LSU AgCenter, Texas A&M, Arkansas) found soil-applied neonicotinoids (imidacloprid, dinotefuran) the most effective treatments, giving complete control for at least four months in three trials. Foliar and trunk sprays were less effective and shorter-lived. Apply the drench at budbreak, before bloom and before peak crawlers. Allow several weeks for uptake. Sooty mold takes months to weather off. Expect to re-treat the next year. Monitor crawlers with double-sided tape.
- **Sources:** LSU AgCenter, Crape myrtle bark scale management updates; NC State Extension (Wilson Co.); Mississippi State Extension Bug's Eye View (2023); University of Arkansas Extension

**Chemical**

| | Method | Active ingredient | Months | Apps | Interval | Repeat | Timing | Notes |
|---|---|---|---|---|---|---|---|---|
| ★ | Soil drench | Imidacloprid | Mar–May | 1 | — | Annually | At budbreak, before bloom and peak crawlers | Most effective in multi-state trials. Not during bloom (pollinators) |
| ★ | Soil drench | Dinotefuran | Mar–May | 1 | — | Annually | At budbreak, before bloom | Faster uptake than imidacloprid. Not during bloom |
| | Foliar spray | Bifenthrin | Apr–May | 1 | — | As needed | Right before or at crawler peak (mid-Apr to early May) | Quick knockdown only. Supplements a systemic |

### Hemlock woolly adelgid
- **Hosts:** hemlock
- **About:** Michigan State guidance: dinotefuran moves fast and is best on heavily infested or declining trees, but lasts only 1–2 years. Imidacloprid takes a year or more to reach the top of large trees but protects for 4–7 years. For heavily infested trees, applicators use a basal bark tank mix of both for rapid knockdown plus long-term protection. Check both labels allow basal bark use and tank mixing (FIFRA 2(ee)). Judge dinotefuran by new growth the following late fall or winter, and imidacloprid a year after treatment.
- **Sources:** Michigan State University Extension E3349, Options for protecting hemlock trees from HWA; MSU, How to treat hemlock trees for HWA; State of Michigan, Plan to treat trees for HWA (March 2026)

**Chemical**

| | Method | Active ingredient | Months | Apps | Interval | Repeat | Timing | Notes |
|---|---|---|---|---|---|---|---|---|
| ★ | Basal bark | Imidacloprid + dinotefuran | Apr–May, Sep–Oct | 1 | — | Every 4–7 yrs | Heavily infested or declining trees, spring or fall. Trunk from ground to 4–5 ft, low pressure | Dinotefuran gives knockdown, imidacloprid long-term protection. Confirm labels permit basal use and tank mix |

## Caterpillars and sawflies

### Elm zigzag sawfly
- **Hosts:** elm
- **Active:** May–Sep
- **About:** Invasive sawfly first found in North America in Virginia (2021), now in Maryland and neighboring states. Larvae feed in a zigzag pattern from the leaf edge inward, then consume whole leaves. Several generations a year can defoliate elms by late summer. Healthy elms usually recover from occasional defoliation, so treatment is rarely needed except on high-value or stressed trees. No insecticide is labeled specifically for it yet. Use products labeled for sawflies on trees and shrubs.
- **Sources:** Virginia Cooperative Extension ENTO-543 (pubs.ext.vt.edu/ENTO/ento-543/ento-543.html); USDA Forest Service pest alert; Illinois Extension (2025)

**Cultural**
- Monitor: Look for zigzag feeding on elm leaves from May. Report new county finds to the state department of agriculture.
- Mechanical: On small trees, pick larvae off into soapy water.
- Fertility: Water and mulch defoliated elms to support recovery.

**Chemical**

| | Method | Active ingredient | Months | Apps | Interval | Repeat | Timing | Notes |
|---|---|---|---|---|---|---|---|---|
| ★✓ | Foliar spray | Spinosad | May–Jul | 1–2 | — | Per generation | As soon as larvae are found feeding in spring, repeat for later generations | Use a product labeled for sawflies on trees |
| | Foliar spray | Bifenthrin or pyrethrins | May–Jul | 1–2 | — | Per generation | Young larvae | Pyrethroid mite-flare risk |
| | Foliar spray | Dinotefuran | May–Jun | 1 | — | As needed | Larvae present | Effective in bioassays. Field data pending. Confirm the label allows foliar use on elm |

### Box tree moth
- **Hosts:** boxwood
- **About:** First detected in Virginia (Clarke and Loudoun Counties) and in Maryland in July 2025. Report suspected finds to VDACS (Virginia) or MDA (Maryland). Movement of boxwood from regulated areas may be restricted.
- **Sources:** VDACS press release, July 24, 2025; University of Maryland Extension, Invasive Insects

## Adelgids

### Hemlock woolly adelgid
- **Hosts:** hemlock
- **About:** Virginia, Maryland and federal programs release predator beetles (Laricobius nigrinus) and silver flies (Leucotaraxis) for long-term HWA control. Coordinate with the state forest health program before treating trees at or near release sites.
- **Sources:** Virginia Department of Forestry and Maryland Department of Agriculture forest pest programs

**Cultural**
- Biocontrol: In natural areas, ask the state forest health program about predator beetle releases. Do not apply insecticide to release trees.


### Spotted lanternfly
- **Hosts:** treeofheaven
- **About:** Current extension practice: use circle traps on trunks rather than bare sticky bands, which catch birds and other wildlife (if bands are used, cage them with wire mesh). Removing every tree of heaven can push lanternflies onto desirable plants. Keep a few male (non-seeding) trees as trap trees treated with a systemic insecticide, and remove the rest.
- **Sources:** Penn State Extension Spotted Lanternfly Management Guide; Rutgers Extension SLF trapping; Michigan State University SLF update (2020)

**Cultural**
- Mechanical: Put circle traps on infested trunks. Avoid bare sticky bands (wildlife bycatch).
- Mechanical: Scrape egg masses Oct–Apr into alcohol or hand sanitizer.
- Removal: Remove female (seeding) tree of heaven after treating it with herbicide. Keep about 15% of male trees as systemic-treated trap trees.

**Chemical**

| | Method | Active ingredient | Months | Apps | Interval | Repeat | Timing | Notes |
|---|---|---|---|---|---|---|---|---|
| | Micro-injection | Imidacloprid | Jun–Jul | 1 | — | Annually | Trap trees and infested ornamentals, early summer | Not on linden or fruiting trees |

# Diseases

## Foliage diseases and needlecasts

### Beech leaf disease
- **Hosts:** beech
- **Active:** May–Nov
- **About:** Caused by a foliar nematode (Litylenchus crenatae mccannii). Current best practice for high-value trees is thiabendazole root flare injection every 2–3 years, with phosphite basal bark or soil applications and foliar fluopyram as alternatives or additions. Dark green bands between the leaf veins, seen best from below, then thickened, leathery, crinkled leaves, bud abortion, thinning canopy and death of smaller trees within years. Nematodes overwinter in buds and move into new buds from late summer. Confirmed in Prince William County, VA (2021), spreading in Northern Virginia, and confirmed in at least 12 Maryland counties plus Baltimore City (MDA, 2025). There is no cure. Treatments suppress symptoms on individual high-value trees. Trees in dense beech stands are poor candidates for foliar treatment because untreated neighbors reinfest them.
- **Sources:** Loyd et al., Thiabendazole as a therapeutic root flare injection for BLD, Arboriculture & Urban Forestry 51(3) (2025); EPA label MA240001 (Arbotect 20-S, 2024); Penn State Extension BLD; Maine DACF BLD; Bartlett Tree Research Labs / USDA-ARS fluopyram study (2025, PMC12497451); Connecticut Agricultural Experiment Station BLD management options (2025); URI Cooperative Extension BLD updates (2023–2024); Maryland Department of Agriculture press release, June 9, 2025; Virginia Cooperative Extension (2025); Fairfax County BLD guidance

**Cultural**
- Monitor: Look for dark interveinal banding on leaves (seen best from below) and aborted buds. Report new finds to the state forest health program.
- Soil & water: Mulch the root zone and irrigate in drought to reduce stress.
- Fertility: A summer root biostimulant may help offset stress. Avoid excess nitrogen.
- Removal: In dense stands, plan for loss of heavily affected trees. Remove hazardous dead beech.

**Chemical**

| | Method | Active ingredient | Months | Apps | Interval | Repeat | Timing | Notes |
|---|---|---|---|---|---|---|---|---|
| ★✓ | Macro-injection | Thiabendazole | May–Sep | 1 | — | Every 2–3 yrs | Root flare injection at or below ground level, after leaf expansion with moist soil | Peer-reviewed (Loyd et al. 2025, Arboriculture & Urban Forestry): improved canopy and reduced nematodes in buds at 11 and 22 months. Labeled for BLD (Arbotect 20-S). Fairfax County rates it "very effective". Trunk-wood injection is less effective. Retreat every 2–3+ years or when symptoms return |
| ★ | Basal bark | Potassium phosphite | Jun–Aug | 2–3 | 30 d | Annually | June to early August (May–Aug window). Wet the bark from the ground up, about 1 ft of height per inch of DBH | Published protocols use 2 applications a month apart. A third is arborist practice. CAES: a surfactant (e.g. Pentra-Bark) does not improve uptake. Results build over several years |
| ★ | Foliar spray | Fluopyram | Jun–Aug | 2 | 30 d | Annually | Late May to mid-July, before nematodes move into buds in early August. CAES allows late May to late August | Peer-reviewed suppression (Bartlett/USDA-ARS 2025). Best on isolated trees. Very toxic to aquatic life: no use near water or storm drains. Professional use. Rotate modes of action |
| ★ | Soil drench | Potassium phosphite | Jun–Jul | 2 | 30 d | Annually | June and July, one month apart | Most support on small trees, and results vary by site. Improvement may take several years. Follow the product label rate |
| | Micro-injection | Potassium phosphite | May–Jul | 1 | — | Annually | After leaf expansion | Manufacturer trials (2024–2025) only. Independent replication pending |

## Root diseases

### Phytophthora root rot
- **Hosts:** general
- **About:** Phosphite (phosphonate) trunk injection is a current option for valuable trees. A meta-analysis of phosphite treatments on temperate trees found reduced Phytophthora symptoms in nearly all experiments, and field trials on other Phytophthora tree diseases show strong suppression of trunk lesions. High concentrations can scorch leaves.
- **Sources:** Bangor University systematic review of biochemical control of Phytophthora in temperate trees; Kauri Protection phosphite trunk injection trials (NZ); Michigan State University (Hausbeck) Segovis trials; Plant Disease Management Reports (oxathiapiprolin); Segovis label

**Chemical**

| | Method | Active ingredient | Months | Apps | Interval | Repeat | Timing | Notes |
|---|---|---|---|---|---|---|---|---|
| | Micro-injection | Potassium phosphite | Apr–Jun, Sep–Oct | 1–2 | — | Annually | Spring after leaf-out and/or early fall, soil moist | Use a phosphite labeled for trunk injection. Leaf scorch possible at high concentrations. Evidence is mostly from other Phytophthora systems |
| ★ | Soil drench | Oxathiapiprolin | Apr, Aug–Sep | 1–2 | — | Annually | Preventive drench before disease develops, spring and late summer | Newer FRAC 49 fungicide, highly effective on Phytophthora root rot in university trials. Labeled for commercial landscapes. Rotate or tank-mix with phosphite or mefenoxam |

## Cankers

### Phytophthora bleeding canker
- **Hosts:** general
- **About:** Phosphite trunk injection is an alternative to bark spray for valuable trees.
- **Sources:** Bangor University systematic review; Kauri Protection phosphite trunk injection trials (NZ)

**Chemical**

| | Method | Active ingredient | Months | Apps | Interval | Repeat | Timing | Notes |
|---|---|---|---|---|---|---|---|---|
| | Micro-injection | Potassium phosphite | Apr–Jun, Sep–Oct | 1–2 | — | Annually | Spring after leaf-out and/or early fall | Labeled trunk-injection phosphite. Leaf scorch possible at high concentrations |

## Foliage diseases and needlecasts

### Anthracnose
- **Hosts:** general
- **About:** Trunk-injected triazoles (propiconazole, tebuconazole) are labeled for anthracnose on shade trees and avoid canopy spraying on large trees. Independent efficacy data is limited, so use them as a preventive program alongside sanitation.
- **Sources:** PNW Plant Disease Management Handbook (propiconazole registered for trunk injection); Alamo, Propizol and Tebuject 16 labels

**Chemical**

| | Method | Active ingredient | Months | Apps | Interval | Repeat | Timing | Notes |
|---|---|---|---|---|---|---|---|---|
| | Micro-injection | Propiconazole or tebuconazole | Sep–Oct, Mar–Apr | 1 | — | Annually | Preventive: fall after leaf drop begins, or early spring before budbreak per label | Labeled injectable. Independent efficacy data limited. FRAC 3: rotate with non-triazoles |

### Scab (apple, pear, pyracantha and others)
- **Hosts:** apple
- **About:** On ornamental crabapple, a trunk-injected triazole (tebuconazole or propiconazole) is a labeled preventive alternative to repeated canopy sprays. Independent efficacy data is limited.
- **Sources:** PNW Plant Disease Management Handbook, crabapple scab; Tebuject 16 and Propizol labels

**Chemical**

| | Method | Active ingredient | Months | Apps | Interval | Repeat | Timing | Notes |
|---|---|---|---|---|---|---|---|---|
| | Micro-injection | Tebuconazole or propiconazole | Sep–Oct, Mar | 1 | — | Annually | Preventive, fall or early spring before budbreak per label | Ornamental crabapple only, not edible fruit. Independent efficacy data limited |

## Blights

### Fire blight (Erwinia)
- **Hosts:** pear
- **About:** Extension guidance (Wisconsin 2025, UC): chemical control is often impractical on large landscape trees, so cultural control comes first. Streptomycin is the most effective bloom spray where labeled. Callery pear strains, including 'Bradford', are now readily infected, and Callery pear is invasive, so steer clients away from planting it.
- **Sources:** University of Wisconsin Extension, Fire Blight (2025); University of Missouri IPM, Fire Blight on Ornamental Pear; UC Cooperative Extension fire blight presentation (2017); University of Arkansas FSA-7534

**Cultural**
- Fertility: Avoid heavy nitrogen and heavy summer pruning, which drive succulent, susceptible growth.
- Prune: Remove extensive infections in the dormant season. Disinfect tools between cuts.
- Plant selection: Replace with fire-blight-resistant crabapple, serviceberry and pear cultivars. Do not plant invasive Callery pear.

**Chemical**

| | Method | Active ingredient | Months | Apps | Interval | Repeat | Timing | Notes |
|---|---|---|---|---|---|---|---|---|
| | Foliar spray | Streptomycin | Apr | 2–4 | 3–4 d | Annually | During bloom when weather favors infection. Not after bloom except within 24 h of hail or wind-driven rain | Confirm ornamental use is on the label. Never spray oozing shoots (breeds resistance) |

## Foliage diseases and needlecasts

### Anthracnose
- **Hosts:** general
- **About:** Chlorothalonil, thiophanate-methyl and copper are the standard extension-listed protectants for sycamore and dogwood anthracnose. For dogwood, use a systemic (propiconazole or tebuconazole) at budbreak, then a protectant about 2 weeks later, with complete coverage. Cultural measures come first, and resistant dogwoods are available.
- **Sources:** Colorado State Extension, Sycamore anthracnose; University of Arkansas Plant Health Clinic (dogwood anthracnose); University of Illinois Extension

**Chemical**

| | Method | Active ingredient | Months | Apps | Interval | Repeat | Timing | Notes |
|---|---|---|---|---|---|---|---|---|
| ★ | Foliar spray | Chlorothalonil or thiophanate-methyl | Apr–Jun | 2–3 | 7–14 d | Annually | Protectant from budbreak as leaves emerge, about 2 wk after a systemic at budbreak | Rotate FRAC groups (M5 / 1) |

### Spot anthracnose of dogwood (Elsinoe)
- **Hosts:** dogwood
- **About:** Illinois and Arkansas extension list chlorothalonil and thiophanate-methyl protectants as well as triazoles.
- **Sources:** University of Illinois Extension; University of Arkansas Plant Health Clinic

**Chemical**

| | Method | Active ingredient | Months | Apps | Interval | Repeat | Timing | Notes |
|---|---|---|---|---|---|---|---|---|
| | Foliar spray | Chlorothalonil or thiophanate-methyl | Apr–May | 2–3 | 14 d | Annually | From budbreak or bloom | Rotate with propiconazole |

### Leaf spot (various fungi)
- **Hosts:** general
- **About:** Chlorothalonil and thiophanate-methyl are standard broad-spectrum protectants for landscape leaf spots, alongside the manual's options.
- **Sources:** Colorado State Extension; University of Illinois Extension

**Chemical**

| | Method | Active ingredient | Months | Apps | Interval | Repeat | Timing | Notes |
|---|---|---|---|---|---|---|---|---|
| | Foliar spray | Chlorothalonil or thiophanate-methyl | Apr–Aug | 2–4 | 14 d | Annually | From budbreak in wet springs | Rotate FRAC groups |

## Vascular and wilt diseases

### Rose rosette
- **Hosts:** rose
- **About:** Current extension guidance (UGA 2025, Colorado State 2025, UT 2024) is to remove symptomatic plants early, roots included, bagged and not composted. Miticides are not recommended or have shown limited effect. In the 2018 Texas A&M / Tennessee field trial, roses sprayed every 14 days with fenpyroximate, spiromesifen, spirotetramat or bifenthrin stayed symptom-free, while **abamectin + oil was ineffective**. If a miticide program is sold to protect nearby high-value roses, use those products and present it as unproven.
- **Sources:** UGA Extension Circular 1176 (2025); Colorado State Extension, Rose rosette disease (2025); University of Tennessee W1284 (2024); Windham et al. 2018 ASHS abstract (Texas A&M / UT)

**Chemical**

| | Method | Active ingredient | Months | Apps | Interval | Repeat | Timing | Notes |
|---|---|---|---|---|---|---|---|---|
| ✗ | Foliar spray | Abamectin + horticultural oil | Apr–Sep | 6 | 14 d | Annually | Ineffective against the rose rosette mite vector in the 2018 field trial | — |
| | Foliar spray | Fenpyroximate | Apr–Sep | 6 | 14 d | Annually | Every 14 d on adjacent healthy roses, alternating with spiromesifen | Effective in 2018 trial. Efficacy against disease spread is still unproven |

## Blights

### Boxwood blight
- **Hosts:** boxwood
- **About:** Current Virginia guidance (SPES-557) puts prevention and sanitation first. Once boxwood blight is in a landscape it is hard and costly to control with fungicides, which protect but do not cure. After diagnosis, double-bag diseased plants, leaf litter and surface soil for the landfill, then spray nearby healthy boxwood every 7–14 days per label. Chlorothalonil and fludioxonil are established protectants. Rotate and mix chemistries, and get thorough coverage inside dense canopies.
- **Sources:** Virginia Tech SPES-557 boxwood blight BMPs (2023); University of Delaware Extension boxwood blight fact sheet; NC State fungicide trials (Ivors); Purdue BP-203-W

**Cultural**
- Sanitation: After diagnosis, double-bag diseased plants, leaf litter and surface soil for the landfill, or bury them 2 ft deep away from boxwood.

**Chemical**

| | Method | Active ingredient | Months | Apps | Interval | Repeat | Timing | Notes |
|---|---|---|---|---|---|---|---|---|
| ★ | Foliar spray | Chlorothalonil | Apr–Oct | 6–12 | 7–14 d | Annually | Protectant program on healthy boxwood near infections, warm wet weather (above 60°F with rain expected) | Rotate. Some labels restrict use near playgrounds, schools and daycare |
| ★ | Foliar spray | Fludioxonil + chlorothalonil | Apr–Oct | 6–12 | 7–14 d | Annually | Tank mix, same timing | Rotate with other chemistries |

## Vascular and wilt diseases

### Oak wilt
- **Hosts:** oak
- **About:** Sap beetles find fresh wounds within minutes, and wounds stay attractive for about 3 days. If an oak must be pruned or wounded during the growing season, seal the wound immediately. This is the one case where wound paint is recommended. Do not move unseasoned firewood from diseased red oaks. Repeat preventive propiconazole about every 2 years.
- **Sources:** Texas A&M Plant Disease Handbook, Eight Step Program to Oak Wilt Management; Michigan State University Extension; NY DEC oak wilt booklet

**Cultural**
- Prune: If pruning or wounding oaks Apr–Jul cannot be avoided, seal the wound immediately with pruning sealer or latex paint.
- Sanitation: Do not move unseasoned firewood from diseased oaks. Season it for at least a year or debark it.

## Blights

### Boxwood dieback
- **Hosts:** boxwood
- **Active:** Apr–Oct
- **About:** Caused by the fungus Colletotrichum theobromicola. Leaves bleach to tan, often on scattered branches, with dark streaks under the bark of affected stems. It spreads on infected nursery stock and may enter through pruning cuts. Do not confuse it with boxwood blight (black stem lesions, rapid leaf drop) or Volutella blight. Phytophthora root rot programs do not control it. No preventive spray is recommended by Virginia Cooperative Extension. Lab tests rank difenoconazole + pydiflumetofen and the strobilurin mixes highest, but these are not field-validated.
- **Sources:** NC IPM / NC State Extension boxwood dieback alert (2019); LSU fungicide screening (2022); Purdue Landscape Report; Virginia Cooperative Extension position as reported by Piedmont Master Gardeners

**Cultural**
- Removal: Remove and destroy symptomatic plants. Pruning out dead twigs does not control it.
- Sanitation: Disinfect pruning tools between plants. Avoid unnecessary wounding and pruning in wet weather.
- Plant selection: Inspect and isolate new boxwood. Buy from nurseries with clean-stock programs.
- Monitor: Send samples to a diagnostic lab to separate dieback from blight and Volutella.

**Chemical:** None validated. No preventive spray is recommended. Any fungicide use is experimental.

## Foliage diseases and needlecasts

### Leaf spot (various fungi)
- **Hosts:** tupelo, mulberry, persimmon, smoketree
- **About:** Common on more hosts than the manual lists. Black gum (Mycosphaerella nyssicola) gets black-freckled leaves and early leaf drop, worse in alkaline soil, and some newer cultivars resist it. Mulberry (Cercospora, Cercosporella) is hit in very rainy seasons. Persimmon and smoke tree leaf spots are usually minor. Raking fallen leaves and good soil care come first. Fungicides are rarely justified except on specimen trees with a history.
- **Sources:** Clemson HGIC black gum; UF/IFAS EDIS ST422 (Nyssa sylvatica); Texas A&M Plant Disease Handbook, mulberry; UF/IFAS EDIS ST204 (Cotinus); USDA PLANTS fact sheet (persimmon)

### Powdery mildew
- **Hosts:** mulberry
- **About:** Also affects mulberry buds and young leaves.
- **Sources:** Texas A&M Plant Disease Handbook, mulberry

## Blights

### Bacterial blight (Pseudomonas)
- **Hosts:** mulberry
- **About:** Bacterial blight of mulberry causes water-soaked leaf spots, black streaks on shoots and wilting shoot tips.
- **Sources:** Texas A&M Plant Disease Handbook, mulberry

# Vegetation management

## Vegetation management

### Tree of heaven control
- **Hosts:** treeofheaven
- **Active:** Jul–Oct
- **About:** An invasive tree and the preferred host of spotted lanternfly. Cutting it without herbicide makes it worse, because it answers with masses of stump sprouts and root suckers, and cut-stump treatment also encourages suckering. Use hack-and-squirt in mid to late summer so herbicide moves to the roots. Expect follow-up treatment of resprouts for several years. Where lanternfly is present, keep a few male trees as systemic-treated trap trees (see Spotted lanternfly).
- **Sources:** Penn State Extension, Tree-of-Heaven; Penn State Center for Private Forests (2023); Alabama Extension, Tree-of-Heaven identification and control; Pennsylvania Department of Agriculture invasive species brochure

**Cultural**
- Removal: Do not cut tree of heaven before herbicide. For hazard trees, treat first and fell about 30 days later.
- Monitor: Recheck treated stands each summer and treat resprouts and suckers.

**Chemical**

| | Method | Active ingredient | Months | Apps | Interval | Repeat | Timing | Notes |
|---|---|---|---|---|---|---|---|---|
| ★✓ | Cut surface | Triclopyr or glyphosate | Jul–Sep | 1 | — | Annually | Hack-and-squirt, mid to late summer (before fall color): downward cuts spaced around the trunk, about one per inch of diameter, minimum 2 | Do not girdle completely. Living tissue between cuts carries herbicide to the roots |
| | Foliar spray | Triclopyr or glyphosate | Jul–Aug | 1 | — | Annually | Low, dense sprouts and seedlings first, then hack-and-squirt larger stems | Keep spray off desirable plants |

# Insects and mites

## Ticks and nuisance insects

### Ticks
- **Hosts:** site
- **About:** Integrated tick management: rodent-targeted fipronil bait boxes cut tick infection in mice and reduce questing nymphs, and work best combined with a broadcast fungal biopesticide (Metarhizium) for a 52–95% reduction in Connecticut trials. Caution: a randomized trial of bait boxes alone (622 Connecticut households) found no reduction in household tick encounters or disease, so sell them as part of a program, not alone.
- **Sources:** Connecticut Agricultural Experiment Station integrated control of Ixodes scapularis; Williams et al., J. Medical Entomology (2022), Guilford CT; CDC TickNET randomized trial (Hinckley et al. 2021); Northeast IPM host-targeted tick control

**Chemical**

| | Method | Active ingredient | Months | Apps | Interval | Repeat | Timing | Notes |
|---|---|---|---|---|---|---|---|---|
| | Granular / bait | Fipronil rodent bait boxes | Apr, Jul | 2 | — | Annually | Spring (nymph season) and mid-summer, at woodland edges, stone walls and brush | Licensed professional product. Combine with other measures |
| | Foliar spray | Metarhizium brunneum (fungal biopesticide) | May–Jun | 1–2 | — | Annually | Broadcast to edge habitat during nymph activity | Low-toxicity option. Most effective with bait boxes |

### Mosquitoes
- **Hosts:** site
- **About:** Larviciding standing water that can't be emptied (rain barrels, ponds, drains) with Bti is a low-risk standard alongside source reduction.
- **Sources:** EPA and CDC mosquito control guidance

**Chemical**

| | Method | Active ingredient | Months | Apps | Interval | Repeat | Timing | Notes |
|---|---|---|---|---|---|---|---|---|
| | Granular / bait | Bacillus thuringiensis israelensis (Bti) | May–Sep | 4–5 | 30 d | Annually | Dunks or granules in standing water that can't be emptied | Specific to mosquito and black fly larvae. Safe for fish, pets and wildlife |

# Vegetation management

## Vegetation management

### Japanese knotweed
- **Hosts:** site
- **About:** Late-season timing is what kills the rhizomes. After flowering (September–October), knotweed sends sugars to its roots and carries herbicide with them. If cut, wait at least 8 weeks before spraying regrowth. Results may not show until the next spring.
- **Sources:** Penn State Extension, Japanese knotweed; Oregon State Extension (Multnomah Co.); University of Kentucky roadside trial (2006); Whatcom County Noxious Weed Board

**Chemical**

| | Method | Active ingredient | Months | Apps | Interval | Repeat | Timing | Notes |
|---|---|---|---|---|---|---|---|---|
| ★ | Foliar spray | Glyphosate | Sep–Oct | 1 | — | Annually | After flowering, before frost. At least 8 wk after any cutting | No soil activity, so safe near trees. Repeat for several seasons |
| | Foliar spray | Imazapyr | Jul–Oct | 1 | — | Annually | Late June to mid-October | **Soil-active: can injure nearby trees through their roots.** Avoid within tree root zones |

### Phragmites
- **Hosts:** site
- **About:** Imazapyr gives the best residual control (June–September). Glyphosate or glyphosate + imazapyr works late summer after bloom to first frost. Use aquatic-labeled formulations near water and never spray over open water.
- **Sources:** Lancaster County NE Phragmites guide; Kansas State University; Great Lakes Phragmites Collaborative herbicide quick guide; Penn State Extension

**Chemical**

| | Method | Active ingredient | Months | Apps | Interval | Repeat | Timing | Notes |
|---|---|---|---|---|---|---|---|---|
| ★ | Foliar spray | Imazapyr | Jun–Sep | 1 | — | Annually | Full leaf elongation through early fall | Aquatic-labeled near water. Soil-active: keep away from desirable tree roots |
| | Foliar spray | Glyphosate | Aug–Oct | 1 | — | Annually | After full bloom, before first killing frost | Aquatic formulation near water |

# Wildlife and other pests

## Wildlife and other pests

### Jumping worms
- **Hosts:** site
- **Active:** May–Nov
- **About:** Invasive Amynthas earthworms, now widespread in Virginia and Maryland. They turn mulch and topsoil into loose, coffee-ground-like castings, strip organic matter, and leave shallow-rooted plants and new plantings drought-prone. Adults die in winter, and cocoons in the soil carry them to new sites in mulch, compost and plant soil.
- **Sources:** University of Maryland Extension; Virginia Cooperative Extension

**Cultural**
- Sanitation: Do not move mulch, compost or soil from infested beds. Clean soil off tools and equipment between sites.
- Plant selection: Inspect the root balls of incoming plants for worms and castings.
- Soil & water: Use fine, well-aged mulch, irrigate new plantings closely, and rebuild organic matter.

**Chemical:** None labeled.
