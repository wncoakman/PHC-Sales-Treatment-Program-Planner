// Treatment-plan rules. Pure functions, no DOM: runs in the browser and under `node --test`.

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthName = (m) => MONTHS[(m - 1 + 12) % 12];

/** Library grouping (all option kinds). */
export const MITIGATIONS = [
  ["diagnostic", "Diagnosis & monitoring"],
  ["chemical", "Chemical"],
  ["cultural", "Cultural"],
  ["mechanical", "Mechanical / sanitation"],
  ["removal", "Removal / replacement"],
];

const CHEMICAL_TYPES = new Set(["foliar", "dormantOil", "barkSpray", "basalBark", "soilDrench", "microInjection", "macroInjection", "granular", "cutSurface"]);
const SPRAY_TYPES = new Set(["foliar", "dormantOil", "barkSpray"]);
const ENCLOSED_TYPES = new Set(["microInjection", "macroInjection"]);
const NEONICS = ["imidacloprid", "dinotefuran", "acetamiprid", "clothianidin", "thiamethoxam"];
const POLLINATOR_HAZARDS = [...NEONICS, "bifenthrin", "permethrin", "pyrethroid", "carbaryl", "spinosad", "abamectin", "pyriproxyfen"];
const AQUATIC_HAZARDS = ["bifenthrin", "fluopyram", "permethrin", "pyrethroid", "pyrethrins", "chlorantraniliprole", "chlorothalonil", "diflubenzuron", "copper", "carbaryl", "abamectin", "mancozeb", "pyraclostrobin", "trifloxystrobin"];

export function mitigationOf(applicationTypeId) {
  if (CHEMICAL_TYPES.has(applicationTypeId)) return "chemical";
  if (applicationTypeId === "pruning" || applicationTypeId === "mechanical") return "mechanical";
  if (applicationTypeId === "diagnostic") return "diagnostic";
  if (applicationTypeId === "replacement") return "removal";
  return "cultural";
}

/** Compact month ranges: [11,12,1,2] -> "Nov–Feb"; [3,4,5,9,10] -> "Mar–May, Sep–Oct". */
export function describeMonths(months = []) {
  const set = new Set(months);
  if (set.size === 0) return "Any time";
  if (set.size === 12) return "Year-round";
  const runs = [];
  for (let m = 1; m <= 12; m++) {
    // Runs start where the previous month is absent, so wrap-around ranges stay together.
    if (!set.has(m) || set.has(m === 1 ? 12 : m - 1)) continue;
    let end = m;
    while (set.has((end % 12) + 1)) end = (end % 12) + 1;
    runs.push(m === end ? monthName(m) : `${monthName(m)}–${monthName(end)}`);
  }
  return runs.join(", ");
}

export function describeVisits(s) {
  if (!s) return "";
  const n = s.visitsMin === s.visitsMax ? `${s.visitsMin}` : `${s.visitsMin}–${s.visitsMax}`;
  return `${n} application${s.visitsMax === 1 ? "" : "s"}`;
}

export function indexKb(kb) {
  const by = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
  return {
    ...kb,
    conditionById: by(kb.conditions),
    hostById: by(kb.hosts),
    typeById: by(kb.applicationTypes),
    categoryById: by(kb.categories),
    jurisdictionById: by(kb.jurisdictions),
  };
}

/** Problems for a host: { common: recorded on this host, general: broad-host-range and abiotic }. */
export function problemsForHost(kb, hostId) {
  const common = kb.conditions.filter((c) => c.hostIds.includes(hostId));
  const general = kb.conditions.filter((c) => c.generalist && !c.hostIds.includes(hostId));
  return { common, general };
}

export function matchesQuery(c, q) {
  if (!q) return true;
  q = q.toLowerCase();
  return [c.name, c.scientificName || "", ...c.symptoms].some((s) => s.toLowerCase().includes(q));
}

const flag = (level, text) => ({ level, text }); // level: info | caution | stop
const blank = (v) => v === undefined || v === null || v === "";

/**
 * One problem on one plant, for an annual program.
 * site:  { jurisdiction: "VA"|"MD"|"DC", nearWater, sensitiveSite, publicProperty }
 * plant: { dbh?, crownLoss? }
 * Diagnostic options are left out: the arborist has already identified the problem.
 */
export function planProblem(kb, condition, site, plant = {}) {
  const juris = kb.jurisdictionById[site.jurisdiction];
  const flags = [];
  const max = condition.maxCrownLossPercent;
  const caution = condition.cautionCrownLossPercent;
  const loss = blank(plant.crownLoss) ? null : Number(plant.crownLoss);

  if (condition.labConfirmation) flags.push(flag("info", "Lab confirmation recommended where symptoms are ambiguous."));
  if (condition.curable === false) flags.push(flag("info", "No cure. Management is suppressive or cultural."));
  const crownStop = max != null && loss != null && loss > max;
  if (crownStop) {
    flags.push(flag("stop", `Crown loss above ${max}%: chemical protection not advised; plan removal.`));
  } else if (caution != null && loss != null && loss > caution) {
    flags.push(flag("caution", `Crown loss above ${caution}%: treatment success declines; VA guidance treats below ${caution}%.`));
  } else if (max != null && loss == null) {
    flags.push(flag("caution", `Enter crown loss: chemical protection is not advised above ${max}%.`));
  }
  if (condition.noTreatmentMonths?.length) {
    flags.push(flag("caution", `No chemical treatment ${describeMonths(condition.noTreatmentMonths)}: ${condition.noTreatmentReason || "outside the effective period."}`));
  }
  for (const r of condition.regulatory || []) {
    if (r.jurisdictions.includes(site.jurisdiction)) flags.push(flag("info", r.text));
  }
  for (const cs of condition.costShare || []) {
    if (cs.jurisdiction === site.jurisdiction) flags.push(costShareFlag(cs, site, plant));
  }
  for (const w of condition.warnings || []) flags.push(flag("caution", w));

  const options = condition.treatments
    .filter((t) => mitigationOf(t.applicationType) !== "diagnostic")
    .map((t) => assessOption(kb, t, condition, site, juris, crownStop, plant));
  return { condition, flags, options, crownStop };
}

// Host-specific contraindications from the reference (option text match → not advised on that host).
const HOST_BLOCKS = [
  { host: "linden", match: ["imidacloprid", "dinotefuran"], text: "Never apply imidacloprid or dinotefuran to linden (Tilia). Use acetamiprid basal bark or a non-neonicotinoid option." },
  { host: "dogwood", match: ["paclobutrazol"], text: "Do not treat dogwood (Cornus) with paclobutrazol." },
];
const EDIBLE_HOSTS = new Set(["peach"]);

function assessOption(kb, t, condition, site, juris, crownStop, plant = {}) {
  const type = kb.typeById[t.applicationType] || { id: t.applicationType, name: t.applicationType };
  const mitigation = mitigationOf(type.id);
  const chemical = mitigation === "chemical";
  const text = [t.title, ...(t.notes || [])].join(" ").toLowerCase();
  const has = (list) => list.some((w) => text.includes(w));
  const flags = [];
  const block = chemical && HOST_BLOCKS.find((b) => b.host === plant.hostId && has(b.match));
  const notAdvised = chemical && (crownStop || !!block);
  if (block) flags.push(flag("stop", block.text));
  if (chemical && EDIBLE_HOSTS.has(plant.hostId) && /not (on )?(edible|fruit)|not where nuts/i.test(text)) {
    flags.push(flag("caution", "Label excludes edible fruit or nut trees. Use only where the crop will not be eaten."));
  }

  if (t.suppressiveOnly) flags.push(flag("info", "Suppressive only; repeat treatments expected."));
  if (t.requiresLicense) flags.push(flag("caution", "Certified applicator required; check restricted-use status."));
  if (chemical) {
    if (has(NEONICS) && site.jurisdiction === "MD" && juris?.neonicotinoid) flags.push(flag("caution", juris.neonicotinoid));
    if (condition.bloomSensitive && has(POLLINATOR_HAZARDS)) {
      flags.push(flag("caution", "Pollinator hazard: do not apply to bee-attractive plants before or during bloom."));
    }
    if (site.nearWater && !ENCLOSED_TYPES.has(type.id)) {
      if (has(AQUATIC_HAZARDS)) flags.push(flag("caution", "Aquatic toxicity: observe label buffers from water."));
      if (juris?.nearWater) flags.push(flag("caution", juris.nearWater));
    }
    if (site.sensitiveSite && juris?.sensitiveSite) flags.push(flag("caution", juris.sensitiveSite));
    if (SPRAY_TYPES.has(type.id)) flags.push(flag("info", "Spray only with wind under 10 mph and temperature under 90°F."));
    if (has(["pyrethroid", "bifenthrin", "permethrin"])) flags.push(flag("info", "Pyrethroids can trigger spider mite flare-ups; monitor after application."));
  }
  return { treatment: t, type, mitigation, chemical, preferred: !!t.preferred, notAdvised, flags };
}

function costShareFlag(cs, site, plant) {
  if (cs.publicOnly && !site.publicProperty) return flag("info", `Cost-share (public land only, not eligible here): ${cs.text}`);
  if (cs.minDBH != null) {
    if (blank(plant.dbh)) return flag("info", `Possible cost-share (needs DBH ≥ ${cs.minDBH} in.): ${cs.text}`);
    if (Number(plant.dbh) < cs.minDBH) return flag("info", `Cost-share not eligible (DBH under ${cs.minDBH} in.): ${cs.text}`);
  }
  return flag("info", `Cost-share eligible: ${cs.text}`);
}

export const SYSTEMIC_TYPES = new Set(["soilDrench", "basalBark", "microInjection", "macroInjection"]);
export const isSystemic = (o) => SYSTEMIC_TYPES.has(o.type.id);

/**
 * Options checked by default. Chemical: the recommended (★ or ✓) systemic option when the reference has one
 * (✓ first), otherwise the reference's ✓ program. Cultural practices are listed but left unchecked.
 * Removal is checked only when chemical protection is ruled out.
 */
export function defaultSelection(problem) {
  const chem = problem.options.filter((o) => o.chemical && !o.notAdvised);
  const systemic = chem.filter((o) => isSystemic(o) && (o.treatment.default || o.preferred));
  const pick = systemic.length
    ? [systemic.find((o) => o.treatment.default) || systemic.find((o) => o.preferred)]
    : chem.filter((o) => o.treatment.default);
  const removal = problem.crownStop ? problem.options.filter((o) => o.mitigation === "removal") : [];
  return [...pick, ...removal].map((o) => o.treatment.id);
}

/**
 * plants: [{ uid, hostId, label?, qty?, dbh?, crownLoss?, conditionIds: [] }]
 * Returns [{ plant, host, problems: [planProblem result] }].
 */
export function planLandscape(kb, site, plants) {
  return plants.map((plant) => ({
    plant,
    host: kb.hostById[plant.hostId],
    problems: plant.conditionIds.filter((id) => kb.conditionById[id]).map((id) => planProblem(kb, kb.conditionById[id], site, plant)),
  }));
}

export const selKey = (plantUid, treatmentId) => `${plantUid}:${treatmentId}`;

export function plantName(entry) {
  const p = entry.plant;
  let s = entry.host?.name || p.hostId;
  if (p.qty > 1) s += ` ×${p.qty}`;
  if (p.label) s += ` (${p.label})`;
  return s;
}

/** Month-by-month calendar of selected, advisable options across the landscape. */
export function landscapeCalendar(entries, selected) {
  const out = [];
  for (let m = 1; m <= 12; m++) {
    const items = [];
    for (const e of entries) {
      for (const p of e.problems) {
        for (const o of p.options) {
          if (!selected.has(selKey(e.plant.uid, o.treatment.id)) || o.notAdvised) continue;
          if (!(o.treatment.months || []).includes(m)) continue;
          items.push({ plant: plantName(e), problem: p.condition.name, option: o });
        }
      }
    }
    if (items.length) out.push({ month: m, items });
  }
  return out;
}

/** Applications chosen for a program: the user's pick within the reference range, else the minimum. */
export function chosenCount(schedule, pick) {
  const n = Number(pick);
  return Number.isInteger(n) && n >= schedule.visitsMin && n <= schedule.visitsMax ? n : Math.max(1, schedule.visitsMin);
}

/** Applications per year across the selected chemical programs (range; programs scheduled separately). */
export function applicationTotals(entries, selected) {
  let min = 0, max = 0, programs = 0;
  for (const e of entries) for (const p of e.problems) for (const o of p.options) {
    const s = o.treatment.schedule;
    if (!o.chemical || o.notAdvised || !s || !selected.has(selKey(e.plant.uid, o.treatment.id))) continue;
    programs++; min += s.visitsMin; max += s.visitsMax;
  }
  return { programs, min, max };
}

// ---------- Visit framework ----------
// The year is 24 half-month slots (0 = early Jan, 1 = late Jan, ...).

const SLOTS = 24;
export const slotName = (s) => `${s % 2 ? "Late" : "Early"} ${MONTHS[Math.floor(s / 2)]}`;

/** Minimum spacing in slots from an interval like "14 d", "4–6 wk", "3 mo" (uses the low end); null when none given. */
export function intervalSlots(interval) {
  const m = String(interval || "").match(/(\d+)\s*(?:[–-]\s*\d+)?\s*\+?\s*(d|wk|mo)\b/);
  if (!m) return null;
  const days = Number(m[1]) * { d: 1, wk: 7, mo: 30 }[m[2]];
  return Math.max(1, Math.round(days / 15));
}

/** Allowed slots and contiguous runs (e.g. "Apr–May, Aug–Sep" = 2 runs) for an option's months. */
function slotRuns(months) {
  const allowed = new Set((months?.length ? months : MONTHS.map((_, i) => i + 1)).flatMap((m) => [2 * (m - 1), 2 * (m - 1) + 1]));
  const runs = [];
  for (let s = 0; s < SLOTS; s++) {
    if (!allowed.has(s)) continue;
    if (allowed.has(s - 1)) runs[runs.length - 1].push(s); else runs.push([s]);
  }
  return { allowed, runs };
}

/**
 * One program's applications: earliest/latest slot for each, honoring its window and spacing.
 * Without a stated interval, applications go one per window run ("Apr, Aug") when there are enough runs,
 * otherwise at least one half-month apart.
 */
function programTimeline(option, count) {
  const { allowed, runs } = slotRuns(option.treatment.months);
  const step = intervalSlots(option.treatment.schedule?.interval);
  const perRun = step == null && runs.length >= count && count > 1;
  const runOf = (s) => runs.findIndex((r) => r.includes(s));
  const nextAfter = (s) => {
    if (perRun) return runs[runOf(s) + 1]?.[0] ?? null;
    for (let t = s + (step ?? 1); t < SLOTS; t++) if (allowed.has(t)) return t;
    return null;
  };
  const prevBefore = (s) => {
    if (perRun) { const r = runs[runOf(s) - 1]; return r ? r[r.length - 1] : null; }
    for (let t = s - (step ?? 1); t >= 0; t--) if (allowed.has(t)) return t;
    return null;
  };
  const latest = new Array(count);
  latest[count - 1] = runs[runs.length - 1].at(-1);
  for (let i = count - 2; i >= 0; i--) latest[i] = latest[i + 1] == null ? null : prevBefore(latest[i + 1]);
  // Repeating programs ("monthly from budbreak") start in the window's first month and keep their rhythm.
  const anchored = step != null && count > 1;
  return { allowed, latest, nextAfter, first: runs[0][0], cap: anchored ? runs[0][0] + 1 : null, step: anchored ? step : null };
}

/**
 * Fewest site visits that cover every checked chemical program's minimum applications.
 * Greedy by deadline: each visit falls at the latest slot the most urgent pending application allows,
 * and every other application that is open then (window, spacing) is done on the same visit.
 * Returns { visits: [{ slot, from, to, items: [{ plant, problem, option, n, of }] }], applications, compressed }.
 */
export function visitPlan(entries, selected, counts = {}) {
  const programs = [];
  for (const e of entries) for (const p of e.problems) for (const o of p.options) {
    const s = o.treatment.schedule;
    if (!o.chemical || o.notAdvised || !s || !selected.has(selKey(e.plant.uid, o.treatment.id))) continue;
    const of = chosenCount(s, counts[selKey(e.plant.uid, o.treatment.id)]);
    const tl = programTimeline(o, of);
    programs.push({ plant: plantName(e), problem: p.condition.name, option: o, of, done: 0, earliest: tl.first, ...tl });
  }
  const visits = [];
  const compressed = new Set();
  let applications = 0;
  for (let guard = 0; guard < 500; guard++) {
    const pending = programs.filter((g) => g.done < g.of);
    if (!pending.length) break;
    // Latest workable slot; a program that can no longer fit its window is done as early as possible (and reported).
    const deadline = (g) => {
      const last = g.latest[g.done];
      if (last == null || last < g.earliest) return g.earliest;
      for (let t = Math.min(last, g.cap ?? SLOTS); t >= g.earliest; t--) if (g.allowed.has(t)) return t;
      return g.earliest;
    };
    const slot = Math.min(...pending.map(deadline));
    const items = [];
    let from = 0, to = SLOTS - 1;
    for (const g of pending) {
      const urgent = deadline(g) === slot;
      if (!(urgent || (g.earliest <= slot && g.allowed.has(slot)))) continue;
      if (g.latest[g.done] == null || g.latest[g.done] < g.earliest) compressed.add(g);
      from = Math.max(from, Math.min(g.earliest, slot));
      to = Math.min(to, Math.max(deadline(g), slot));
      items.push({ plant: g.plant, problem: g.problem, option: g.option, n: g.done + 1, of: g.of });
      g.done++;
      applications++;
      if (g.done < g.of) {
        g.earliest = g.nextAfter(slot) ?? SLOTS - 1;
        if (g.step != null) g.cap = slot + g.step + 1; // no more than ~2 weeks past the interval
      }
    }
    visits.push({ slot, from, to, items });
  }
  visits.sort((a, b) => a.slot - b.slot);
  return {
    visits,
    applications,
    compressed: [...compressed].map((g) => ({ plant: g.plant, problem: g.problem, option: g.option })),
  };
}

export function describeVisitWindow(v) {
  return v.from === v.to ? slotName(v.slot) : `${slotName(v.from)} – ${slotName(v.to)}`;
}

const MARK = { info: "[i]", caution: "[!]", stop: "[X]" };

function optionLines(o, pick) {
  const t = o.treatment, s = t.schedule;
  const out = [`• ${t.title} [${o.type.name}]${o.notAdvised ? " NOT ADVISED under current conditions." : ""}`];
  if (s) {
    const n = chosenCount(s, pick);
    const range = s.visitsMin === s.visitsMax ? "" : ` (reference ${s.visitsMin}–${s.visitsMax})`;
    out.push(`    Applications: ${n}${range}${s.interval ? `, ${s.interval}` : ""} · Repeat: ${s.repeat}`);
    out.push(`    Window: ${s.window}`);
  } else if (t.months?.length) {
    out.push(`    When: ${describeMonths(t.months)}`);
  }
  for (const n of t.notes || []) out.push(`    - ${n}`);
  for (const f of o.flags) out.push(`    ${MARK[f.level]} ${f.text}`);
  return out;
}

/** Plain-text plan for sharing (text, email, notes, CRM). */
export function exportText(kb, site, entries, selected, siteLabel = "", counts = {}, job = {}) {
  const out = ["PHC TREATMENT PLAN"];
  if (siteLabel) out.push(`Prospect / client: ${siteLabel}`);
  if (site.address) out.push(`Work address: ${site.address}`);
  if (job.leadNumber) out.push(`SingleOps lead #: ${job.leadNumber}`);
  if (job.inspectionDate) out.push(`Site inspection date: ${job.inspectionDate}`);
  const factors = [site.nearWater && "near water", site.sensitiveSite && "school/daycare/park", site.publicProperty && "public property"].filter(Boolean);
  out.push(`Jurisdiction: ${site.jurisdiction}${factors.length ? ` · ${factors.join(", ")}` : ""}`);

  for (const e of entries) {
    out.push("", `######## ${plantName(e).toUpperCase()} ########`);
    const sz = [!blank(e.plant.dbh) && `DBH ${e.plant.dbh} in.`, !blank(e.plant.crownLoss) && `crown loss ${e.plant.crownLoss}%`].filter(Boolean);
    if (sz.length) out.push(sz.join(" · "));
    for (const p of e.problems) {
      out.push("", `== ${p.condition.name} ==`);
      for (const f of p.flags) out.push(`${MARK[f.level]} ${f.text}`);
      const chosen = p.options.filter((o) => selected.has(selKey(e.plant.uid, o.treatment.id)));
      const chem = chosen.filter((o) => o.chemical), cult = chosen.filter((o) => !o.chemical);
      if (chem.length) { out.push("Chemical:"); chem.forEach((o) => out.push(...optionLines(o, counts[selKey(e.plant.uid, o.treatment.id)]))); }
      if (cult.length) { out.push("Cultural:"); cult.forEach((o) => out.push(...optionLines(o))); }
    }
  }
  const vp = visitPlan(entries, selected, counts);
  if (vp.visits.length) {
    out.push("", `######## VISIT FRAMEWORK: ${vp.visits.length} SITE VISIT${vp.visits.length === 1 ? "" : "S"} (${vp.applications} APPLICATIONS) ########`);
    vp.visits.forEach((v, i) => {
      out.push(`Visit ${i + 1}: ${slotName(v.slot)}${v.from !== v.to ? ` (flexible ${describeVisitWindow(v)})` : ""}`);
      for (const it of v.items) out.push(`  - ${it.plant}: ${it.option.treatment.title} (${it.problem})${it.of > 1 ? ` [${it.n} of ${it.of}]` : ""}`);
    });
    for (const c of vp.compressed) out.push(`[!] ${c.plant}: ${c.option.treatment.title} does not fit its window at the stated spacing; scheduled as early as possible.`);
  }
  const cal = landscapeCalendar(entries, selected);
  if (cal.length) {
    out.push("", "######## ANNUAL CALENDAR (APPLICATION WINDOWS) ########");
    for (const c of cal) {
      out.push(`${monthName(c.month)}:`);
      for (const i of c.items) out.push(`  - ${i.plant}: ${i.option.treatment.title} (${i.problem})`);
    }
  }
  const tot = applicationTotals(entries, selected);
  if (tot.programs) out.push("", `Chemical programs: ${tot.programs} · Applications per year: ${tot.min === tot.max ? tot.min : `${tot.min}–${tot.max}`} (before combining same-day visits)`);
  out.push("", kb.meta.disclaimer);
  return out.join("\n");
}
