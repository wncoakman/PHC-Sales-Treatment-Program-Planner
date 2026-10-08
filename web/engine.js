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

const CHEMICAL_TYPES = new Set(["foliar", "dormantOil", "barkSpray", "basalBark", "soilDrench", "microInjection", "macroInjection"]);
const SPRAY_TYPES = new Set(["foliar", "dormantOil", "barkSpray"]);
const ENCLOSED_TYPES = new Set(["microInjection", "macroInjection"]);
const NEONICS = ["imidacloprid", "dinotefuran", "clothianidin", "thiamethoxam"];
const POLLINATOR_HAZARDS = [...NEONICS, "bifenthrin", "permethrin", "pyrethroid", "carbaryl", "spinosad", "abamectin", "pyriproxyfen"];
const AQUATIC_HAZARDS = ["bifenthrin", "permethrin", "pyrethroid", "chlorothalonil", "diflubenzuron", "copper", "carbaryl", "abamectin", "trifloxystrobin"];

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
    .map((t) => assessOption(kb, t, condition, site, juris, crownStop));
  return { condition, flags, options, crownStop };
}

function assessOption(kb, t, condition, site, juris, crownStop) {
  const type = kb.typeById[t.applicationType] || { id: t.applicationType, name: t.applicationType };
  const mitigation = mitigationOf(type.id);
  const chemical = mitigation === "chemical";
  const text = [t.title, ...(t.notes || [])].join(" ").toLowerCase();
  const has = (list) => list.some((w) => text.includes(w));
  const flags = [];
  const notAdvised = chemical && crownStop;

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

/** Options checked by default: the preferred chemical program plus cultural and mechanical care. Removal only when chemical is ruled out. */
export function defaultSelection(problem) {
  return problem.options
    .filter((o) => (o.chemical ? o.preferred && !o.notAdvised : o.mitigation !== "removal" || problem.crownStop))
    .map((o) => o.treatment.id);
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

const MARK = { info: "[i]", caution: "[!]", stop: "[X]" };

function optionLines(o) {
  const t = o.treatment, s = t.schedule;
  const out = [`• ${t.title} [${o.type.name}]${o.notAdvised ? " NOT ADVISED under current conditions." : ""}`];
  if (s) {
    out.push(`    Applications: ${describeVisits(s)}${s.interval ? `, ${s.interval}` : ""} · Repeat: ${s.repeat}`);
    out.push(`    Window: ${s.window}`);
  } else if (t.months?.length) {
    out.push(`    When: ${describeMonths(t.months)}`);
  }
  for (const n of t.notes || []) out.push(`    - ${n}`);
  for (const f of o.flags) out.push(`    ${MARK[f.level]} ${f.text}`);
  return out;
}

/** Plain-text plan for sharing (text, email, notes, CRM). */
export function exportText(kb, site, entries, selected, siteLabel = "") {
  const out = ["PHC TREATMENT PLAN"];
  if (siteLabel) out.push(`Site: ${siteLabel}`);
  const factors = [site.nearWater && "near water", site.sensitiveSite && "school/daycare/park", site.publicProperty && "public property"].filter(Boolean);
  out.push(`${site.jurisdiction}${factors.length ? ` · ${factors.join(", ")}` : ""}`);

  for (const e of entries) {
    out.push("", `######## ${plantName(e).toUpperCase()} ########`);
    const sz = [!blank(e.plant.dbh) && `DBH ${e.plant.dbh} in.`, !blank(e.plant.crownLoss) && `crown loss ${e.plant.crownLoss}%`].filter(Boolean);
    if (sz.length) out.push(sz.join(" · "));
    for (const p of e.problems) {
      out.push("", `== ${p.condition.name} ==`);
      for (const f of p.flags) out.push(`${MARK[f.level]} ${f.text}`);
      const chosen = p.options.filter((o) => selected.has(selKey(e.plant.uid, o.treatment.id)));
      const chem = chosen.filter((o) => o.chemical), cult = chosen.filter((o) => !o.chemical);
      if (chem.length) { out.push("Chemical:"); chem.forEach((o) => out.push(...optionLines(o))); }
      if (cult.length) { out.push("Cultural:"); cult.forEach((o) => out.push(...optionLines(o))); }
    }
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
