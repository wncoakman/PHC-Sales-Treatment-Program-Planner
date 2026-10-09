# Current supplement to the pest management reference

The 2024 manual is the primary reference. This file adds problems it does not cover and updates entries where newer information exists. It uses the same format as `pest-management-reference.md`. An entry with a new heading becomes a new problem. An entry whose heading matches a manual entry is merged into it: its About becomes an "Update" line, and its cultural bullets, chemical rows and sources are appended.

In this file ★ means the best-supported current option, not a manual bold. Last verified: October 2026. Re-check each entry's sources at least yearly.

**Rule-based additions (applied by the build, listed here for review):**
- **Btk for caterpillars:** a Bacillus thuringiensis kurstaki (Btk) foliar row is added to the defoliating caterpillar entries listed in `BTK_FOR` in `scripts/build-kb.mjs`, timed like the entry's main caterpillar spray. Btk is the standard selective option for young larvae and spares natural enemies, but the manual omits it. Sources: Ohio State BYGL (bagworm); UGA and University of Maryland Extension (box tree moth).
- **Product status notes:** mancozeb (pending EPA decision on residential ornamental uses), acephate (EPA proposed keeping only tree injection) and emamectin benzoate (TREE-äge formulations are restricted use) are noted on every option that uses them.

# Insects and mites

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
- **About:** Caused by a foliar nematode (Litylenchus crenatae mccannii). Dark green bands between the leaf veins, seen best from below, then thickened, leathery, crinkled leaves, bud abortion, thinning canopy and death of smaller trees within years. Nematodes overwinter in buds and move into new buds from late summer. Confirmed in Prince William County, VA (2021), spreading in Northern Virginia, and confirmed in at least 12 Maryland counties plus Baltimore City (MDA, 2025). There is no cure. Treatments suppress symptoms on individual high-value trees. Trees in dense beech stands are poor candidates for foliar treatment because untreated neighbors reinfest them.
- **Sources:** Bartlett Tree Research Labs / USDA-ARS fluopyram study (2025, PMC12497451); Connecticut Agricultural Experiment Station BLD management options (2025); URI Cooperative Extension BLD updates (2023–2024); Maryland Department of Agriculture press release, June 9, 2025; Virginia Cooperative Extension (2025); Fairfax County BLD guidance

**Cultural**
- Monitor: Look for dark interveinal banding on leaves (seen best from below) and aborted buds. Report new finds to the state forest health program.
- Soil & water: Mulch the root zone and irrigate in drought to reduce stress.
- Fertility: A summer root biostimulant may help offset stress. Avoid excess nitrogen.
- Removal: In dense stands, plan for loss of heavily affected trees. Remove hazardous dead beech.

**Chemical**

| | Method | Active ingredient | Months | Apps | Interval | Repeat | Timing | Notes |
|---|---|---|---|---|---|---|---|---|
| ★✓ | Foliar spray | Fluopyram | Jun–Aug | 2 | 30 d | Annually | Late May to mid-July, before nematodes move into buds in early August. CAES allows late May to late August | Only peer-reviewed treatment shown to suppress BLD. Best on isolated trees. Very toxic to aquatic life: no use near water or storm drains. Professional use. Rotate modes of action |
| ★ | Soil drench | Potassium phosphite | Jun–Jul | 2 | 30 d | Annually | June and July, one month apart | Most support on small trees, and results vary by site. Improvement may take several years. Follow the product label rate |
| | Micro-injection | Potassium phosphite | May–Jul | 1 | — | Annually | After leaf expansion | Manufacturer trials (2024–2025) only. Independent replication pending |

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
