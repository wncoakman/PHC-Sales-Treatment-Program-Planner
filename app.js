import {
  MITIGATIONS, describeMonths, describeVisits, indexKb, problemsForHost, matchesQuery, mitigationOf,
  planLandscape, defaultSelection, rankTreatments, landscapeCalendar, applicationTotals, exportText, selKey, plantName, monthName,
  visitPlan, slotName, describeVisitWindow, chosenCount, SITE_PROGRAMS, siteProgramEntry, PROGRAM_UID, programQuantity, anytimeLabel,
} from "./engine.js";
import { assessAddress, BANDS } from "./logistics.js";
import { availableKeys, treatmentAvailable, productsFor, treatmentNeeds, productKeys } from "./products.js";

const $view = document.getElementById("view");
const $title = document.getElementById("title");
const $actions = document.getElementById("actions");
const STORE_KEY = "phc-landscape-v1";
const OPS_LOG_KEY = "phc-ops-log";
/** Company-wide product availability (kept apart from the landscape so "Start new landscape" keeps it). */
const PRODUCTS_KEY = "phc-products-v1";
let bases = { trafficFactor: 1, bases: [] };
/** Stocked products from data/products.json (source: reference/phc-product-list.md). */
let listProducts = [];
const savedProducts = loadSavedProducts();
/** Names of products switched off on the treatment plan page. */
let unavailableProducts = new Set(savedProducts.unavailable || []);
/** Products added on this device: [{ name, activeIngredient, custom: true }]. */
let customProducts = (savedProducts.custom || []).map((p) => ({ ...p, custom: true }));
/** The product list plus products added on this device. */
let products = [];
let productsPanelOpen = false;

function loadSavedProducts() {
  try { return JSON.parse(localStorage.getItem(PRODUCTS_KEY)) || {}; } catch { return {}; }
}

function saveUnavailableProducts() {
  products = [...listProducts, ...customProducts];
  const custom = customProducts.map(({ name, activeIngredient }) => ({ name, activeIngredient }));
  try { localStorage.setItem(PRODUCTS_KEY, JSON.stringify({ unavailable: [...unavailableProducts], custom })); } catch {}
}

/** Ingredient names the treatments use, offered as suggestions when adding a product. */
let ingredientSuggestions;
function ingredientNames() {
  ingredientSuggestions ||= [...new Set(kb.conditions.flatMap((c) => c.treatments)
    .filter((t) => mitigationOf(t.applicationType) === "chemical")
    .flatMap((t) => { const n = treatmentNeeds(t.title); return [...n.alternatives.flat(), ...n.also]; }))].sort();
  return ingredientSuggestions;
}

/** Marks chemical options no switched-on product can supply (skipped if the product list did not load). */
function applyProductAvailability(entries) {
  if (!products.length) return;
  const keys = availableKeys(products, unavailableProducts);
  for (const e of entries) for (const p of e.problems) for (const o of p.options) {
    if (o.chemical) o.unavailable = !treatmentAvailable(o.treatment, keys);
  }
}

let kb;
let state = loadState();

function defaultState() {
  return {
    siteLabel: "",
    inspectionDate: new Date().toLocaleDateString("en-CA"), // YYYY-MM-DD, local time
    /** Soil Care programs: { soilCare, resilience, soilAnalysis, soilSamples } (definitions in engine SITE_PROGRAMS). */
    programs: { soilCare: false, resilience: false, soilAnalysis: false, soilSamples: 1 },
    leadNumber: "",
    site: { address: "", jurisdiction: "VA", nearWater: false, sensitiveSite: false, publicProperty: false },
    /** Backstage job logistics for the work address (closest base, drive-time band). Not shown in the plan. */
    logistics: null,
    plants: [],
    /** selKey -> true/false where the user changed the default selection. */
    overrides: {},
    /** selKey -> applications per year chosen within the reference range (default: minimum). */
    counts: {},
  };
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && Array.isArray(s.plants)) return { ...defaultState(), ...s, counts: s.counts || {}, programs: { ...defaultState().programs, ...s.programs }, site: { ...defaultState().site, ...s.site } };
  } catch {}
  return defaultState();
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Problem ids renamed in knowledge base 2.0 (manual-based).
const RENAMED = {
  "two-lined-chestnut-borer": "twolined-chestnut-borer", "beech-scale": "beech-bark-scale", aphids: "aphids-general",
  bagworm: "bagworms", phytophthora: "phytophthora-root-rot", verticillium: "verticillium-wilt",
  diplodia: "diplodia-tip-blight", "cedar-apple-rust": "cedar-apple-and-related-rusts",
};
const uid = () => Math.random().toString(36).slice(2, 9);
const plantByUid = (id) => state.plants.find((p) => p.uid === id);

function setHeader(title, actionsHtml = "") {
  $title.textContent = title;
  $actions.innerHTML = actionsHtml;
}

const flagsHtml = (flags) => flags.map((f) => `<div class="flag ${f.level}">${esc(f.text)}</div>`).join("");

/** Effective selection: defaults per problem, with the user's overrides applied. */
function selectionFor(entries) {
  const sel = new Set();
  for (const e of entries) for (const p of e.problems) {
    const defaults = new Set(defaultSelection(p));
    for (const o of p.options) {
      const key = selKey(e.plant.uid, o.treatment.id);
      if (o.unavailable) continue;
      if (key in state.overrides ? state.overrides[key] : defaults.has(o.treatment.id)) sel.add(key);
    }
  }
  return sel;
}

// ---------- Landscape ----------

function renderLandscape() {
  const s = state.site;
  setHeader("Landscape");
  $view.innerHTML = `
    <h2>Job</h2>
    <label class="row"><span>Site inspection date</span><input type="date" id="inspectionDate" value="${esc(state.inspectionDate)}"></label>
    <label class="row"><span>SingleOps lead #</span><input type="text" id="leadNumber" inputmode="numeric" value="${esc(state.leadNumber)}" style="width:140px"></label>
    <div class="row"><input type="text" id="siteLabel" placeholder="Prospect / client name" value="${esc(state.siteLabel)}" style="flex:1"></div>
    <div class="row"><input type="text" id="address" autocomplete="street-address" placeholder="Work address: street, city, state ZIP" value="${esc(s.address)}" style="flex:1"></div>

    <h2>Soil Care</h2>
    ${SITE_PROGRAMS.map((p) => `<label class="row"><span>${esc(p.label)}</span><input type="checkbox" data-program="${p.key}" ${state.programs[p.key] ? "checked" : ""}></label>
      ${p.quantityKey ? `<label class="row" id="qty-${p.key}" ${state.programs[p.key] ? "" : `style="display:none"`}><span class="small">Number of samples</span>
        <input type="number" min="1" step="1" inputmode="numeric" data-program-qty="${p.quantityKey}" value="${esc(programQuantity(state.programs, p))}"></label>` : ""}`).join("")}

    <h2>Plants (${state.plants.length})</h2>
    ${state.plants.map((p) => `
      <a class="item" href="#plant/${p.uid}">
        <b>${esc(plantName({ plant: p, host: kb.hostById[p.hostId] }))}</b><br>
        <span class="small ${p.conditionIds.length ? "muted" : "status-outOfWindow"}">${p.conditionIds.length
          ? esc(p.conditionIds.map((id) => kb.conditionById[id]?.name).filter(Boolean).join(", "))
          : "No problems selected"}</span>
      </a>`).join("") || `<p class="small muted">Add each tree or ornamental in the landscape, then choose its problems.</p>`}
    <a class="primary" href="#add">+ Add plant</a>

    <button class="primary" id="build" ${hasPlan() ? "" : "disabled"}>Build treatment plan</button>
    <button class="link" id="clear">Start new landscape</button>`;

  $view.querySelector("#siteLabel").oninput = (e) => { state.siteLabel = e.target.value; save(); };
  $view.querySelector("#address").onchange = (e) => {
    s.address = e.target.value.trim();
    state.logistics = s.address ? { pending: true } : null;
    save();
    runLogistics();
  };
  $view.querySelectorAll("[data-program]").forEach((c) => c.onchange = () => {
    state.programs[c.dataset.program] = c.checked;
    save();
    const $qty = $view.querySelector(`#qty-${c.dataset.program}`);
    if ($qty) $qty.style.display = c.checked ? "" : "none";
    $view.querySelector("#build").disabled = !hasPlan();
  });
  $view.querySelectorAll("[data-program-qty]").forEach((i) => i.oninput = () => {
    state.programs[i.dataset.programQty] = Math.max(1, parseInt(i.value) || 1);
    save();
  });
  $view.querySelector("#inspectionDate").onchange = (e) => { state.inspectionDate = e.target.value; save(); };
  $view.querySelector("#leadNumber").oninput = (e) => { state.leadNumber = e.target.value.trim(); save(); };
  $view.querySelector("#build").onclick = () => { location.hash = "#result"; };
  $view.querySelector("#clear").onclick = () => {
    if (state.plants.length && !$view.querySelector("#clear").dataset.armed) {
      const b = $view.querySelector("#clear");
      b.dataset.armed = "1"; b.textContent = "Tap again to clear all plants";
      return;
    }
    state = defaultState();
    save(); renderLandscape();
  };
}

function renderAddPlant() {
  setHeader("Add plant", `<a href="#plan">Cancel</a>`);
  $view.innerHTML = `<input type="search" id="q" placeholder="Search trees & ornamentals"><div id="list"></div>`;
  const $list = $view.querySelector("#list");
  const draw = (q) => {
    const hosts = kb.hosts.filter((h) => !q || h.name.toLowerCase().includes(q.toLowerCase()));
    $list.innerHTML = hosts.map((h) => `<a class="item" href="#" data-h="${h.id}">${esc(h.name)}
      <span class="small muted">· ${problemsForHost(kb, h.id).common.length} common problems</span></a>`).join("")
      || `<p class="muted">No matches.</p>`;
    $list.querySelectorAll("[data-h]").forEach((a) => a.onclick = (ev) => {
      ev.preventDefault();
      const p = { uid: uid(), hostId: a.dataset.h, label: "", qty: 1, dbh: "", crownLoss: "", conditionIds: [] };
      state.plants.push(p);
      save();
      location.hash = `#plant/${p.uid}`;
    });
  };
  $view.querySelector("#q").oninput = (e) => draw(e.target.value);
  draw("");
}

function renderPlant(id) {
  const p = plantByUid(id);
  if (!p) { location.hash = "#plan"; return; }
  const host = kb.hostById[p.hostId];
  setHeader(host.name, `<a href="#plan">Done</a>`);
  const { common, general } = problemsForHost(kb, p.hostId);
  const needsCrown = () => p.conditionIds.some((cid) => kb.conditionById[cid]?.maxCrownLossPercent != null);
  const problemRow = (c) => `
    <label class="row"><span>${esc(c.name)}<br><span class="small muted">${esc(kb.categoryById[c.category].name)}</span></span>
    <input type="checkbox" data-c="${c.id}" ${p.conditionIds.includes(c.id) ? "checked" : ""}></label>`;
  const generalOpen = general.some((c) => p.conditionIds.includes(c.id));

  $view.innerHTML = `
    <div class="row"><input type="text" id="label" placeholder="Label, e.g. front yard (optional)" value="${esc(p.label)}" style="flex:1"></div>
    <label class="row"><span>Quantity</span><input type="number" inputmode="numeric" min="1" id="qty" value="${esc(p.qty)}"></label>
    <label class="row"><span>DBH (in., optional)</span><input type="number" inputmode="decimal" min="0" id="dbh" value="${esc(p.dbh)}"></label>
    <label class="row" id="crownRow" style="${needsCrown() ? "" : "display:none"}"><span>Crown loss (%)</span>
      <input type="number" inputmode="numeric" min="0" max="100" id="crownLoss" value="${esc(p.crownLoss)}"></label>

    <h2>Common on ${esc(host.name)}</h2>
    ${common.map(problemRow).join("")}
    <details ${generalOpen ? "open" : ""}><summary><h2 style="display:inline">Broad host range & abiotic (${general.length})</h2></summary>
      ${general.map(problemRow).join("")}
    </details>

    <a class="primary" href="#add">Save & add another plant</a>
    <a class="primary" href="#plan">Done: back to landscape</a>
    <button class="link" id="remove">Remove this plant</button>`;

  $view.querySelector("#label").oninput = (e) => { p.label = e.target.value; save(); };
  $view.querySelector("#qty").oninput = (e) => { p.qty = Math.max(1, parseInt(e.target.value) || 1); save(); };
  $view.querySelector("#dbh").oninput = (e) => { p.dbh = e.target.value; save(); };
  $view.querySelector("#crownLoss").oninput = (e) => { p.crownLoss = e.target.value; save(); };
  $view.querySelectorAll("[data-c]").forEach((cb) => cb.onchange = () => {
    const cid = cb.dataset.c;
    p.conditionIds = cb.checked ? [...p.conditionIds, cid] : p.conditionIds.filter((x) => x !== cid);
    save();
    $view.querySelector("#crownRow").style.display = needsCrown() ? "" : "none";
  });
  $view.querySelector("#remove").onclick = () => {
    state.plants = state.plants.filter((x) => x.uid !== id);
    for (const m of [state.overrides, state.counts]) for (const k of Object.keys(m)) if (k.startsWith(`${id}:`)) delete m[k];
    save();
    location.hash = "#plan";
  };
}

// ---------- Plan ----------

function optionHtml(plantUid, o, selected) {
  const t = o.treatment, s = t.schedule;
  const key = selKey(plantUid, t.id);
  const stocked = o.chemical && !o.unavailable && products.length && plantUid !== PROGRAM_UID
    ? [...new Set(productsFor(t, products, unavailableProducts).map((p) => p.name.split("_")[0].trim()))] : [];
  return `
    <label class="opt ${o.notAdvised ? "notAdvised" : ""} ${o.unavailable ? "unavailable" : ""}">
      <input type="checkbox" data-k="${key}" ${selected.has(key) ? "checked" : ""} ${o.unavailable ? "disabled" : ""}>
      <div>
        <div class="title">${esc(t.title)}</div>
        <div class="small"><span class="chip">${esc(o.type.name)}</span>
          ${o.chemical && o.preferred ? ` <span class="chip pref">Preferred</span>` : ""}</div>
        ${o.notAdvised ? `<div class="small status-notAdvised">Not advised under current conditions</div>` : ""}
        ${o.unavailable ? `<div class="small status-outOfWindow">No available product (see Edit Available Products)</div>` : ""}
        ${stocked.length ? `<div class="small"><b>Products:</b> ${esc(stocked.join(", "))}</div>` : ""}
        ${s ? `
          <div class="small"><b>Applications:</b> ${s.visitsMin === s.visitsMax ? describeVisits(s)
            : `<select data-n="${key}">${Array.from({ length: s.visitsMax - s.visitsMin + 1 }, (_, i) => s.visitsMin + i)
                .map((n) => `<option ${n === chosenCount(s, state.counts[key]) ? "selected" : ""}>${n}</option>`).join("")}</select>
              per year <span class="muted">(reference ${s.visitsMin}–${s.visitsMax})</span>`}${s.interval ? `, ${esc(s.interval)}` : ""}</div>
          <div class="small"><b>Repeat:</b> ${esc(s.repeat)}</div>
          <div class="small"><b>Window:</b> ${esc(s.window)}</div>`
        : t.oneOff ? `<div class="small"><b>One-time visit:</b> no set timing · <b>Samples:</b> ${esc(t.quantity ?? 1)}</div>`
        : t.months?.length ? `<div class="small"><b>When:</b> ${describeMonths(t.months)}</div>` : ""}
        ${t.protection ? `<div class="small"><b>Protection:</b> ${esc(t.protection)}</div>` : ""}
        ${(t.notes || []).length ? `<ul class="small">${t.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
        <div class="small muted">${esc(t.purpose)}</div>
        ${flagsHtml(o.flags)}
      </div>
    </label>`;
}

const hasPlan = () => state.plants.some((p) => p.conditionIds.length) || SITE_PROGRAMS.some((p) => state.programs[p.key]);

function renderResult() {
  const plants = state.plants.filter((p) => p.conditionIds.length);
  if (!hasPlan()) { location.hash = "#plan"; return; }
  setHeader("Treatment Plan", `<a href="#plan">Edit</a>`);
  const entries = planLandscape(kb, state.site, plants);
  const programEntry = siteProgramEntry(kb, state.programs);
  if (programEntry) entries.push(programEntry);
  applyProductAvailability(entries);
  const selected = selectionFor(entries);
  const cal = landscapeCalendar(entries, selected);
  const tot = applicationTotals(entries, selected);
  const vp = visitPlan(entries, selected, state.counts);

  $view.innerHTML = `
    <p class="small muted">${esc(state.siteLabel || "Unnamed prospect")}${state.leadNumber ? ` · Lead #${esc(state.leadNumber)}` : ""}${state.inspectionDate ? ` · Inspected ${esc(state.inspectionDate)}` : ""}<br>
      ${esc(state.site.address || "No work address")} · ${state.site.jurisdiction} · ${plants.length} plant entr${plants.length === 1 ? "y" : "ies"}</p>
    ${tot.programs || vp.anytime.length ? `<div class="banner">${tot.programs ? `<b>${vp.visits.length}</b> site visit${vp.visits.length === 1 ? "" : "s"}/year
      covering <b>${vp.applications}</b> applications from ${tot.programs} treatment program${tot.programs === 1 ? "" : "s"}
      (${tot.min === tot.max ? tot.min : `${tot.min}–${tot.max}`} applications across the reference ranges)` : ""}${tot.programs && vp.anytime.length ? " + " : ""}${vp.anytime.length
        ? `<b>${vp.anytime.length}</b> one-time visit${vp.anytime.length === 1 ? "" : "s"} (no set timing)` : ""} ·
      <a id="jump" style="cursor:pointer;text-decoration:underline">see visit framework</a></div>` : ""}
    ${entries.map((e) => `
      <h3 class="plant">${esc(plantName(e))}</h3>
      ${e.problems.map((p) => {
        const chem = p.options.filter((o) => o.chemical);
        const byT = new Map(chem.map((o) => [o.treatment, o]));
        const ranked = rankTreatments(chem.map((o) => o.treatment), (t) => !byT.get(t).notAdvised && !byT.get(t).unavailable);
        const [rec, alt] = [ranked.recommended, ranked.alternatives].map((ts) => ts.map((t) => byT.get(t)));
        const cult = p.options.filter((o) => !o.chemical && !o.treatment.oneOff);
        const once = p.options.filter((o) => o.treatment.oneOff);
        const altOpen = alt.some((o) => selected.has(selKey(e.plant.uid, o.treatment.id)));
        return `
          <h4>${esc(p.condition.name)}</h4>
          ${flagsHtml(p.flags)}
          ${chem.length ? `<div class="group">${e.plant.uid === PROGRAM_UID ? "Program" : "Chemical"}</div>${rec.map((o) => optionHtml(e.plant.uid, o, selected)).join("")}` : ""}
          ${alt.length ? `<details class="alts" ${altOpen ? "open" : ""}><summary>Alternatives (${alt.length})</summary>${alt.map((o) => optionHtml(e.plant.uid, o, selected)).join("")}</details>` : ""}
          ${once.length ? `<div class="group">One-time</div>${once.map((o) => optionHtml(e.plant.uid, o, selected)).join("")}` : ""}
          ${cult.length ? `<div class="group">Cultural</div>${cult.map((o) => optionHtml(e.plant.uid, o, selected)).join("")}` : ""}`;
      }).join("")}`).join("")}
    ${vp.visits.length || vp.anytime.length ? `<h2 id="visits">Visit framework: minimum site visits</h2>
      <p class="small muted">Checked chemical programs at their chosen number of applications (pick within the reference range on each program above; default is the minimum), combined into the fewest visits that respect each window and interval. Flexible range = dates that still work for every application on the visit.</p>
      ${vp.visits.map((v, i) => `<div class="row" style="display:block">
        <div class="title">Visit ${i + 1}: ${slotName(v.slot)} <span class="small muted">${v.from !== v.to ? `flexible ${esc(describeVisitWindow(v))}` : ""}</span></div>
        <div class="small">${v.items.map((it) => `${esc(it.plant)}: ${esc(it.option.treatment.title)} <span class="muted">(${esc(it.problem)}${it.of > 1 ? `, ${it.n} of ${it.of}` : ""})</span>`).join("<br>")}</div>
      </div>`).join("")}
      ${vp.anytime.map((a, i) => `<div class="row" style="display:block">
        <div class="title">Visit ${vp.visits.length + i + 1}: One-time <span class="small muted">no set timing</span></div>
        <div class="small">${esc(a.plant)}: ${esc(anytimeLabel(a.option))} <span class="muted">(${esc(a.problem)})</span></div>
        <div class="small muted">Schedule in SingleOps at the arborist's discretion.</div>
      </div>`).join("")}
      ${vp.compressed.map((c) => `<div class="flag caution">${esc(c.plant)}: ${esc(c.option.treatment.title)} does not fit its window at the stated spacing; scheduled as early as possible.</div>`).join("")}` : ""}
    ${cal.length ? `<h2>Annual calendar: application windows (checked items)</h2>
      ${cal.map((c) => `<div class="row" style="align-items:flex-start"><b style="width:42px;flex:none">${monthName(c.month)}</b>
        <div class="small">${c.items.map((i) => `${esc(i.plant)}: ${esc(i.option.treatment.title)} <span class="muted">(${esc(i.problem)})</span>`).join("<br>")}</div></div>`).join("")}` : ""}
    <button class="primary" id="share">Share / copy plan text</button>
    <div class="banner">${esc(kb.meta.disclaimer)}</div>
    ${products.length ? `<button class="primary" id="editProducts" aria-expanded="${productsPanelOpen}">Edit Available Products</button>
      ${productsPanelOpen ? productsPanelHtml() : ""}` : ""}`;

  $view.querySelectorAll("[data-k]").forEach((cb) => cb.onchange = () => {
    state.overrides[cb.dataset.k] = cb.checked;
    save();
    const y = window.scrollY;
    renderResult();
    window.scrollTo(0, y);
  });
  $view.querySelectorAll("[data-n]").forEach((sel) => sel.onchange = () => {
    state.counts[sel.dataset.n] = Number(sel.value);
    save();
    const y = window.scrollY;
    renderResult();
    window.scrollTo(0, y);
  });
  $view.querySelector("#editProducts")?.addEventListener("click", () => {
    productsPanelOpen = !productsPanelOpen;
    rerender();
    if (productsPanelOpen) $view.querySelector("#products").scrollIntoView({ behavior: "smooth" });
  });
  $view.querySelectorAll("[data-product]").forEach((cb) => cb.onchange = () => {
    if (cb.checked) unavailableProducts.delete(cb.dataset.product); else unavailableProducts.add(cb.dataset.product);
    saveUnavailableProducts();
    rerender();
  });
  $view.querySelector("#addProduct")?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const name = $view.querySelector("#newProductName").value.trim();
    const activeIngredient = $view.querySelector("#newProductAi").value.trim();
    const $err = $view.querySelector("#addProductError");
    if (!name || !activeIngredient) { $err.textContent = "Enter a product name and its active ingredient."; return; }
    if (products.some((p) => p.name.toLowerCase() === name.toLowerCase())) { $err.textContent = `${name} is already in the list.`; return; }
    customProducts.push({ name, activeIngredient, custom: true });
    unavailableProducts.delete(name);
    saveUnavailableProducts();
    rerender();
    toast(`Added ${name}`);
  });
  $view.querySelectorAll("[data-remove-product]").forEach((b) => b.onclick = (ev) => {
    ev.preventDefault();
    const name = b.dataset.removeProduct;
    customProducts = customProducts.filter((p) => p.name !== name);
    unavailableProducts.delete(name);
    saveUnavailableProducts();
    rerender();
  });
  $view.querySelectorAll("[data-products-all]").forEach((b) => b.onclick = () => {
    unavailableProducts = b.dataset.productsAll === "on" ? new Set() : new Set(products.map((p) => p.name));
    saveUnavailableProducts();
    rerender();
  });
  $view.querySelector("#jump")?.addEventListener("click", () => $view.querySelector("#visits").scrollIntoView({ behavior: "smooth" }));
  $view.querySelector("#share").onclick = () => sharePlan(exportText(kb, state.site, entries, selected, state.siteLabel, state.counts, { inspectionDate: state.inspectionDate, leadNumber: state.leadNumber }));
}

function rerender() {
  const y = window.scrollY;
  renderResult();
  window.scrollTo(0, y);
}

function productsPanelHtml() {
  const on = products.filter((p) => !unavailableProducts.has(p.name)).length;
  return `<section id="products">
    <h2>Available products (${on} of ${products.length})</h2>
    <p class="small muted">Unchecked products are out of stock: treatments no checked product supplies cannot be selected above.</p>
    <form id="addProduct" class="addProduct">
      <div class="title">Add a product</div>
      <input type="text" id="newProductName" placeholder="Product name" autocomplete="off">
      <input type="text" id="newProductAi" list="ingredientNames" placeholder="Active ingredient (join several with +)" autocomplete="off">
      <datalist id="ingredientNames">${ingredientNames().map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
      <div class="small status-outOfWindow" id="addProductError"></div>
      <button class="primary" type="submit">Add product</button>
      <div class="small muted">Added products are saved on this device only. Add them to reference/phc-product-list.md to share with everyone.</div>
    </form>
    <div class="seg"><button data-products-all="on">Check all</button><button data-products-all="off">Uncheck all</button></div>
    ${[...products].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })).map((p) => `
      <label class="row"><input type="checkbox" data-product="${esc(p.name)}" ${unavailableProducts.has(p.name) ? "" : "checked"}>
        <span><b>${esc(p.name)}</b><br><span class="small muted">${esc(p.activeIngredient)}</span>
          ${p.custom ? `<br><span class="chip">Added on this device</span>${productKeys(p).some((k) => ingredientNames().includes(k)) ? ""
            : ` <span class="small status-outOfWindow">Matches no treatment ingredient</span>`}` : ""}</span>
        ${p.custom ? `<button class="link" data-remove-product="${esc(p.name)}">Remove</button>` : ""}</label>`).join("")}
  </section>`;
}

async function sharePlan(text) {
  if (navigator.share) {
    try { await navigator.share({ title: "PHC treatment plan", text }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  try { await navigator.clipboard.writeText(text); toast("Copied to clipboard"); }
  catch { $view.insertAdjacentHTML("beforeend", `<pre>${esc(text)}</pre>`); }
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

// ---------- Library ----------

function renderLibrary() {
  setHeader("Pests & Diseases");
  $view.innerHTML = `<input type="search" id="q" placeholder="Search name or symptom"><div id="list"></div>`;
  const $list = $view.querySelector("#list");
  const draw = (q) => {
    $list.innerHTML = kb.categories.map((cat) => {
      const items = kb.conditions.filter((c) => c.category === cat.id && matchesQuery(c, q));
      return items.length ? `<h2>${esc(cat.name)}</h2>` + items.map((c) => `<a class="item" href="#condition/${c.id}">${esc(c.name)}</a>`).join("") : "";
    }).join("") || `<p class="muted">No matches.</p>`;
  };
  $view.querySelector("#q").oninput = (e) => draw(e.target.value);
  draw("");
}

function renderCondition(id) {
  const c = kb.conditionById[id];
  if (!c) { location.hash = "#library"; return; }
  setHeader(c.name, `<a href="#library">Back</a>`);
  const list = (title, items) => items?.length ? `<h2>${title}</h2><ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
  const hosts = [...c.hostIds.map((h) => kb.hostById[h].name), ...(c.generalist ? ["many others"] : [])].join(", ");
  $view.innerHTML = `
    ${c.scientificName ? `<p><i>${esc(c.scientificName)}</i></p>` : ""}
    <p><b>Hosts:</b> ${esc(hosts || "Any")}${c.hostNote ? `<br><span class="small muted">${esc(c.hostNote)}</span>` : ""}</p>
    ${c.activeMonths?.length ? `<p><b>Active:</b> ${describeMonths(c.activeMonths)}${c.peakNote ? ` <span class="small muted">${esc(c.peakNote)}</span>` : ""}</p>` : ""}
    ${list("Identification", c.symptoms)}
    ${list("Biology", c.biology)}
    ${MITIGATIONS.map(([key, label]) => {
      const ts = c.treatments.filter((t) => mitigationOf(t.applicationType) === key);
      const { recommended, alternatives } = key === "chemical" ? rankTreatments(ts) : { recommended: ts, alternatives: [] };
      const card = (t) => {
        const s = t.schedule;
        return `<div class="row" style="display:block">
          <div class="title">${esc(t.title)}</div>
          <div class="small"><span class="chip">${esc(kb.typeById[t.applicationType].name)}</span>${t.preferred ? ` <span class="chip pref">Preferred</span>` : ""}</div>
          ${s ? `<div class="small">${describeVisits(s)}${s.interval ? `, ${esc(s.interval)}` : ""} · ${esc(s.repeat)}<br>Window: ${esc(s.window)}</div>`
            : `<div class="small">${describeMonths(t.months)}</div>`}
          <div class="small muted">${esc(t.purpose)}</div>
          ${(t.notes || []).length ? `<ul class="small">${t.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
        </div>`;
      };
      return ts.length ? `<h2>${label}</h2>` + recommended.map(card).join("")
        + (alternatives.length ? `<details class="alts"><summary>Alternatives (${alternatives.length})</summary>${alternatives.map(card).join("")}</details>` : "") : "";
    }).join("")}
    ${c.lookalikeIds?.length ? `<h2>Look-alikes</h2>` + c.lookalikeIds.map((l) => `<a class="item" href="#condition/${l}">${esc(kb.conditionById[l].name)}</a>`).join("") : ""}
    ${list("Regulatory", (c.regulatory || []).map((r) => `${r.jurisdictions.join("/")}: ${r.text}`))}
    ${list("Cost-share", (c.costShare || []).map((x) => `${x.jurisdiction}: ${x.text}`))}
    ${list("Warnings", c.warnings)}
    ${list("Content review flags", c.reviewFlags)}
    ${list("Sources", c.sources)}`;
}

// ---------- Reference ----------

function renderReference() {
  setHeader("Reference");
  $view.innerHTML = `
    <h2>Application types</h2>
    ${kb.applicationTypes.map((t) => `<div class="row"><span>${esc(t.name)}</span><span class="small muted">${MITIGATIONS.find(([k]) => k === mitigationOf(t.id))[1]}</span></div>`).join("")}
    ${kb.jurisdictions.map((j) => `
      <h2>${esc(j.name)}</h2>
      <p>${esc(j.authority)} · <a href="tel:${j.phone.replace(/\D/g, "")}">${esc(j.phone)}</a> · <a href="${esc(j.website)}" target="_blank" rel="noopener">Website</a></p>
      <ul class="small">
        ${j.notes.map((n) => `<li>${esc(n)}</li>`).join("")}
        <li><b>Near water:</b> ${esc(j.nearWater)}</li>
        <li><b>Sensitive sites:</b> ${esc(j.sensitiveSite)}</li>
        ${j.neonicotinoid ? `<li><b>Neonicotinoids:</b> ${esc(j.neonicotinoid)}</li>` : ""}
      </ul>`).join("")}
    <h2>About</h2>
    <p class="small">${esc(kb.meta.title)} v${esc(kb.meta.version)}<br>
      Source: ${esc(kb.meta.source)}<br>Content review status: <b>${esc(kb.meta.reviewStatus)}</b></p>
    <div class="banner">${esc(kb.meta.disclaimer)}</div>
    <p class="small muted" id="offline-status"></p>`;
  const $st = $view.querySelector("#offline-status");
  if (!("serviceWorker" in navigator)) $st.textContent = "Offline mode not supported in this browser.";
  else navigator.serviceWorker.getRegistration().then((r) => {
    $st.textContent = r?.active ? "Offline copy installed. Add to Home Screen to keep it available without a connection." : "Offline copy not installed yet. Reload once while online.";
  });
}

// ---------- Logistics (backstage) ----------

let logisticsRunning = false;

/** Closest base and drive-time band for the work address. Runs when online; pending otherwise. */
async function runLogistics() {
  const address = state.site.address;
  if (!address || !state.logistics?.pending || logisticsRunning || !navigator.onLine) return;
  logisticsRunning = true;
  try {
    const result = await assessAddress(address, bases);
    if (state.site.address !== address) return; // address changed meanwhile
    state.logistics = result;
    // Set jurisdiction from the geocoded state when the address is in VA, MD or DC.
    if (result.jurisdiction && result.jurisdiction !== state.site.jurisdiction) {
      state.site.jurisdiction = result.jurisdiction;
    }
    save();
    logJob(result);
  } catch {
    // Network or service failure: stays pending and retries on the next online event or app start.
  } finally {
    logisticsRunning = false;
  }
}

function opsLog() {
  try { return JSON.parse(localStorage.getItem(OPS_LOG_KEY)) || []; } catch { return []; }
}

function logJob(result) {
  const log = opsLog().filter((r) => r.address !== result.address);
  log.unshift({ ...result, siteLabel: state.siteLabel, leadNumber: state.leadNumber, inspectionDate: state.inspectionDate });
  try { localStorage.setItem(OPS_LOG_KEY, JSON.stringify(log.slice(0, 500))); } catch {}
}

/** Hidden view (#ops): bases and job logistics recorded on this device. */
function renderOps() {
  setHeader("Operations (backstage)", `<a href="#plan">Back</a>`);
  const band = (id) => BANDS.find((b) => b.id === id)?.label || "—";
  const log = opsLog();
  $view.innerHTML = `
    <h2>Operations bases (${bases.bases.length})</h2>
    ${bases.bases.map((b) => `<div class="row"><span><b>${esc(b.name)}</b><br><span class="small muted">${esc(b.address)}</span></span></div>`).join("")
      || `<p class="small muted">No bases configured (web/data/bases.json).</p>`}
    <p class="small muted">Drive times: OpenStreetMap / OSRM free-flow × ${esc(bases.trafficFactor)} business-hours traffic factor.</p>
    <h2>Job locations (${log.length})</h2>
    ${log.map((r) => `<div class="row" style="display:block">
      <div class="title">${esc(r.address)}${r.siteLabel ? ` <span class="small muted">(${esc(r.siteLabel)}${r.leadNumber ? ` · lead ${esc(r.leadNumber)}` : ""})</span>` : ""}</div>
      <div class="small">${r.error ? `<span class="status-outOfWindow">${esc(r.error)}</span>`
        : `${esc(r.baseName)} · ${esc(r.minutes)} min · <b>${esc(band(r.band))}</b> <span class="muted">(${esc(r.method)}${r.precision && r.precision !== "address" ? `; located by ${esc(r.precision)}` : ""})</span>`}</div>
      <div class="small muted">${esc(r.computedAt?.slice(0, 10))}</div></div>`).join("") || `<p class="small muted">None yet.</p>`}`;
}

// ---------- Routing ----------

function route() {
  const [name, arg] = (location.hash || "#plan").slice(1).split("/");
  const tab = { plan: "plan", add: "plan", plant: "plan", result: "plan", library: "library", condition: "library", reference: "reference", ops: "reference" }[name] || "plan";
  document.querySelectorAll("nav.tabs a").forEach((a) => a.classList.toggle("on", a.dataset.tab === tab));
  ({
    add: renderAddPlant, plant: () => renderPlant(arg), result: renderResult,
    library: renderLibrary, condition: () => renderCondition(arg), reference: renderReference, ops: renderOps,
  }[name] || renderLandscape)();
  window.scrollTo(0, 0);
}

async function start() {
  try {
    kb = indexKb(await (await fetch("data/knowledge_base.json")).json());
  } catch {
    $view.innerHTML = `<p>Could not load the knowledge base. Connect once to install the offline copy.</p>`;
    return;
  }
  // Carry saved plants across data updates: follow renamed problems, drop ones that no longer exist.
  state.plants = state.plants.filter((p) => kb.hostById[p.hostId]);
  for (const p of state.plants) p.conditionIds = p.conditionIds.map((id) => RENAMED[id] || id).filter((id) => kb.conditionById[id]);
  try { bases = await (await fetch("data/bases.json")).json(); } catch {}
  try { listProducts = (await (await fetch("data/products.json")).json()).products || []; } catch {}
  products = [...listProducts, ...customProducts];
  window.addEventListener("online", runLogistics);
  runLogistics();
  window.addEventListener("hashchange", route);
  route();
  if ("serviceWorker" in navigator) {
    // When an updated version takes over, reload once so the new files are shown (skipped on first install).
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController) location.reload(); });
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

start();
