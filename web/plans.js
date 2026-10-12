// Saved plans: every landscape the user works on is kept under its own storage key ("phc-plan:<id>") so the
// Plans list can reopen it later. Pure apart from the storage object passed in (localStorage in the app, a fake
// in tests). Photos stay in IndexedDB keyed by id; a plan lists its photo ids in its plants.

const PREFIX = "phc-plan:";

export const newPlanId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Nothing entered yet: such plans are not kept in the list. */
export const isBlankPlan = (s) => !String(s.siteLabel || "").trim() && !String(s.leadNumber || "").trim()
  && !String(s.site?.address || "").trim() && !(s.plants || []).length;

/** Saves (or, when blank, removes) a plan; returns whether it is now in the list. */
export function storePlan(storage, s, now = Date.now()) {
  if (!s.planId) return false;
  if (isBlankPlan(s)) { storage.removeItem(PREFIX + s.planId); return false; }
  storage.setItem(PREFIX + s.planId, JSON.stringify({ updatedAt: now, state: s }));
  return true;
}

export function loadPlan(storage, id) {
  try { return JSON.parse(storage.getItem(PREFIX + id))?.state || null; } catch { return null; }
}

export const deletePlan = (storage, id) => storage.removeItem(PREFIX + id);

/** Every photo id a plan refers to (to delete them with the plan). */
export const planPhotoIds = (s) => (s?.plants || []).flatMap((p) => p.photos || []);

/**
 * The Plans list, most recently edited first, optionally filtered by a search over client, lead #, address and
 * plant names. hostName(hostId) names plants. [{ id, client, lead, date, address, plants, updatedAt }].
 */
export function listPlans(storage, query = "", hostName = (id) => id) {
  const out = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(PREFIX)) continue;
    let rec;
    try { rec = JSON.parse(storage.getItem(key)); } catch { continue; }
    const s = rec?.state;
    if (!s) continue;
    out.push({
      id: key.slice(PREFIX.length), updatedAt: rec.updatedAt || 0,
      client: String(s.siteLabel || "").trim(), lead: String(s.leadNumber || "").trim(), date: s.inspectionDate || "",
      address: String(s.site?.address || "").trim(), plants: (s.plants || []).map((p) => hostName(p.hostId)),
    });
  }
  const words = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  return out
    .filter((p) => words.every((w) => [p.client, p.lead, p.address, p.date, ...p.plants].join(" ").toLowerCase().includes(w)))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
