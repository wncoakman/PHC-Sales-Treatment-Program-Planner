// Run: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { indexKb, planCondition, schedule, exportText, describeMonths, conditionsForHost } from "../web/engine.js";

const kb = indexKb(JSON.parse(readFileSync(new URL("../web/data/knowledge_base.json", import.meta.url))));
const site = (o) => ({ jurisdiction: "VA", nearWater: false, sensitiveSite: false, publicProperty: false, inBloom: false, ...o });
const plan = (id, s) => planCondition(kb, kb.conditionById[id], site(s));
const opt = (p, id) => p.options.find((o) => o.treatment.id === id);

test("data integrity", () => {
  assert.equal(kb.conditions.length, 35);
  const seen = new Set();
  for (const c of kb.conditions) {
    assert.ok(kb.categoryById[c.category], c.id);
    for (const h of c.hostIds) assert.ok(kb.hostById[h], `${c.id} host ${h}`);
    for (const l of c.lookalikeIds || []) assert.ok(kb.conditionById[l], `${c.id} lookalike ${l}`);
    assert.ok(c.treatments.length, c.id);
    for (const t of c.treatments) {
      assert.ok(kb.typeById[t.applicationType], t.id);
      assert.ok((t.months || []).every((m) => m >= 1 && m <= 12), t.id);
      assert.ok(!seen.has(t.id), `duplicate ${t.id}`);
      seen.add(t.id);
    }
  }
  for (const j of ["VA", "MD", "DC"]) assert.ok(kb.jurisdictionById[j]);
});

test("host filter", () => {
  const ids = conditionsForHost(kb, "ash").map((c) => c.id);
  assert.ok(ids.includes("emerald-ash-borer") && ids.includes("drought"));
  assert.ok(!ids.includes("boxwood-blight"));
  assert.ok(ids.indexOf("emerald-ash-borer") < ids.indexOf("drought"));
});

test("EAB crown loss above max blocks chemical, keeps removal", () => {
  const p = plan("emerald-ash-borer", { month: 5, crownLoss: 60 });
  assert.ok(p.options.filter((o) => o.mitigation === "chemical").every((o) => o.status === "notAdvised"));
  assert.equal(opt(p, "eab-remove").status, "inWindow");
  assert.ok(p.flags.some((f) => f.level === "stop"));
});

test("EAB caution between thresholds", () => {
  const p = plan("emerald-ash-borer", { month: 5, crownLoss: 40 });
  assert.equal(opt(p, "eab-inject").status, "inWindow");
  assert.ok(p.flags.some((f) => f.level === "caution" && f.text.includes("30%")));
});

test("HWA dormant months block chemical", () => {
  const p = plan("hemlock-woolly-adelgid", { month: 8 });
  assert.ok(p.options.filter((o) => o.mitigation === "chemical").every((o) => o.status === "notAdvised"));
});

test("out of window reports next month, wrapping the year", () => {
  const p = plan("cedar-apple-rust", { month: 9 });
  assert.equal(opt(p, "ru-foliar").status, "outOfWindow");
  assert.equal(opt(p, "ru-foliar").nextWindow, 4);
  assert.equal(opt(p, "ru-galls").nextWindow, 1);
});

test("Maryland neonicotinoid flag only in MD", () => {
  const md = opt(plan("crapemyrtle-bark-scale", { jurisdiction: "MD", month: 4 }), "cmbs-drench");
  const va = opt(plan("crapemyrtle-bark-scale", { month: 4 }), "cmbs-drench");
  assert.ok(md.flags.some((f) => f.text.includes("neonicotinoid")));
  assert.ok(!va.flags.some((f) => f.text.includes("neonicotinoid")));
});

test("bloom stops pollinator-hazard options", () => {
  const p = plan("japanese-beetle", { month: 5, inBloom: true });
  assert.ok(opt(p, "jb-systemic").flags.some((f) => f.level === "stop"));
});

test("near-water rules skip trunk injections", () => {
  const p = plan("emerald-ash-borer", { jurisdiction: "MD", month: 5, nearWater: true });
  assert.ok(!opt(p, "eab-inject").flags.some((f) => f.text.includes("Critical Area")));
  assert.ok(opt(p, "eab-basal").flags.some((f) => f.text.includes("Critical Area")));
});

test("cost-share eligibility", () => {
  assert.ok(plan("emerald-ash-borer", { month: 5, dbh: 8 }).flags.some((f) => f.text.startsWith("Cost-share not eligible")));
  assert.ok(plan("emerald-ash-borer", { month: 5, dbh: 18 }).flags.some((f) => f.text.startsWith("Cost-share eligible")));
  assert.ok(plan("emerald-ash-borer", { jurisdiction: "MD", month: 5 }).flags.some((f) => f.text.includes("not eligible here")));
});

test("DC spotted lanternfly note", () => {
  assert.ok(plan("spotted-lanternfly", { jurisdiction: "DC", month: 6 }).flags.some((f) => f.text.includes("DOEE discourages")));
});

test("schedule and export", () => {
  const s = site({ month: 4, dbh: 20, crownLoss: 10 });
  const plans = ["emerald-ash-borer", "drought"].map((id) => planCondition(kb, kb.conditionById[id], s));
  const selected = new Set(["eab-inject", "dr-water"]);
  assert.deepEqual(schedule(plans, selected).map((e) => e.month), [4, 5, 6, 7, 8, 9]);
  const text = exportText(kb, plans, selected, s, "Test");
  assert.ok(text.includes("Macro-injection") && text.includes("ANNUAL SCHEDULE"));
  assert.ok(!text.includes("Content review"));
});

test("month ranges", () => {
  assert.equal(describeMonths([3, 4, 5, 9, 10]), "Mar–May, Sep–Oct");
  assert.equal(describeMonths([11, 12, 1, 2]), "Nov–Feb");
  assert.equal(describeMonths([]), "Any time");
  assert.equal(describeMonths([...Array(12)].map((_, i) => i + 1)), "Year-round");
  assert.equal(describeMonths([6]), "Jun");
});
