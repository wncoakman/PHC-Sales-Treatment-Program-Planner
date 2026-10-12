// Run: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { isBlankPlan, storePlan, loadPlan, deletePlan, listPlans, planPhotoIds } from "../web/plans.js";

/** A localStorage stand-in. */
function fakeStorage() {
  const m = new Map();
  return {
    get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
  };
}
const plan = (id, o = {}) => ({ planId: id, siteLabel: "", leadNumber: "", inspectionDate: "2026-10-10", site: { address: "" }, plants: [], ...o });

test("plans: blank landscapes are not kept; edits update the saved copy", () => {
  const st = fakeStorage();
  st.setItem("phc-landscape-v1", "{}"); // other app keys are ignored
  assert.ok(isBlankPlan(plan("a")));
  assert.equal(storePlan(st, plan("a")), false);
  assert.equal(listPlans(st).length, 0);
  assert.equal(storePlan(st, plan("a", { siteLabel: "Smith" }), 1000), true);
  assert.equal(storePlan(st, plan("a", { siteLabel: "Smith residence" }), 2000), true);
  assert.deepEqual(listPlans(st).map((p) => [p.id, p.client, p.updatedAt]), [["a", "Smith residence", 2000]]);
  assert.equal(loadPlan(st, "a").siteLabel, "Smith residence");
  // Emptied out again: dropped from the list.
  storePlan(st, plan("a"));
  assert.equal(listPlans(st).length, 0);
});

test("plans: newest first, searchable by client, lead #, address and plant", () => {
  const st = fakeStorage();
  storePlan(st, plan("a", { siteLabel: "Smith residence", leadNumber: "12345", plants: [{ hostId: "ash", photos: ["p1", "p2"] }] }), 1000);
  storePlan(st, plan("b", { siteLabel: "Jones", site: { address: "9 Oak Ln, Leesburg" }, plants: [{ hostId: "boxwood" }] }), 3000);
  storePlan(st, plan("c", { leadNumber: "777" }), 2000);
  const names = { ash: "Ash", boxwood: "Boxwood" };
  const ids = (q) => listPlans(st, q, (h) => names[h]).map((p) => p.id);
  assert.deepEqual(ids(""), ["b", "c", "a"]);
  assert.deepEqual(ids("12345"), ["a"]);
  assert.deepEqual(ids("leesburg"), ["b"]);
  assert.deepEqual(ids("BOX jones"), ["b"]);
  assert.deepEqual(ids("ash smith"), ["a"]);
  assert.deepEqual(ids("nobody"), []);
  assert.deepEqual(planPhotoIds(loadPlan(st, "a")), ["p1", "p2"]);
  deletePlan(st, "a");
  assert.deepEqual(ids(""), ["b", "c"]);
  assert.equal(loadPlan(st, "a"), null);
});
