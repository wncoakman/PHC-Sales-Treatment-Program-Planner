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

test("default selection: default (✓) chemical + cultural, no removal", () => {
  const p = problem("emerald-ash-borer", {}, { crownLoss: 10 });
  assert.deepEqual(defaultSelection(p), [EAB_INJECT]);
  const h = defaultSelection(problem("hemlock-woolly-adelgid", {}, {}));
  assert.ok(h.includes("hemlock-woolly-adelgid--imidacloprid-soilDrench") && h.includes("hemlock-woolly-adelgid--horticultural-oil-dormantOil"));
  assert.ok(!h.includes("hemlock-woolly-adelgid--dinotefuran-basalBark"));
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
  assert.ok(selected.has(`a:${EAB_INJECT}`) && selected.has("b:boxwood-blight--mancozeb-propiconazole-foliar") && selected.has("a:dr-water"));

  const tot = applicationTotals(entries, selected);
  assert.deepEqual(tot, { programs: 2, min: 7, max: 8 }); // EAB injection 1 + boxwood blight monthly 6–7

  const cal = landscapeCalendar(entries, selected);
  const may = cal.find((c) => c.month === 5);
  assert.ok(may.items.some((i) => i.plant === "Ash ×2 (front)" && i.option.treatment.id === EAB_INJECT));

  const text = exportText(kb, site(), entries, selected, "Test");
  assert.ok(text.includes("ASH ×2 (FRONT)") && text.includes("Applications: 1 application") && text.includes("ANNUAL CALENDAR"));
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
