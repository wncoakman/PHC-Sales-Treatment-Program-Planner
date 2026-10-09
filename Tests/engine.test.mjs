// Run: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  indexKb, problemsForHost, planProblem, planLandscape, defaultSelection, landscapeCalendar,
  applicationTotals, exportText, describeMonths, selKey, mitigationOf,
} from "../web/engine.js";

const kb = indexKb(JSON.parse(readFileSync(new URL("../web/data/knowledge_base.json", import.meta.url))));
const site = (o = {}) => ({ jurisdiction: "VA", nearWater: false, sensitiveSite: false, publicProperty: false, ...o });
const problem = (id, s, plant) => planProblem(kb, kb.conditionById[id], site(s), plant);
const opt = (p, id) => p.options.find((o) => o.treatment.id === id);

test("data integrity", () => {
  assert.ok(kb.conditions.length >= 250, `${kb.conditions.length} problems`);
  const seen = new Set();
  for (const c of kb.conditions) {
    assert.ok(kb.categoryById[c.category], c.id);
    for (const h of c.hostIds) assert.ok(kb.hostById[h], `${c.id} host ${h}`);
    for (const l of c.lookalikeIds || []) assert.ok(kb.conditionById[l], `${c.id} lookalike ${l}`);
    const chem = c.treatments.filter((t) => mitigationOf(t.applicationType) === "chemical");
    if (chem.length) assert.ok(chem.some((t) => t.default), `${c.id} has no default chemical option`);
    for (const t of c.treatments) {
      assert.ok(kb.typeById[t.applicationType], t.id);
      assert.ok((t.months || []).every((m) => m >= 1 && m <= 12), t.id);
      assert.ok(!seen.has(t.id), `duplicate ${t.id}`);
      seen.add(t.id);
      if (mitigationOf(t.applicationType) === "chemical") {
        const s = t.schedule;
        assert.ok(s && s.visitsMin >= 1 && s.visitsMax >= s.visitsMin && s.repeat && s.window, `${t.id} schedule`);
        assert.ok(t.months?.length, `${t.id} needs months for the calendar`);
      }
    }
  }
  for (const j of ["VA", "MD", "DC"]) assert.ok(kb.jurisdictionById[j]);
});

test("every host has at least one common problem", () => {
  for (const h of kb.hosts) assert.ok(problemsForHost(kb, h.id).common.length, h.id);
});

test("host problem lists split common vs general", () => {
  const { common, general } = problemsForHost(kb, "ash");
  assert.ok(common.some((c) => c.id === "emerald-ash-borer"));
  assert.ok(general.some((c) => c.id === "drought"));
  assert.ok(![...common, ...general].some((c) => c.id === "boxwood-blight"));
});

test("diagnostic options are excluded from plans", () => {
  const p = problem("ash-yellows", {}, {});
  assert.ok(!p.options.some((o) => o.mitigation === "diagnostic"));
});

const EAB_INJECT = "emerald-ash-borer--emamectin-benzoate-microInjection";

test("default selection: recommended systemic first; cultural listed but unchecked; no removal", () => {
  const p = problem("emerald-ash-borer", {}, { crownLoss: 10 });
  assert.deepEqual(defaultSelection(p), [EAB_INJECT]);
  const h = defaultSelection(problem("hemlock-woolly-adelgid", {}, {}));
  assert.deepEqual(h, ["hemlock-woolly-adelgid--imidacloprid-soilDrench"]); // systemic over the dormant oil spray
  assert.deepEqual(defaultSelection(problem("crapemyrtle-bark-scale")), ["crapemyrtle-bark-scale--acetamiprid-basalBark"]);
  assert.deepEqual(defaultSelection(problem("beech-leaf-disease")), ["beech-leaf-disease--thiabendazole-macroInjection"]); // current best practice
  assert.deepEqual(defaultSelection(problem("boxwood-blight")), ["boxwood-blight--mancozeb-propiconazole-foliar"]); // no systemic: ✓ program
  for (const id of ["drought", "boxwood-blight", "hemlock-woolly-adelgid"]) {
    const pr = problem(id);
    const sel = new Set(defaultSelection(pr));
    assert.ok(pr.options.filter((o) => !o.chemical).every((o) => !sel.has(o.treatment.id)), `${id}: cultural unchecked`);
    assert.ok(pr.options.some((o) => !o.chemical), `${id}: cultural still listed`);
  }
});

test("EAB crown loss above max: chemical not advised, removal selected", () => {
  const p = problem("emerald-ash-borer", {}, { crownLoss: 60 });
  assert.ok(p.options.filter((o) => o.chemical).every((o) => o.notAdvised));
  assert.deepEqual(defaultSelection(p).map((id) => kb.conditionById["emerald-ash-borer"].treatments.find((t) => t.id === id).applicationType), ["replacement"]);
});

test("EAB caution between thresholds", () => {
  const p = problem("emerald-ash-borer", {}, { crownLoss: 40 });
  assert.ok(!opt(p, EAB_INJECT).notAdvised);
  assert.ok(p.flags.some((f) => f.level === "caution" && f.text.includes("30%")));
});

test("no-treatment months reported (spruce spider mite, from Blake KB)", () => {
  assert.ok(problem("spruce-spider-mite").flags.some((f) => f.text.startsWith("No chemical treatment Jul–Aug")));
});

test("Maryland neonicotinoid flag only in MD", () => {
  const id = "crapemyrtle-bark-scale--acetamiprid-basalBark";
  const md = opt(problem("crapemyrtle-bark-scale", { jurisdiction: "MD" }), id);
  const va = opt(problem("crapemyrtle-bark-scale"), id);
  assert.ok(md.flags.some((f) => f.text.includes("neonicotinoid")));
  assert.ok(!va.flags.some((f) => f.text.includes("neonicotinoid")));
});

test("bloom-sensitive pollinator flag", () => {
  assert.ok(opt(problem("japanese-beetle"), "japanese-beetle--imidacloprid-soilDrench").flags.some((f) => f.text.startsWith("Pollinator hazard")));
});

test("near-water rules skip trunk injections", () => {
  const p = problem("emerald-ash-borer", { jurisdiction: "MD", nearWater: true });
  assert.ok(!opt(p, EAB_INJECT).flags.some((f) => f.text.includes("Critical Area")));
  assert.ok(opt(p, "emerald-ash-borer--dinotefuran-basalBark").flags.some((f) => f.text.includes("Critical Area")));
});

test("cost-share uses plant DBH", () => {
  assert.ok(problem("emerald-ash-borer", {}, { dbh: 8 }).flags.some((f) => f.text.startsWith("Cost-share not eligible")));
  assert.ok(problem("emerald-ash-borer", {}, { dbh: 18 }).flags.some((f) => f.text.startsWith("Cost-share eligible")));
  assert.ok(problem("emerald-ash-borer", { jurisdiction: "MD" }).flags.some((f) => f.text.includes("not eligible here")));
});

test("DC spotted lanternfly note", () => {
  assert.ok(problem("spotted-lanternfly", { jurisdiction: "DC" }).flags.some((f) => f.text.includes("DOEE discourages")));
});

test("landscape: calendar, totals, export", () => {
  const plants = [
    { uid: "a", hostId: "ash", qty: 2, label: "front", dbh: 20, crownLoss: 10, conditionIds: ["emerald-ash-borer", "drought"] },
    { uid: "b", hostId: "boxwood", qty: 12, conditionIds: ["boxwood-blight"] },
  ];
  const entries = planLandscape(kb, site(), plants);
  const selected = new Set(entries.flatMap((e) => e.problems.flatMap((p) => defaultSelection(p).map((id) => selKey(e.plant.uid, id)))));
  assert.ok(selected.has(`a:${EAB_INJECT}`) && selected.has("b:boxwood-blight--mancozeb-propiconazole-foliar") && !selected.has("a:dr-water"));

  const tot = applicationTotals(entries, selected);
  assert.deepEqual(tot, { programs: 2, min: 7, max: 8 }); // EAB injection 1 + boxwood blight monthly 6–7

  const cal = landscapeCalendar(entries, selected);
  const may = cal.find((c) => c.month === 5);
  assert.ok(may.items.some((i) => i.plant === "Ash ×2 (front)" && i.option.treatment.id === EAB_INJECT));

  const text = exportText(kb, site(), entries, selected, "Test");
  assert.ok(text.includes("ASH ×2 (FRONT)") && text.includes("Applications: 1 ·") && text.includes("ANNUAL CALENDAR"));
  assert.ok(text.includes("Applications per year: 7–8"));
});

test("reference markdown builds every host and method", () => {
  assert.ok(kb.hostById.site && kb.hostById.cryptomeria && kb.typeById.granular && kb.typeById.biocontrol);
  assert.ok(kb.conditions.some((c) => c.treatments.some((t) => t.applicationType === "biocontrol")));
  assert.equal(kb.conditionById["black-knot"].curable, false);
});

test("month ranges", () => {
  assert.equal(describeMonths([3, 4, 5, 9, 10]), "Mar–May, Sep–Oct");
  assert.equal(describeMonths([11, 12, 1, 2]), "Nov–Feb");
  assert.equal(describeMonths([]), "Any time");
  assert.equal(describeMonths([6]), "Jun");
});

test("visit framework: combines overlapping windows, respects spacing", async () => {
  const { visitPlan, intervalSlots } = await import("../web/engine.js");
  assert.equal(intervalSlots("14 d"), 1);
  assert.equal(intervalSlots("4–6 wk"), 2);
  assert.equal(intervalSlots("3 mo"), 6);
  assert.equal(intervalSlots(undefined), null);

  const plants = [
    { uid: "a", hostId: "ash", qty: 1, dbh: 20, crownLoss: 10, conditionIds: ["emerald-ash-borer"] },
    { uid: "b", hostId: "boxwood", qty: 12, conditionIds: ["boxwood-blight", "boxwood-leafminer"] },
    { uid: "c", hostId: "maple", qty: 1, conditionIds: ["gloomy-scale"] },
  ];
  const entries = planLandscape(kb, site(), plants);
  const selected = new Set(entries.flatMap((e) => e.problems.flatMap((p) => defaultSelection(p).map((id) => selKey(e.plant.uid, id)))));
  const vp = visitPlan(entries, selected);
  const tot = applicationTotals(entries, selected);
  assert.equal(vp.applications, tot.min);
  assert.ok(vp.visits.length < vp.applications, `${vp.visits.length} visits for ${vp.applications} applications`);

  // Every application lands inside its program's months, and repeat applications keep their spacing.
  const byProgram = new Map();
  for (const v of vp.visits) for (const it of v.items) {
    const months = it.option.treatment.months;
    assert.ok(months.includes(Math.floor(v.slot / 2) + 1), `${it.option.treatment.id} at slot ${v.slot}`);
    const k = `${it.plant}|${it.option.treatment.id}`;
    byProgram.set(k, [...(byProgram.get(k) || []), v.slot]);
  }
  const blight = [...byProgram.entries()].find(([k]) => k.includes("boxwood-blight"))[1];
  assert.equal(blight.length, 6); // monthly Apr–Oct, minimum 6
  for (let i = 1; i < blight.length; i++) assert.ok(blight[i] - blight[i - 1] >= 2, "30 d spacing");
  const text = exportText(kb, site(), entries, selected, "T");
  assert.ok(text.includes("VISIT FRAMEWORK") && text.includes("Visit 1:"));
});

test("chosen application counts drive the visit framework", async () => {
  const { visitPlan, chosenCount } = await import("../web/engine.js");
  const s = { visitsMin: 2, visitsMax: 4 };
  assert.equal(chosenCount(s, undefined), 2);
  assert.equal(chosenCount(s, 3), 3);
  assert.equal(chosenCount(s, 9), 2); // outside the reference range
  const entries = planLandscape(kb, site(), [{ uid: "b", hostId: "boxwood", conditionIds: ["boxwood-blight"] }]);
  const id = "boxwood-blight--mancozeb-propiconazole-foliar";
  const selected = new Set([selKey("b", id)]);
  assert.equal(visitPlan(entries, selected).applications, 6);
  assert.equal(visitPlan(entries, selected, { [selKey("b", id)]: 7 }).applications, 7);
  assert.ok(exportText(kb, site(), entries, selected, "", { [selKey("b", id)]: 7 }).includes("Applications: 7 (reference 6–7)"));
});

test("current supplement fills gaps in the manual", () => {
  const bld = kb.conditionById["beech-leaf-disease"];
  assert.ok(bld && bld.hostIds.includes("beech") && bld.reviewFlags[0].startsWith("Not in the 2024 manual"));
  assert.ok(problemsForHost(kb, "beech").common.some((c) => c.id === "beech-leaf-disease"));
  const fluo = opt(problem("beech-leaf-disease", { nearWater: true }), "beech-leaf-disease--fluopyram-foliar");
  assert.ok(fluo.flags.some((f) => f.text.startsWith("Aquatic toxicity")));
  assert.ok(kb.conditionById["box-tree-moth"].biology.some((b) => b.startsWith("Update")));
  assert.ok(kb.conditionById["boxwood-blight"].treatments.some((t) => (t.notes || []).some((n) => n.includes("EPA proposed"))));
});

test("export header carries job fields", () => {
  const entries = planLandscape(kb, site({ address: "1 Main St, Fairfax, VA 22030" }), []);
  const t = exportText(kb, site({ address: "1 Main St, Fairfax, VA 22030" }), entries, new Set(), "Smith", {}, { leadNumber: "4521", inspectionDate: "2026-10-09" });
  assert.ok(t.includes("Prospect / client: Smith") && t.includes("Work address: 1 Main St") && t.includes("SingleOps lead #: 4521") && t.includes("Site inspection date: 2026-10-09"));
});

test("host contraindications: no neonicotinoids on linden", () => {
  const onLinden = problem("japanese-beetle", {}, { hostId: "linden" });
  const imid = opt(onLinden, "japanese-beetle--imidacloprid-soilDrench");
  assert.ok(imid.notAdvised && imid.flags.some((f) => f.level === "stop" && f.text.includes("linden")));
  assert.ok(!defaultSelection(onLinden).some((id) => /imidacloprid|dinotefuran/.test(id)));
  assert.ok(!opt(onLinden, "japanese-beetle--acetamiprid-basalBark").notAdvised);
  const onRose = problem("japanese-beetle", {}, { hostId: "rose" });
  assert.deepEqual(defaultSelection(onRose), ["japanese-beetle--imidacloprid-soilDrench"]);
});

test("whole-property programs: soil care 2 visits (spring, fall), resilience 1 (summer)", async () => {
  const { siteProgramEntry, visitPlan } = await import("../web/engine.js");
  assert.equal(siteProgramEntry(kb, {}), null);
  const pe = siteProgramEntry(kb, { soilCare: true, resilience: true });
  assert.equal(pe.problems.length, 2);
  const selected = new Set(pe.problems.flatMap((p) => defaultSelection(p).map((id) => selKey(pe.plant.uid, id))));
  assert.equal(selected.size, 2);
  const vp = visitPlan([pe], selected);
  const months = vp.visits.map((v) => Math.floor(v.slot / 2) + 1);
  assert.equal(vp.applications, 3);
  assert.ok(months.some((m) => m === 3 || m === 4) && months.some((m) => m === 9 || m === 10) && months.some((m) => m === 7 || m === 8));
  const text = exportText(kb, site(), [pe], selected, "X");
  assert.ok(text.includes("WHOLE PROPERTY") && text.includes("Standard Soil Care") && text.includes("Phosphite salts"));
});

test("thin hosts filled from the supplement", () => {
  const common = (h) => problemsForHost(kb, h).common.map((c) => c.id);
  assert.ok(common("pieris").includes("andromeda-lace-bug"));
  assert.ok(common("baldcypress").includes("cypress-twig-gall-midge") && common("baldcypress").includes("baldcypress-rust-mite"));
  assert.ok(common("hackberry").includes("asian-woolly-hackberry-aphid"));
  assert.ok(common("mulberry").includes("leaf-spot") && common("mulberry").includes("bacterial-blight"));
  assert.ok(common("treeofheaven").includes("tree-of-heaven-control"));
  assert.ok(!kb.conditionById["baldcypress-rust-mite"].treatments.some((t) => /oil/i.test(t.activeIngredient || "")));
});

test("no horticultural oil on bald cypress", () => {
  const p = problem("spider-mites-cool-season", {}, { hostId: "baldcypress" });
  const oil = p.options.filter((o) => o.chemical && /horticultural oil/i.test(o.treatment.title));
  assert.ok(oil.length && oil.every((o) => o.notAdvised));
  assert.ok(!problem("spider-mites-cool-season", {}, { hostId: "spruce" }).options.some((o) => o.notAdvised));
});

test("current methods: BLD thiabendazole biennial, phosphite basal 2–3, HWA tank mix", () => {
  const bld = kb.conditionById["beech-leaf-disease"].treatments;
  const tbz = bld.find((t) => t.id === "beech-leaf-disease--thiabendazole-macroInjection");
  assert.ok(tbz.preferred && tbz.default && tbz.schedule.repeat === "Every 2–3 yrs");
  const basal = bld.find((t) => t.id === "beech-leaf-disease--potassium-phosphite-basalBark");
  assert.equal(basal.schedule.visitsMax, 3);
  assert.ok(kb.conditionById["hemlock-woolly-adelgid"].treatments.some((t) => t.activeIngredient === "Imidacloprid + dinotefuran"));
});

test("currency review: category-wide current options present, not defaults", () => {
  const has = (id, ai) => kb.conditionById[id].treatments.some((t) => t.activeIngredient === ai);
  assert.ok(has("two-spotted-spider-mite", "Etoxazole or hexythiazox") && !has("eriophyid-mites-general", "Etoxazole or hexythiazox"));
  assert.ok(has("whiteflies-general", "Afidopyropen") && has("boxwood-leafminer", "Cyantraniliprole") && has("japanese-maple-scale", "Spirotetramat"));
  assert.ok(has("black-vine-weevil", "Entomopathogenic nematodes (Heterorhabditis)"));
  assert.ok(has("phytophthora-root-rot", "Oxathiapiprolin") && has("japanese-knotweed", "Glyphosate"));
  const p = problem("black-vine-weevil");
  assert.ok(!defaultSelection(p).some((id) => id.includes("nematodes")));
});

test("currency review: demoted rows and borer/needlecast additions", () => {
  const rr = kb.conditionById["rose-rosette"].treatments;
  const aba = rr.find((t) => t.activeIngredient === "Abamectin + horticultural oil");
  assert.ok(!aba.default && !aba.preferred && aba.notes.some((n) => n.startsWith("Not recommended")));
  assert.equal(rr.filter((t) => t.activeIngredient === "Abamectin + horticultural oil").length, 1);
  assert.ok(kb.conditionById["dogwood-borer"].treatments.some((t) => t.activeIngredient === "Chlorantraniliprole" && t.applicationType === "barkSpray"));
  assert.ok(kb.conditionById["rhizosphaera-needlecast-of-spruce"].treatments.some((t) => t.activeIngredient === "Chlorothalonil"));
});
