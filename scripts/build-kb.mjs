// Build web/data/knowledge_base.json from reference/pest-management-reference.md (primary)
// plus reference/blake-kb-v1.1.json (jurisdictions, regulatory overlays, abiotic disorders).
// Run: npm run build:kb
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const md = readFileSync(new URL("reference/pest-management-reference.md", root), "utf8");
const blake = JSON.parse(readFileSync(new URL("reference/blake-kb-v1.1.json", root), "utf8"));

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const METHODS = {
  "foliar spray": "foliar",
  "dormant spray": "dormantOil",
  "bark spray": "barkSpray",
  "basal bark": "basalBark",
  "soil drench": "soilDrench",
  "micro-injection": "microInjection",
  "macro-injection": "macroInjection",
  "granular / bait": "granular",
  "cut surface": "cutSurface",
  "biological drench": "bioDrench",
};
const CULTURAL_TAGS = {
  prune: "pruning",
  sanitation: "mechanical",
  mechanical: "mechanical",
  "soil & water": "soilCare",
  fertility: "fertilization",
  site: "cultural",
  "plant selection": "cultural",
  monitor: "cultural",
  biocontrol: "biocontrol",
  removal: "replacement",
};
const APPLICATION_TYPES = [
  ["foliar", "Foliar spray"],
  ["dormantOil", "Dormant spray (oil, soap, copper)"],
  ["barkSpray", "Bark / trunk spray"],
  ["basalBark", "Systemic basal bark spray"],
  ["soilDrench", "Systemic soil drench / soil injection"],
  ["microInjection", "Micro-injection (direct systemic)"],
  ["macroInjection", "Macro-injection (direct systemic)"],
  ["granular", "Granular, bait or tick tube"],
  ["cutSurface", "Cut stump / hack-and-squirt"],
  ["bioDrench", "Biological soil drench (beneficial nematodes)"],
  ["biocontrol", "Biological control release"],
  ["pruning", "Pruning"],
  ["mechanical", "Mechanical / sanitation"],
  ["soilCare", "Soil, water & root care"],
  ["fertilization", "Plant health fertilization / nutrient treatment"],
  ["cultural", "Cultural care & site management"],
  ["diagnostic", "Lab diagnosis / monitoring visit"],
  ["replacement", "Removal & replacement"],
].map(([id, name]) => ({ id, name }));

// Hosts whose bloom attracts pollinators: neonicotinoid / pyrethroid options get the pollinator flag.
const FLOWERING = new Set(["apple", "catalpa", "cherry", "cherrylaurel", "cotoneaster", "crapemyrtle", "dogwood", "hawthorn",
  "horsechestnut", "hydrangea", "kalmia", "lilac", "linden", "locust", "magnolia", "peach", "pear", "perennials", "photinia",
  "pieris", "pyracantha", "redbud", "rose", "serviceberry", "tuliptree", "viburnum", "azalea", "camellia", "holly", "privet",
  "smoketree", "persimmon", "sassafras", "tupelo", "vinca", "maple", "willow"]);

// Blake KB ids → reference ids, so its regulatory data, ID symptoms and thresholds carry over.
const RENAMED = {
  "two-lined-chestnut-borer": "twolined-chestnut-borer",
  "beech-scale": "beech-bark-scale",
  aphids: "aphids-general",
  bagworm: "bagworms",
  phytophthora: "phytophthora-root-rot",
  verticillium: "verticillium-wilt",
  diplodia: "diplodia-tip-blight",
  "cedar-apple-rust": "cedar-apple-and-related-rusts",
};
const OVERLAY_FIELDS = ["scientificName", "symptoms", "lookalikeIds", "maxCrownLossPercent", "cautionCrownLossPercent",
  "regulatory", "costShare", "labConfirmation"];
// Blake KB items the manual does not cover; kept whole as a supplement.
const SUPPLEMENT = ["wetwood", "ash-yellows", "tobacco-rattle-virus", "drought", "winter-injury", "nutrient-deficiency",
  "soil-compaction", "girdling-roots", "salt-damage", "irrigation"];
const SUPPLEMENT_CATEGORY = { abiotic: ["abiotic", "Abiotic disorders and cultural stresses"], viral: ["viral", "Viral and phytoplasma diseases"],
  bacterial: ["vascular-and-wilt-diseases", null], fungal: ["vascular-and-wilt-diseases", null] };

const errors = [];
const fail = (msg) => errors.push(msg);
const slug = (s) => s.toLowerCase().replace(/\([^)]*\)/g, "").replace(/[–—]/g, "-").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const cells = (line) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

function parseMonths(text, where) {
  text = text.replace(/\([^)]*\)/g, "").trim().toLowerCase();
  if (/^year-round/.test(text)) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const out = new Set();
  for (const part of text.split(",").map((p) => p.trim()).filter(Boolean)) {
    const [a, b] = part.split(/[–-]/).map((p) => MONTHS.indexOf(p.trim().slice(0, 3)) + 1);
    if (!a || (part.match(/[–-]/) && !b)) { fail(`${where}: bad months "${part}"`); continue; }
    for (let m = a; ; m = (m % 12) + 1) { out.add(m); if (m === (b || a)) break; }
  }
  return [...out].sort((x, y) => x - y);
}

function parseVisits(text, where) {
  const m = text.match(/^(\d+)(?:\s*[–-]\s*(\d+))?$/);
  if (!m) { fail(`${where}: bad apps "${text}"`); return [1, 1]; }
  return [Number(m[1]), Number(m[2] || m[1])];
}

// ---- hosts table ----
const hosts = [];
{
  const sec = md.split(/^## Host plants$/m)[1].split(/^## /m)[0];
  for (const line of sec.split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| id"))) {
    const [id, name, includes] = cells(line);
    hosts.push({ id, name, ...(includes && includes !== "—" ? { includes } : {}) });
  }
}
const hostIds = new Set(hosts.map((h) => h.id));

// ---- conditions ----
const categories = [];

/** Parse the condition sections (from "# Insects and mites" on) of a reference-format markdown file. */
function parseConditions(text, defaultSource) {
const conditions = [];
const body = text.slice(text.indexOf("\n# Insects and mites"));
let category = null;
let cond = null;
let mode = null;

for (const raw of body.split("\n")) {
  const line = raw.trimEnd();
  if (line.startsWith("# ")) { category = null; continue; }
  if (line.startsWith("## ")) {
    const name = line.slice(3).trim();
    category = slug(name);
    if (!categories.some((c) => c.id === category)) categories.push({ id: category, name });
    cond = null;
    continue;
  }
  if (line.startsWith("### ")) {
    const name = line.slice(4).trim();
    cond = { id: slug(name), name, category, hostIds: [], symptoms: [], biology: [], treatments: [], sources: [defaultSource] };
    if (!category) fail(`${name}: no category`);
    conditions.push(cond);
    mode = "meta";
    continue;
  }
  if (!cond) continue;
  const meta = line.match(/^- \*\*(Hosts|Active|GDD|About|Sources):\*\* (.*)$/);
  if (meta && mode === "meta") {
    const [, key, val] = meta;
    if (key === "Hosts") {
      for (const h of val.split(",").map((s) => s.trim())) {
        if (h === "general") cond.generalist = true;
        else if (hostIds.has(h)) cond.hostIds.push(h);
        else fail(`${cond.name}: unknown host "${h}"`);
      }
    } else if (key === "Active") {
      cond.activeMonths = parseMonths(val, cond.name);
      const note = val.match(/\(([^)]*)\)/);
      if (note) cond.peakNote = note[1];
    } else if (key === "GDD") cond.peakNote = [cond.peakNote, `GDD ${val}`].filter(Boolean).join(" · ");
    else if (key === "About") cond.biology.push(val);
    else if (key === "Sources") cond.sources = val.split(";").map((x) => x.trim());
    continue;
  }
  if (line === "**Cultural**") { mode = "cultural"; continue; }
  if (line === "**Chemical**") { mode = "chemical"; continue; }
  const none = line.match(/^\*\*Chemical:\*\* (.*)$/);
  if (none) { cond.curable = false; cond.warnings = [`No effective chemical treatment: ${none[1].replace(/^None( effective)?\.?\s*/, "")}`.replace(/: $/, ".")]; mode = null; continue; }
  if (mode === "cultural" && line.startsWith("- ")) {
    const m = line.match(/^- ([A-Za-z &]+): (.*)$/);
    const type = m && CULTURAL_TAGS[m[1].toLowerCase()];
    if (!type) { fail(`${cond.name}: bad cultural tag in "${line}"`); continue; }
    cond.treatments.push({ applicationType: type, title: m[2] });
    continue;
  }
  if (mode === "chemical" && line.startsWith("|") && !line.startsWith("|---")) {
    const c = cells(line);
    if (c[1] === "Method") continue; // header row
    if (c.length !== 9) { fail(`${cond.name}: row has ${c.length} cells: ${line}`); continue; }
    const [mark, method, ai, months, apps, interval, repeat, timing, notes] = c;
    const type = METHODS[method.toLowerCase()];
    if (!type) { fail(`${cond.name}: unknown method "${method}"`); continue; }
    const [visitsMin, visitsMax] = parseVisits(apps, cond.name);
    cond.treatments.push({
      applicationType: type,
      title: `${ai} (${method.toLowerCase()})`,
      activeIngredient: ai,
      months: parseMonths(months, `${cond.name} / ${ai}`),
      schedule: { visitsMin, visitsMax, ...(interval !== "—" ? { interval } : {}), repeat, window: timing },
      ...(mark.includes("★") ? { preferred: true } : {}),
      ...(mark.includes("✓") ? { default: true } : {}),
      notes: notes === "—" ? [] : [notes],
    });
  }
}
return conditions;
}

const conditions = parseConditions(md, "2024 Southeast Pest Management Recommendations");

// ---- current supplement: new problems, and updates merged into manual entries ----
const VERIFIED = "Oct 2026";
for (const sup of parseConditions(readFileSync(new URL("reference/current-supplement.md", root), "utf8"), `Current supplement (verified ${VERIFIED})`)) {
  const target = conditions.find((c) => c.id === sup.id);
  if (!target) {
    sup.reviewFlags = [`Not in the 2024 manual: added from current sources (verified ${VERIFIED}). Re-check yearly.`];
    conditions.push(sup);
    continue;
  }
  for (const h of sup.hostIds) if (!target.hostIds.includes(h)) target.hostIds.push(h);
  target.biology.push(...sup.biology.map((b) => `Update (${VERIFIED}): ${b}`));
  target.treatments.push(...sup.treatments);
  target.sources.push(...sup.sources.map((x) => `Update: ${x}`));
}

// Btk: the standard selective option for young caterpillars, omitted by the manual (see current-supplement.md).
const BTK_FOR = ["caterpillar-defoliators-general", "apple-and-thorn-skeletonizer", "bagworms", "box-tree-moth", "cankerworms",
  "eastern-tent-caterpillar", "elm-spanworm", "fall-webworm", "forest-tent-caterpillar", "hemlock-looper", "juniper-webworm",
  "leafroller-caterpillars", "linden-looper", "mimosa-webworm", "oak-leaftier", "oak-skeletonizer", "orange-striped-oakworm",
  "satin-moth", "spongy-moth", "tussock-moths", "walnut-caterpillar"];
for (const id of BTK_FOR) {
  const c = conditions.find((x) => x.id === id);
  if (!c) { fail(`BTK_FOR: no condition ${id}`); continue; }
  const main = c.treatments.find((t) => t.schedule && t.applicationType === "foliar" && t.default) || c.treatments.find((t) => t.schedule && t.applicationType === "foliar");
  c.treatments.push({
    applicationType: "foliar",
    title: "Bacillus thuringiensis kurstaki (Btk) (foliar spray)",
    activeIngredient: "Bacillus thuringiensis kurstaki (Btk)",
    months: main.months,
    schedule: { visitsMin: 2, visitsMax: 3, interval: "7–10 d", repeat: main.schedule.repeat, window: "Young larvae (early instars), thorough coverage" },
    notes: ["Selective biological insecticide: spares predators and parasitoids. Must be eaten. Weak on large larvae (e.g. bagworm bags over 3/4 in.). Not for sawflies"],
  });
  c.sources.push(`Current supplement (verified ${VERIFIED}): Btk for early instars (Ohio State BYGL; UGA; Univ. of Maryland Extension)`);
}

// Category-wide additions from the per-problem currency review (Oct 2026; sources in current-supplement.md).
// Each adds one row to every listed problem, timed like that problem's main (✓ or first) spray.
const byCategory = (cat, except = []) => conditions.filter((c) => c.category === cat && !except.includes(c.id)).map((c) => c.id);
const SPIDER_MITES = byCategory("mites", ["eriophyid-mites-general", "ash-flower-gall-mite", "hemlock-rust-mite", "pear-leaf-blister-mite",
  "white-pine-rust-mite", "baldcypress-rust-mite", "filbert-big-bud-mite"]);
const CURRENCY_RULES = [
  {
    ids: SPIDER_MITES, method: "foliar", ai: "Etoxazole or hexythiazox", apps: [1, 1],
    window: "Early, while mites are few (eggs and immatures); long residual",
    note: "Mite growth regulators (IRAC 10): do not rotate one with the other. Add an adulticide if adults are present. Not for eriophyid mites. Edible fruit: check label",
  },
  {
    ids: SPIDER_MITES, method: "foliar", ai: "Fenpyroximate or acequinocyl", apps: [1, 1],
    window: "Fast knockdown of building populations",
    note: "Mitochondrial inhibitors (IRAC 21A / 20B): never use back to back with each other or pyridaben. Rotate with bifenazate, spiromesifen and abamectin",
  },
  {
    ids: ["aphids-general", "crape-myrtle-aphid", "giant-conifer-aphids", "tuliptree-aphid", "woolly-aphids", "asian-woolly-hackberry-aphid",
      "mealybugs-general", "taxus-mealybug", "whiteflies-general", "azalea-whitefly"],
    method: "foliar", ai: "Afidopyropen", apps: [1, 2], interval: "7–14 d",
    window: "At detection, thorough coverage",
    note: "New mode of action (IRAC 9D). Low risk to bees and predatory mites. Not on coleus, ficus or poinsettia. Confirm state registration",
  },
  {
    ids: [...byCategory("lace-bugs"), "arborvitae-leafminer", "azalea-leafminer", "birch-leafminer", "boxwood-leafminer", "hemlock-needleminers",
      "juniper-leafminers", "locust-leafminer", "magnolia-serpentine-leafminer", "native-holly-leafminer", "oak-leafminers", "tupelo-leafminer", "box-tree-moth"],
    method: "foliar", ai: "Cyantraniliprole", apps: [1, 1],
    window: "Same timing as the main spray, translaminar with local systemic movement",
    note: "IRAC 28, the same group as chlorantraniliprole: do not alternate the two. Landscape soil drench not labeled (containers only)",
  },
  {
    ids: byCategory("armored-scales"), method: "foliar", ai: "Spirotetramat", apps: [1, 1],
    window: "At crawlers, on actively growing plants (two-way systemic)",
    note: "IRAC 23. Mixed trial results on armored scales (good on crawlers in Purdue trials, poor in a Christmas tree trial). Not effective on soft scales",
  },
  {
    ids: ["black-vine-weevil", "two-banded-japanese-weevil"], method: "bioDrench", ai: "Entomopathogenic nematodes (Heterorhabditis)",
    months: [4, 5, 8, 9, 10], apps: [1, 2], window: "Larvae in the root zone: late summer to mid-October, and spring once soil is at least 60°F",
    note: "Keep soil moist, not soggy, for 2 weeks after. Steinernema kraussei works in cooler soil. Kills larvae, complementing adult sprays",
  },
];
for (const r of CURRENCY_RULES) for (const id of r.ids) {
  const c = conditions.find((x) => x.id === id);
  if (!c) { fail(`CURRENCY_RULES: no condition ${id}`); continue; }
  const main = c.treatments.find((t) => t.schedule && t.default && t.applicationType === "foliar")
    || c.treatments.find((t) => t.schedule && t.applicationType === "foliar") || c.treatments.find((t) => t.schedule);
  const months = r.months || main?.months || c.activeMonths;
  if (!months?.length) { fail(`CURRENCY_RULES: no months for ${id}`); continue; }
  c.treatments.push({
    applicationType: r.method,
    title: `${r.ai} (${r.method === "bioDrench" ? "biological soil drench" : "foliar spray"})`,
    activeIngredient: r.ai,
    months,
    schedule: { visitsMin: r.apps[0], visitsMax: r.apps[1], ...(r.interval ? { interval: r.interval } : {}), repeat: main?.schedule?.repeat || "As needed", window: r.window },
    notes: [r.note],
  });
  if (!c.sources.some((x) => x.includes("currency review"))) c.sources.push(`Current supplement (verified ${VERIFIED}): currency review additions`);
}

// Product status changes since the manual (applied to every option using the product).
const PRODUCT_NOTES = [
  [/mancozeb/i, "EPA proposed (July 2024) ending residential ornamental mancozeb uses; decision still pending in 2026. Confirm current label status."],
  [/acephate/i, "EPA proposed (2024) cancelling acephate uses except tree injection. Use injection products only."],
  [/emamectin/i, "TREE-äge formulations are restricted-use pesticides: certified applicators only."],
];
for (const c of conditions) for (const t of c.treatments) for (const [re, note] of PRODUCT_NOTES) {
  if (re.test(t.activeIngredient || "")) t.notes.push(note);
}

// ---- ids, defaults, flags ----
const seenCond = new Set();
for (const c of conditions) {
  if (seenCond.has(c.id)) fail(`duplicate condition id ${c.id}`);
  seenCond.add(c.id);
  const seen = new Map();
  for (const t of c.treatments) {
    const base = `${c.id}--${slug(t.activeIngredient || t.title).slice(0, 40)}-${t.applicationType}`;
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    t.id = n === 1 ? base : `${base}-${n}`;
  }
  const chem = c.treatments.filter((t) => t.schedule);
  if (chem.length && !chem.some((t) => t.default)) fail(`${c.name}: no default (✓) chemical option`);
  if (!c.hostIds.length && !c.generalist) fail(`${c.name}: no hosts`);
  if (c.generalist || c.hostIds.some((h) => FLOWERING.has(h))) c.bloomSensitive = true;
}

// ---- Blake KB overlays and supplement ----
const byId = Object.fromEntries(conditions.map((c) => [c.id, c]));
const mapId = (id) => RENAMED[id] || id;
for (const old of blake.conditions) {
  if (SUPPLEMENT.includes(old.id)) continue;
  const target = byId[mapId(old.id)];
  if (!target) { fail(`Blake condition ${old.id} has no match in the reference`); continue; }
  for (const f of OVERLAY_FIELDS) if (old[f] !== undefined) target[f] = old[f];
  if (old.noTreatmentMonths && old.id !== "hemlock-woolly-adelgid") { // HWA: manual times treatments in Aug–Sep
    target.noTreatmentMonths = old.noTreatmentMonths;
    target.noTreatmentReason = old.noTreatmentReason;
  }
  target.sources.push(...(old.sources || []).map((s) => `Blake KB: ${s}`));
  const keep = (old.reviewFlags || []).filter((f) => /quarantine|cost-share|regulat/i.test(f));
  if (keep.length) target.reviewFlags = keep;
}
for (const id of SUPPLEMENT) {
  const old = blake.conditions.find((c) => c.id === id);
  const [catId, catName] = SUPPLEMENT_CATEGORY[old.category] || [old.category, null];
  if (catName && !categories.some((c) => c.id === catId)) categories.push({ id: catId, name: catName });
  const treatments = old.treatments.map((t) => ({ ...t, ...(t.preferred ? { default: true } : {}) }));
  conditions.push({ ...old, category: catId, treatments, sources: [...(old.sources || []).map((s) => `Blake KB: ${s}`)] });
}
for (const c of conditions) {
  if (c.lookalikeIds) c.lookalikeIds = c.lookalikeIds.map(mapId).filter((id) => conditions.some((x) => x.id === id) && id !== c.id);
  if (!c.lookalikeIds?.length) delete c.lookalikeIds;
  for (const h of c.hostIds) if (!hostIds.has(h)) fail(`${c.id}: unknown host ${h}`);
}

// Coverage check: hosts with few specific problems are candidates for the current supplement.
// Hosts researched Oct 2026 with few known DMV problems beyond the broad-host-range ones; re-check when the supplement is reviewed.
const COVERAGE_REVIEWED = ["larch", "persimmon", "treeofheaven", "tupelo", "vinca", "waxmyrtle"];
const thin = hosts.filter((h) => h.id !== "site" && !COVERAGE_REVIEWED.includes(h.id) && conditions.filter((c) => c.hostIds.includes(h.id)).length < 3);
if (thin.length) console.log(`coverage: under 3 host-specific problems: ${thin.map((h) => h.id).join(", ")}`);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const kb = {
  meta: {
    title: "DMV Plant Health Care Treatment Planner",
    version: "2.1.0",
    source: "2024 Southeast Pest Management Recommendations (primary; structured transcription), current supplement verified Oct 2026 (reference/current-supplement.md), VA/MD/DC rules and abiotic disorders from Blake's DMV PHC KB v1.0",
    reviewStatus: "unreviewed",
    disclaimer: "Framework for treatment planning only. No rates are provided; product selection, rates, and timing must follow the label. Months are DMV approximations of the manual's phenology and degree-day timing. Confirm diagnosis and current VA/MD/DC regulations before application.",
  },
  applicationTypes: APPLICATION_TYPES,
  hosts,
  categories,
  conditions,
  jurisdictions: blake.jurisdictions,
};
writeFileSync(new URL("web/data/knowledge_base.json", root), JSON.stringify(kb, null, 1) + "\n");
const opts = conditions.reduce((n, c) => n + c.treatments.length, 0);
console.log(`knowledge_base.json: ${conditions.length} problems, ${hosts.length} hosts, ${categories.length} categories, ${opts} options`);
