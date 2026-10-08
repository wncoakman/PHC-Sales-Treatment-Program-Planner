// Treatment-plan rules. Pure functions, no DOM: runs in the browser and under `node --test`.

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthName = (m) => MONTHS[(m - 1 + 12) % 12];

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

/** Host-specific conditions first, then generalists (abiotic, SLF, etc.). */
export function conditionsForHost(kb, hostId) {
  if (!hostId) return kb.conditions;
  const specific = kb.conditions.filter((c) => c.hostIds.includes(hostId));
  const general = kb.conditions.filter((c) => c.generalist && !c.hostIds.includes(hostId));
  return [...specific, ...general];
}

export function matchesQuery(c, q) {
  if (!q) return true;
  q = q.toLowerCase();
  return [c.name, c.scientificName || "", ...c.symptoms].some((s) => s.toLowerCase().includes(q));
}

const flag = (level, text) => ({ level, text }); // level: info | caution | stop

/**
 * site: { jurisdiction: "VA"|"MD"|"DC", month: 1–12, dbh?: number, crownLoss?: number,
 *         nearWater, sensitiveSite, publicProperty, inBloom: boolean }
 */
export function planCondition(kb, condition, site) {
  const juris = kb.jurisdictionById[site.jurisdiction];
  const flags = [];
  const max = condition.maxCrownLossPercent;
  const caution = condition.cautionCrownLossPercent;
  const loss = site.crownLoss;
  const hasLoss = loss !== undefined && loss !== null && loss !== "";

  if (condition.labConfirmation) flags.push(flag("caution", "Confirm diagnosis by lab test before committing to a treatment program."));
  if (condition.curable === false) flags.push(flag("info", "No cure. Management is suppressive or cultural."));
  if (condition.lookalikeIds?.length) {
    const names = condition.lookalikeIds.map((id) => kb.conditionById[id]?.name).filter(Boolean);
    flags.push(flag("info", `Rule out look-alikes: ${names.join(", ")}.`));
  }
  const crownStop = max != null && hasLoss && loss > max;
  if (crownStop) {
    flags.push(flag("stop", `Crown loss above ${max}%: chemical protection not advised; plan removal.`));
  } else if (caution != null && hasLoss && loss > caution) {
    flags.push(flag("caution", `Crown loss above ${caution}%: treatment success declines; VA guidance treats below ${caution}%.`));
  } else if (max != null && !hasLoss) {
    flags.push(flag("caution", `Estimate crown loss: treatment is not advised above ${max}%.`));
  }
  const blockedMonth = (condition.noTreatmentMonths || []).includes(site.month);
  if (blockedMonth) flags.push(flag("stop", condition.noTreatmentReason || "Treatment not advised this month."));
  for (const r of condition.regulatory || []) {
    if (r.jurisdictions.includes(site.jurisdiction)) flags.push(flag("info", r.text));
  }
  for (const cs of condition.costShare || []) {
    if (cs.jurisdiction === site.jurisdiction) flags.push(costShareFlag(cs, site));
  }
  for (const w of condition.warnings || []) flags.push(flag("caution", w));
  const reviewFlags = condition.reviewFlags || [];

  const options = condition.treatments.map((t) => assessOption(kb, t, condition, site, juris, { crownStop, blockedMonth }));
  return { condition, flags, reviewFlags, options };
}

function assessOption(kb, t, condition, site, juris, { crownStop, blockedMonth }) {
  const type = kb.typeById[t.applicationType] || { id: t.applicationType, name: t.applicationType };
  const mitigation = mitigationOf(type.id);
  const chemical = mitigation === "chemical";
  const text = [t.title, ...(t.notes || [])].join(" ").toLowerCase();
  const has = (list) => list.some((w) => text.includes(w));
  const months = t.months || [];
  const flags = [];
  let status = "inWindow";
  let nextWindow = null;

  if (months.length && !months.includes(site.month)) {
    status = "outOfWindow";
    for (let i = 1; i <= 12; i++) {
      const m = ((site.month - 1 + i) % 12) + 1;
      if (months.includes(m)) { nextWindow = m; break; }
    }
  }
  if (chemical && (blockedMonth || crownStop)) status = "notAdvised";

  if (t.suppressiveOnly) flags.push(flag("info", "Suppressive only; repeat treatments expected."));
  if (t.requiresLicense) flags.push(flag("caution", "Certified applicator required; check restricted-use status."));

  if (chemical) {
    if (has(NEONICS) && site.jurisdiction === "MD" && juris?.neonicotinoid) flags.push(flag("caution", juris.neonicotinoid));
    if ((site.inBloom || condition.bloomSensitive) && has(POLLINATOR_HAZARDS)) {
      flags.push(flag(site.inBloom ? "stop" : "caution", "Pollinator hazard: do not apply to bee-attractive plants before or during bloom."));
    }
    if (site.nearWater && !ENCLOSED_TYPES.has(type.id)) {
      if (has(AQUATIC_HAZARDS)) flags.push(flag("caution", "Aquatic toxicity: observe label buffers from water."));
      if (juris?.nearWater) flags.push(flag("caution", juris.nearWater));
    }
    if (site.sensitiveSite && juris?.sensitiveSite) flags.push(flag("caution", juris.sensitiveSite));
    if (SPRAY_TYPES.has(type.id)) flags.push(flag("info", "Spray only with wind under 10 mph and temperature under 90°F."));
    if (has(["pyrethroid", "bifenthrin", "permethrin"])) flags.push(flag("info", "Pyrethroids can trigger spider mite flare-ups; monitor after application."));
  }
  return { treatment: t, type, mitigation, status, nextWindow, flags };
}

function costShareFlag(cs, site) {
  if (cs.publicOnly && !site.publicProperty) return flag("info", `Cost-share (public land only, not eligible here): ${cs.text}`);
  if (cs.minDBH != null) {
    const dbh = site.dbh;
    if (dbh === undefined || dbh === null || dbh === "") return flag("info", `Possible cost-share (needs DBH ≥ ${cs.minDBH} in.): ${cs.text}`);
    if (dbh < cs.minDBH) return flag("info", `Cost-share not eligible (DBH under ${cs.minDBH} in.): ${cs.text}`);
  }
  return flag("info", `Cost-share eligible: ${cs.text}`);
}

/** Month-by-month list of selected, advisable options across all planned conditions. */
export function schedule(plans, selected) {
  const out = [];
  for (let m = 1; m <= 12; m++) {
    const items = plans.flatMap((p) =>
      p.options
        .filter((o) => selected.has(o.treatment.id) && o.status !== "notAdvised" && (o.treatment.months || []).includes(m))
        .map((o) => `${p.condition.name}: ${o.treatment.title} (${o.type.name})`));
    if (items.length) out.push({ month: m, items });
  }
  return out;
}

const MARK = { info: "[i]", caution: "[!]", stop: "[X]" };

/** Plain-text framework for sharing (text, email, notes, CRM). */
export function exportText(kb, plans, selected, site, siteLabel = "") {
  const out = ["PHC TREATMENT FRAMEWORK"];
  if (siteLabel) out.push(`Site: ${siteLabel}`);
  let line = `${site.jurisdiction} · planned ${monthName(site.month)}`;
  if (site.dbh != null && site.dbh !== "") line += ` · DBH ${site.dbh} in.`;
  if (site.crownLoss != null && site.crownLoss !== "") line += ` · crown loss ${site.crownLoss}%`;
  out.push(line);
  const factors = [site.nearWater && "near water", site.sensitiveSite && "school/daycare/park",
    site.publicProperty && "public property", site.inBloom && "in bloom"].filter(Boolean);
  if (factors.length) out.push(`Site factors: ${factors.join(", ")}`);

  for (const p of plans) {
    out.push("", `== ${p.condition.name.toUpperCase()} ==`);
    for (const f of p.flags) out.push(`${MARK[f.level]} ${f.text}`);
    for (const [key, label] of MITIGATIONS) {
      const chosen = p.options.filter((o) => o.mitigation === key && selected.has(o.treatment.id));
      if (!chosen.length) continue;
      out.push("", `${label}:`);
      for (const o of chosen) {
        const t = o.treatment;
        let s = `• ${t.title} [${o.type.name}]`;
        if (t.months?.length) s += ` Window: ${describeMonths(t.months)}.`;
        if (t.frequency) s += ` ${t.frequency}.`;
        if (t.protection) s += ` Protection: ${t.protection}.`;
        if (o.status === "notAdvised") s += " NOT ADVISED under current site conditions.";
        out.push(s);
        for (const n of t.notes || []) out.push(`    - ${n}`);
        for (const f of o.flags) out.push(`    ${MARK[f.level]} ${f.text}`);
      }
    }
  }
  const sched = schedule(plans, selected);
  if (sched.length) {
    out.push("", "== ANNUAL SCHEDULE ==");
    for (const e of sched) out.push(`${monthName(e.month)}: ${e.items.join("; ")}`);
  }
  out.push("", kb.meta.disclaimer);
  return out.join("\n");
}
