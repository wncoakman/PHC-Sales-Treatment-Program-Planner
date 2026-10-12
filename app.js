import {
  MITIGATIONS, describeMonths, describeVisits, indexKb, problemsForHost, matchesQuery, mitigationOf,
  planLandscape, defaultSelection, rankTreatments, landscapeCalendar, applicationTotals, exportText, selKey, plantName, monthName,
  visitPlan, slotName, describeVisitWindow, chosenCount, SITE_PROGRAMS, siteProgramEntry, PROGRAM_UID, programQuantity, anytimeLabel,
  SOIL_SCOPES, DEFAULT_SCOPE, alsoFitsText, numberedVisits, ASAP_TEXT,
} from "./engine.js";
import { assessAddress, BANDS } from "./logistics.js";
import { reportData, renderReport, exportFiles } from "./report.js";
import { makeZip } from "./zip.js";
import { drawSiteMap } from "./sitemap.js";
import { startGpsCapture } from "./gps.js";
import { fineTuneMap } from "./mapview.js";
import { parseCoords, WEAK_ACCURACY, ATTRIBUTION } from "./geo.js";
import { shrinkPhoto, savePhoto, getPhoto, deletePhotos, clearPhotos, photoForPdf } from "./photos.js";
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
    if (o.chemical && !o.treatment.anyProduct) o.unavailable = !treatmentAvailable(o.treatment, keys);
  }
}

let kb;
let state = loadState();

function defaultState() {
  return {
    siteLabel: "",
    inspectionDate: new Date().toLocaleDateString("en-CA"), // YYYY-MM-DD, local time
    /**
     * Soil Care programs (definitions in engine SITE_PROGRAMS): on/off by key, sample count and areas,
     * scope: key -> SOIL_SCOPES id, targets: key -> plant uids when the scope is "specific".
     */
    programs: { soilCare: false, resilience: false, correction: false, soilAnalysis: false, soilSamples: 1, soilAreas: "", scope: {}, targets: {} },
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

// Collapsible sections remember whether the user opened them, so a re-render after a checkbox
// change leaves the page as they had it. Anything not yet touched uses its default.
const openSecs = new Map();
const sec = (id, dflt = false) => `data-sec="${esc(id)}"${(openSecs.has(id) ? openSecs.get(id) : dflt) ? " open" : ""}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

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
    <details class="section" ${sec("job", !state.siteLabel && !s.address)}><summary>Job <span class="hint">${esc([state.siteLabel, state.leadNumber && `#${state.leadNumber}`].filter(Boolean).join(" · ") || "client, lead #, address")}</span></summary>
    <label class="row"><span>Site inspection date</span><input type="date" id="inspectionDate" value="${esc(state.inspectionDate)}"></label>
    <label class="row"><span>SingleOps lead #</span><input type="text" id="leadNumber" inputmode="numeric" value="${esc(state.leadNumber)}" style="width:140px"></label>
    <div class="row"><input type="text" id="siteLabel" placeholder="Prospect / client name" value="${esc(state.siteLabel)}" style="flex:1"></div>
    <div class="row"><input type="text" id="address" autocomplete="street-address" placeholder="Work address: street, city, state ZIP" value="${esc(s.address)}" style="flex:1"></div>
    </details>

    <h2>Plants (${state.plants.length})</h2>
    ${state.plants.map((p) => `
      <a class="item" href="#plant/${p.uid}">
        <b>${esc(plantName({ plant: p, host: kb.hostById[p.hostId] }))}</b>${p.photos?.length ? ` <span class="small muted">📷${p.photos.length}</span>` : ""}${p.gps ? ` <span class="small muted">📍</span>` : ""}<br>
        <span class="small ${p.conditionIds.length ? "muted" : "status-outOfWindow"}">${p.conditionIds.length
          ? esc(p.conditionIds.map((id) => kb.conditionById[id]?.name).filter(Boolean).join(", "))
          : "No problems selected"}</span>
      </a>`).join("") || `<p class="small muted">Add each tree or ornamental in the landscape, then choose its problems.</p>`}
    <a class="primary" href="#add">+ Add plant</a>

    <h2>Soil Care · last step</h2>
    ${soilCareHtml()}

    <button class="primary" id="build" ${hasPlan() ? "" : "disabled"}>Build treatment plan</button>
    <button class="link" id="clear">Start new landscape</button>`;

  $view.querySelectorAll("details[data-sec]").forEach((d) => d.ontoggle = () => openSecs.set(d.dataset.sec, d.open));
  $view.querySelector("#siteLabel").oninput = (e) => { state.siteLabel = e.target.value; save(); };
  $view.querySelector("#address").onchange = (e) => {
    s.address = e.target.value.trim();
    state.logistics = s.address ? { pending: true } : null;
    save();
    runLogistics();
  };
  const redraw = () => { const y = window.scrollY; renderLandscape(); window.scrollTo(0, y); };
  $view.querySelectorAll("[data-program]").forEach((c) => c.onchange = () => {
    state.programs[c.dataset.program] = c.checked;
    save(); redraw();
  });
  $view.querySelectorAll("[data-scope]").forEach((sel) => sel.onchange = () => {
    state.programs.scope = { ...state.programs.scope, [sel.dataset.scope]: sel.value };
    save(); redraw();
  });
  $view.querySelectorAll("[data-target]").forEach((c) => c.onchange = () => {
    const key = c.dataset.target, now = state.programs.targets?.[key] || [];
    state.programs.targets = { ...state.programs.targets, [key]: c.checked ? [...now, c.value] : now.filter((u) => u !== c.value) };
    save();
  });
  $view.querySelectorAll("[data-program-qty]").forEach((i) => i.oninput = () => {
    state.programs[i.dataset.programQty] = Math.max(1, parseInt(i.value) || 1);
    save();
  });
  $view.querySelectorAll("[data-program-areas]").forEach((i) => i.oninput = () => {
    state.programs[i.dataset.programAreas] = i.value;
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
    clearPhotos().catch(() => {});
  };
}

/** Soil Care programs, each with where it applies (or sample count and areas) once switched on. */
function soilCareHtml() {
  const pr = state.programs;
  const scopeHtml = (p) => {
    const scope = pr.scope?.[p.key] || DEFAULT_SCOPE;
    const chosen = new Set(pr.targets?.[p.key] || []);
    return `<label class="row"><span class="small">Apply to</span><select data-scope="${p.key}">
        ${SOIL_SCOPES.map(([k, label]) => `<option value="${k}" ${k === scope ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></label>
      ${scope !== "specific" ? "" : state.plants.map((pl) => `<label class="row"><span class="small">${esc(plantName({ plant: pl, host: kb.hostById[pl.hostId] }))}</span>
          <input type="checkbox" data-target="${p.key}" value="${pl.uid}" ${chosen.has(pl.uid) ? "checked" : ""}></label>`).join("")
        || `<p class="small status-outOfWindow">Add trees above, then choose them here.</p>`}`;
  };
  const samplesHtml = (p) => `<label class="row"><span class="small">Number of samples</span>
      <input type="number" min="1" step="1" inputmode="numeric" data-program-qty="${p.quantityKey}" value="${esc(programQuantity(pr, p))}"></label>
    <label class="row"><span class="small" style="flex:none">Sample areas</span><input type="text" data-program-areas="${p.areasKey}" placeholder="e.g. front beds, oak root zone" value="${esc(pr[p.areasKey])}" style="flex:1"></label>`;
  return SITE_PROGRAMS.map((p) => `<label class="row"><span>${esc(p.label)}</span><input type="checkbox" data-program="${p.key}" ${pr[p.key] ? "checked" : ""}></label>
    ${pr[p.key] ? `<div class="sub">${p.scoped ? scopeHtml(p) : ""}${p.quantityKey ? samplesHtml(p) : ""}</div>` : ""}`).join("");
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
      const p = { uid: uid(), hostId: a.dataset.h, label: "", qty: 1, dbh: "", crownLoss: "", conditionIds: [], photos: [], gps: null };
      state.plants.push(p);
      save();
      location.hash = `#plant/${p.uid}`;
    });
  };
  $view.querySelector("#q").oninput = (e) => draw(e.target.value);
  draw("");
}

/** "39.107900, -77.556400 · ±4 m · 14 readings", with how it was set for map and manual positions. */
function gpsText(g) {
  const how = g.source === "map" ? "placed on map" : g.source === "manual" ? "entered manually"
    : [`±${Math.round(g.acc)} m`, g.n > 1 && `${g.n} readings`, g.weak && "weak signal"].filter(Boolean).join(" · ");
  return `${g.lat.toFixed(6)}, ${g.lng.toFixed(6)} · ${how}`;
}
const gpsWarning = (g) => g.source !== "gps" ? ""
  : g.weak ? "Weak position (low-accuracy fallback). Re-record in the open, or fine-tune on the map."
  : g.acc > WEAK_ACCURACY ? `Accuracy is worse than ${WEAK_ACCURACY} m. Re-record in the open, or fine-tune on the map.` : "";
let gpsCapture = null; // the running capture, stopped (and saved) if the user leaves the plant screen

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
    <div class="row"><input type="text" id="label" placeholder="Location, e.g. front yard by driveway" value="${esc(p.label)}" style="flex:1"></div>
    <div class="capture">
      <label class="secondary" id="photoBtn">📷 Take or upload photo<input type="file" id="photo" accept="image/*" multiple hidden></label>
      <button class="secondary" id="locate">📍 ${p.gps ? "Re-record GPS" : "Record GPS location"}</button>
    </div>
    <div class="small muted" id="gpsText">${p.gps ? esc(gpsText(p.gps)) : "Stand at the tree, then record its GPS location for the report's site map."}</div>
    <div class="small status-outOfWindow" id="gpsWarn">${p.gps ? esc(gpsWarning(p.gps)) : ""}</div>
    <div class="gpsTools">
      <button class="link" id="fineTune" ${p.gps || state.plants.some((x) => x.gps) ? "" : "disabled"}>🗺 Fine-tune on map</button>
      <button class="link" id="manualToggle" aria-expanded="false">Enter coordinates manually</button>
    </div>
    <form id="manual" class="manual" hidden>
      <input type="text" id="manualCoords" inputmode="text" autocomplete="off" placeholder="39.10790, -77.55640  or  39.1079 N 77.5564 W">
      <button class="secondary" type="submit">Save</button>
    </form>
    <div class="thumbs" id="thumbs"></div>
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
  const $thumbs = $view.querySelector("#thumbs");
  const drawThumbs = async () => {
    for (const img of $thumbs.querySelectorAll("img")) URL.revokeObjectURL(img.src);
    const blobs = await Promise.all((p.photos || []).map((pid) => getPhoto(pid).catch(() => null)));
    $thumbs.innerHTML = blobs.map((b, i) => b ? `<span class="thumb"><img src="${URL.createObjectURL(b)}" alt="Photo ${i + 1}">
      <button data-del-photo="${p.photos[i]}" aria-label="Remove photo ${i + 1}">×</button></span>` : "").join("");
    $thumbs.querySelectorAll("[data-del-photo]").forEach((b) => b.onclick = async () => {
      const pid = b.dataset.delPhoto;
      p.photos = p.photos.filter((x) => x !== pid);
      save();
      await deletePhotos([pid]).catch(() => {});
      drawThumbs();
    });
  };
  drawThumbs();
  $view.querySelector("#photo").onchange = async (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    for (const f of files) {
      try {
        p.photos = [...(p.photos || []), await savePhoto(await shrinkPhoto(f))];
        save();
      } catch (err) { toast(`Photo not saved: ${err.message}`); }
    }
    drawThumbs();
    if (files.length && !p.gps) toast("Tip: record the GPS location too");
  };
  const $gpsText = $view.querySelector("#gpsText"), $gpsWarn = $view.querySelector("#gpsWarn");
  const setGps = (g) => {
    p.gps = { ...g, lat: +g.lat.toFixed(7), lng: +g.lng.toFixed(7), at: new Date().toISOString() };
    save();
    $gpsText.textContent = gpsText(p.gps);
    $gpsWarn.textContent = gpsWarning(p.gps);
    $view.querySelector("#fineTune").disabled = false;
  };
  // Started right inside the tap, so iOS shows its permission prompt; a second tap stops early and saves.
  $view.querySelector("#locate").onclick = (e) => {
    const btn = e.currentTarget;
    if (gpsCapture) { gpsCapture.stop(); return; }
    btn.textContent = "■ Stop & save";
    $gpsWarn.textContent = "";
    gpsCapture = startGpsCapture({
      onProgress: ({ readings, best }) => {
        $gpsText.textContent = readings ? `Averaging… ${readings} reading${readings === 1 ? "" : "s"}, best ±${Math.round(best)} m`
          : "Waiting for a GPS fix (up to 60 s; slower offline)…";
      },
    });
    gpsCapture.done
      .then((r) => setGps({ lat: r.lat, lng: r.lng, acc: Math.round(r.acc), n: r.n, weak: r.weak, source: "gps" }))
      .catch((err) => { $gpsText.textContent = p.gps ? gpsText(p.gps) : ""; $gpsWarn.textContent = err.message; })
      .finally(() => { gpsCapture = null; btn.textContent = `📍 ${p.gps ? "Re-record GPS" : "Record GPS location"}`; });
  };
  $view.querySelector("#manualToggle").onclick = (e) => {
    const $f = $view.querySelector("#manual");
    $f.hidden = !$f.hidden;
    e.currentTarget.setAttribute("aria-expanded", String(!$f.hidden));
    if (!$f.hidden) $view.querySelector("#manualCoords").focus();
  };
  $view.querySelector("#manual").onsubmit = (ev) => {
    ev.preventDefault();
    const c = parseCoords($view.querySelector("#manualCoords").value);
    if (!c) { $gpsWarn.textContent = "Couldn't read that. Enter latitude, longitude, e.g. 39.10790, -77.55640 or 39.1079 N 77.5564 W."; return; }
    setGps({ ...c, acc: null, source: "manual" });
    $view.querySelector("#manual").hidden = true;
  };
  $view.querySelector("#fineTune").onclick = () => { location.hash = `#map/${p.uid}`; };
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
    deletePhotos(p.photos || []).catch(() => {});
    state.plants = state.plants.filter((x) => x.uid !== id);
    for (const m of [state.overrides, state.counts]) for (const k of Object.keys(m)) if (k.startsWith(`${id}:`)) delete m[k];
    for (const k of Object.keys(state.programs.targets || {})) state.programs.targets[k] = state.programs.targets[k].filter((u) => u !== id);
    save();
    location.hash = "#plan";
  };
}

// ---------- Plan ----------

/** Stop flags stay in view; cautions and info fold into a one-line "⚠ 2 · ⓘ 1 notes" toggle. */
function flagsCompact(flags, id) {
  const stops = flags.filter((f) => f.level === "stop");
  const rest = flags.filter((f) => f.level !== "stop");
  const nCaution = rest.filter((f) => f.level === "caution").length, nInfo = rest.length - nCaution;
  const label = [nCaution && `<span class="warn">⚠ ${nCaution}</span>`, nInfo && `<span class="fits">ⓘ ${nInfo}</span>`].filter(Boolean).join(" · ");
  return flagsHtml(stops) + (rest.length ? `<details class="notes" ${sec(id)}><summary>${label} ${rest.length === 1 ? "note" : "notes"}</summary>${flagsHtml(rest)}</details>` : "");
}

/** In-stock product names that supply a chemical option (none for Soil Care programs). */
const stockedProducts = (plantUid, o) => o.chemical && !o.unavailable && products.length && plantUid !== PROGRAM_UID
  ? [...new Set(productsFor(o.treatment, products, unavailableProducts).map((p) => p.name.split("_")[0].trim()))] : [];

function optionHtml(plantUid, o, selected) {
  const t = o.treatment, s = t.schedule;
  const key = selKey(plantUid, t.id);
  const stocked = stockedProducts(plantUid, o);
  const count = !s ? ""
    : s.visitsMin === s.visitsMax ? `${s.visitsMin}×`
    : `<select data-n="${key}" aria-label="Applications per year">${Array.from({ length: s.visitsMax - s.visitsMin + 1 }, (_, i) => s.visitsMin + i)
        .map((n) => `<option ${n === chosenCount(s, state.counts[key]) ? "selected" : ""}>${n}</option>`).join("")}</select>×`;
  const meta = [
    esc(o.type.name),
    o.chemical && o.preferred ? `<span class="okText">Preferred</span>` : "",
    count,
    t.oneOff ? `One-time · ${plural(t.quantity ?? 1, "sample")}` : t.months?.length ? describeMonths(t.months) : "",
  ].filter(Boolean).join(" · ");
  const others = o.flags.filter((f) => f.level !== "stop");
  const detail = [
    stocked.length ? `<div><b>Products:</b> ${esc(stocked.join(", "))}</div>` : "",
    s ? `<div><b>Applications:</b> ${describeVisits(s)} per year${s.interval ? `, ${esc(s.interval)}` : ""}</div>
      <div><b>Repeat:</b> ${esc(s.repeat)}</div><div><b>Window:</b> ${esc(s.window)}</div>` : "",
    t.protection ? `<div><b>Protection:</b> ${esc(t.protection)}</div>` : "",
    (t.notes || []).length ? `<ul>${t.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : "",
    t.purpose ? `<div class="muted">${esc(t.purpose)}</div>` : "",
    flagsHtml(others),
  ].join("");
  const marks = [others.some((f) => f.level === "caution") && `<span class="warn">⚠</span>`, stocked.length && `${stocked.length} product${stocked.length === 1 ? "" : "s"}`].filter(Boolean).join(" ");
  return `
    <div class="opt ${o.notAdvised ? "notAdvised" : ""} ${o.unavailable ? "unavailable" : ""}">
      <input type="checkbox" id="cb-${key}" data-k="${key}" ${selected.has(key) ? "checked" : ""} ${o.unavailable ? "disabled" : ""}>
      <div class="body">
        <label class="title" for="cb-${key}">${esc(t.title)}</label>
        <div class="small muted">${meta}</div>
        ${o.notAdvised ? `<div class="small status-notAdvised">Not advised under current conditions</div>` : ""}
        ${o.unavailable ? `<div class="small status-outOfWindow">No product in stock</div>` : ""}
        ${flagsHtml(o.flags.filter((f) => f.level === "stop"))}
        ${detail ? `<details class="more" ${sec(`d:${key}`)}><summary>Details${marks ? ` · ${marks}` : ""}</summary><div class="small">${detail}</div></details>` : ""}
      </div>
    </div>`;
}

const hasPlan = () => state.plants.some((p) => p.conditionIds.length) || SITE_PROGRAMS.some((p) => state.programs[p.key]);

function renderResult() {
  const plants = state.plants.filter((p) => p.conditionIds.length);
  if (!hasPlan()) { location.hash = "#plan"; return; }
  setHeader("Treatment Plan", `<a href="#plan">Edit</a>`);
  const entries = planLandscape(kb, state.site, plants);
  const programEntry = siteProgramEntry(kb, state.programs, state.plants.map((p) => ({ plant: p, host: kb.hostById[p.hostId] })));
  if (programEntry) entries.push(programEntry);
  applyProductAvailability(entries);
  const selected = selectionFor(entries);
  const cal = landscapeCalendar(entries, selected);
  const tot = applicationTotals(entries, selected);
  const vp = visitPlan(entries, selected, state.counts);
  const job = [state.siteLabel || "Unnamed prospect", state.leadNumber && `Lead #${state.leadNumber}`, state.inspectionDate].filter(Boolean).map(esc).join(" · ");
  const stats = [
    vp.visits.length && `<b>${vp.visits.length}</b> visit${vp.visits.length === 1 ? "" : "s"}/yr`,
    vp.applications && `<b>${vp.applications}</b> application${vp.applications === 1 ? "" : "s"}`,
    vp.asap.length + vp.anytime.length && `<b>${vp.asap.length + vp.anytime.length}</b> one-time`,
  ].filter(Boolean).join(" · ");

  const problemHtml = (e, p) => {
    const chem = p.options.filter((o) => o.chemical);
    const byT = new Map(chem.map((o) => [o.treatment, o]));
    const ranked = rankTreatments(chem.map((o) => o.treatment), (t) => !byT.get(t).notAdvised && !byT.get(t).unavailable);
    const [rec, alt] = [ranked.recommended, ranked.alternatives].map((ts) => ts.map((t) => byT.get(t)));
    const cult = p.options.filter((o) => !o.chemical && !o.treatment.oneOff);
    const once = p.options.filter((o) => o.treatment.oneOff);
    const id = `${e.plant.uid}:${p.condition.id}`;
    const altOpen = alt.some((o) => selected.has(selKey(e.plant.uid, o.treatment.id)));
    const opts = (list) => list.map((o) => optionHtml(e.plant.uid, o, selected)).join("");
    return `
      <h4>${esc(p.condition.name)}</h4>
      ${flagsCompact(p.flags, `n:${id}`)}
      ${opts(rec)}
      ${alt.length ? `<details class="alts" ${sec(`a:${id}`, altOpen)}><summary>Alternatives (${alt.length})</summary>${opts(alt)}</details>` : ""}
      ${once.length ? `<div class="group">One-time</div>${opts(once)}` : ""}
      ${cult.length ? `<details class="alts" ${sec(`c:${id}`, cult.some((o) => selected.has(selKey(e.plant.uid, o.treatment.id))))}><summary>Cultural (${cult.length})</summary>${opts(cult)}</details>` : ""}`;
  };
  const plantHtml = (e) => {
    const keys = e.problems.flatMap((p) => p.options.map((o) => selKey(e.plant.uid, o.treatment.id)));
    const n = keys.filter((k) => selected.has(k)).length;
    const stop = e.problems.some((p) => p.flags.some((f) => f.level === "stop") || p.options.some((o) => o.notAdvised && selected.has(selKey(e.plant.uid, o.treatment.id))));
    const names = e.problems.map((p) => p.condition.name).join(", ");
    return `<details class="plant" ${sec(`p:${e.plant.uid}`)}>
      <summary><span class="name">${stop ? `<span class="status-notAdvised">⛔</span> ` : ""}${esc(plantName(e))}</span>
        <span class="small muted">${n ? `${n} selected` : `<span class="status-outOfWindow">none selected</span>`} · ${esc(names)}</span></summary>
      ${e.problems.map((p) => problemHtml(e, p)).join("")}
    </details>`;
  };
  const visitItem = (it) => `<li>${esc(it.plant)}: ${esc(it.option.treatment.title)} <span class="muted">(${esc(it.problem)}${it.of > 1 ? `, ${it.n} of ${it.of}` : ""})</span>${it.alsoFits.length
    ? `<br><span class="fits">${esc(alsoFitsText(it))} · <a data-jump="calendar">calendar ↓</a></span>` : ""}</li>`;

  $view.innerHTML = `
    <div class="jobline small muted">${job}<br>${esc(state.site.address || "No work address")} · ${state.site.jurisdiction}</div>
    ${stats ? `<div class="stats">${stats} <a data-jump="visits">visits ↓</a></div>` : ""}

    <h2>Treatments <span class="hint">tap a plant to review</span></h2>
    ${entries.map(plantHtml).join("")}

    ${vp.visits.length || vp.asap.length || vp.anytime.length ? `<h2 id="visits">Visits</h2>
      ${numberedVisits(vp).map(({ kind, n, visit: v, item: a }) => kind === "program" ? `<details class="visit" ${sec(`v:${n}`)}>
        <summary><span class="name">Visit ${n} · ${slotName(v.slot)}</span>
          <span class="small muted">${plural(v.items.length, "application")}${v.from !== v.to ? ` · flexible ${esc(describeVisitWindow(v))}` : ""}${v.items.some((it) => it.alsoFits.length) ? ` · <span class="fits">⇄</span>` : ""}</span></summary>
        <ul class="small">${v.items.map(visitItem).join("")}</ul>
      </details>` : `<details class="visit" ${sec(`o:${n}`)}>
        <summary><span class="name">Visit ${n} · ${kind === "asap" ? "ASAP" : "One-time"}</span><span class="small ${kind === "asap" ? "status-outOfWindow" : "muted"}">${kind === "asap" ? "before program visits begin" : "no set timing"}</span></summary>
        <ul class="small"><li>${esc(a.plant)}: ${esc(anytimeLabel(a.option))} <span class="muted">(${esc(a.problem)})</span></li></ul>
        <div class="small muted">${kind === "asap" ? `${ASAP_TEXT}.` : "Schedule in SingleOps at the arborist's discretion."}</div>
      </details>`).join("")}
      ${vp.compressed.map((c) => `<div class="flag caution">${esc(c.plant)}: ${esc(c.option.treatment.title)} does not fit its window at the stated spacing; scheduled as early as possible.</div>`).join("")}
      <details class="notes" ${sec("legend")}><summary>How visits are built</summary><ul class="small muted">
        <li>Checked chemical programs at their chosen number of applications (default is the minimum), combined into the fewest visits that respect each window and spacing.</li>
        <li><b>Flexible</b> = dates that still work for every application on that visit.</li>
        <li><span class="fits">⇄</span> = the window covers more than one visit. It goes on the visit with fewer applications (coin flip on a tie). To move it, check its window in the <a data-jump="calendar">annual calendar</a>.</li>
        ${tot.programs ? `<li>${plural(tot.programs, "treatment program")}; ${tot.min === tot.max ? tot.min : `${tot.min}–${tot.max}`} applications across the reference ranges.</li>` : ""}
      </ul></details>` : ""}

    ${cal.length ? `<details class="section" id="calendar" ${sec("cal")}><summary>Annual calendar <span class="hint">${plural(cal.length, "month")}</span></summary>
      ${cal.map((c) => `<div class="row" style="align-items:flex-start"><b style="width:42px;flex:none">${monthName(c.month)}</b>
        <div class="small">${c.items.map((i) => `${esc(i.plant)}: ${esc(i.option.treatment.title)} <span class="muted">(${esc(i.problem)})</span>`).join("<br>")}</div></div>`).join("")}
    </details>` : ""}

    <button class="primary" id="pdf">Export PDF report</button>
    <button class="secondary" id="zip">Export folder (.zip): report + photos</button>
    <button class="secondary" id="share">Share / copy plan text</button>
    ${products.length ? `<button class="secondary" id="editProducts" aria-expanded="${productsPanelOpen}">Edit available products</button>
      ${productsPanelOpen ? productsPanelHtml() : ""}` : ""}
    <details class="notes" ${sec("disc")}><summary>Disclaimer</summary><div class="small muted">${esc(kb.meta.disclaimer)}</div></details>`;

  $view.querySelectorAll("details[data-sec]").forEach((d) => d.ontoggle = () => openSecs.set(d.dataset.sec, d.open));

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
  $view.querySelectorAll("[data-jump]").forEach((a) => a.onclick = () => {
    const el = $view.querySelector(`#${a.dataset.jump}`);
    if (!el) return;
    if (el.tagName === "DETAILS") el.open = true;
    el.scrollIntoView({ behavior: "smooth" });
  });
  $view.querySelector("#pdf").onclick = (ev) => exportReport(ev.currentTarget, entries, selected);
  $view.querySelector("#zip").onclick = (ev) => exportReport(ev.currentTarget, entries, selected, { zip: true });
  $view.querySelector("#share").onclick = () => sharePlan(exportText(kb, state.site, entries, selected, state.siteLabel, state.counts, { inspectionDate: state.inspectionDate, leadNumber: state.leadNumber }));
}

// The PDF library (~450 KB) loads on first export, not at startup; the service worker keeps it for offline use.
const loadScript = (src) => new Promise((resolve, reject) => {
  const el = Object.assign(document.createElement("script"), { src, onload: resolve, onerror: () => reject(new Error(`Could not load ${src}`)) });
  document.head.append(el);
});
async function pdfLibrary() {
  if (!window.jspdf) await loadScript("vendor/jspdf.umd.min.js");
  if (!window.autoTable) await loadScript("vendor/jspdf.plugin.autotable.min.js");
  return { jsPDF: window.jspdf.jsPDF, autoTable: window.autoTable };
}

/** Share sheet on a phone (Files, Mail, AirDrop), a download elsewhere. */
async function deliverFile(blob, name, type) {
  const file = new File([blob], name, { type });
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); } catch (e) { if (e.name !== "AbortError") throw e; }
    return;
  }
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  toast(`Saved ${name}`);
}

/**
 * Builds the landscape's PDF report and delivers it alone, or with zip: true, as a zipped folder holding the
 * PDF and every photo as a JPEG named by its report caption.
 */
async function exportReport(button, entries, selected, { zip = false } = {}) {
  const label = button.textContent;
  button.disabled = true; button.textContent = "Building PDF…";
  try {
    const { jsPDF, autoTable } = await pdfLibrary();
    const data = reportData(kb, {
      site: state.site, plants: state.plants, entries, selected, counts: state.counts, productsOf: stockedProducts,
      job: { clientName: state.siteLabel, leadNumber: state.leadNumber, inspectionDate: state.inspectionDate },
    });
    button.textContent = data.mapPoints.length ? "Building site map…" : "Building PDF…";
    const siteMap = await drawSiteMap(data.mapPoints);
    const photos = {};
    for (const g of data.photoGroups) for (const id of g.photoIds) photos[id] = await photoForPdf(id).catch(() => null);
    const pdf = renderReport(jsPDF, autoTable, data, { siteMap, photos });
    if (!zip) { await deliverFile(pdf.output("blob"), data.filename, "application/pdf"); return; }
    button.textContent = "Zipping…";
    const layout = exportFiles(data);
    const text = (s) => new TextEncoder().encode(s);
    const files = [
      { name: layout.pdfPath, data: new Uint8Array(pdf.output("arraybuffer")) },
      ...(siteMap ? [{ name: layout.mapPath, data: Uint8Array.from(atob(siteMap.dataUrl.split(",")[1]), (c) => c.charCodeAt(0)) }] : []),
      { name: layout.geojsonPath, data: text(data.coordinates.geojson) },
      { name: layout.csvPath, data: text(data.coordinates.csv) },
    ];
    for (const ph of layout.photos) {
      const blob = await getPhoto(ph.id).catch(() => null);
      if (blob) files.push({ name: ph.path, data: new Uint8Array(await blob.arrayBuffer()) });
    }
    await deliverFile(new Blob([makeZip(files)], { type: "application/zip" }), layout.zipName, "application/zip");
  } catch (e) {
    toast(`Export failed: ${e.message}`);
  } finally {
    button.disabled = false; button.textContent = label;
  }
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

/** Installed version, from the offline cache name ("phc-planner-v19" -> "v19"); "" before install. */
async function appVersion() {
  try { return (await caches.keys()).find((k) => k.startsWith("phc-planner-"))?.replace("phc-planner-", "") || ""; } catch { return ""; }
}

let updateRequested = false;

/**
 * Header "Update" button: asks the server for a newer version. A newer one installs, takes over and the page
 * reloads into it (plans are saved on the device, so nothing is lost); otherwise reports the current version.
 */
async function updateApp() {
  const $b = document.getElementById("update");
  const reset = () => { $b.disabled = false; $b.textContent = "↻ Update"; };
  if (!navigator.onLine) { toast("Offline: connect to the internet to update"); return; }
  const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
  if (!reg) { location.reload(); return; }
  $b.disabled = true; $b.textContent = "Checking…";
  try {
    await reg.update();
  } catch {
    toast("Could not reach the server. Try again.");
    reset();
    return;
  }
  const next = reg.installing || reg.waiting;
  if (!next) { const v = await appVersion(); toast(`Up to date${v ? ` (${v})` : ""}`); reset(); return; }
  updateRequested = true;
  $b.textContent = "Updating…";
  next.addEventListener("statechange", () => { if (next.state === "redundant") { toast("Update failed. Try again."); updateRequested = false; reset(); } });
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
  else Promise.all([navigator.serviceWorker.getRegistration(), appVersion()]).then(([r, v]) => {
    $st.textContent = (r?.active ? "Offline copy installed. Add to Home Screen to keep it available without a connection." : "Offline copy not installed yet. Reload once while online.")
      + (v ? ` App version ${v}: tap ↻ Update at the top to get the latest.` : "");
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

// ---------- Fine-tune on map ----------

let closeMap = null;

/**
 * Full-screen satellite map with a fixed centre crosshair: the user drags or pinches the imagery until the tree
 * sits under the crosshair, then saves (source "map"). Other located trees show as numbered pins.
 */
function renderMap(id) {
  const p = plantByUid(id);
  if (!p) { location.hash = "#plan"; return; }
  const n = state.plants.indexOf(p) + 1;
  const others = state.plants.map((x, i) => x !== p && x.gps && { lat: x.gps.lat, lng: x.gps.lng, n: i + 1, label: kb.hostById[x.hostId]?.name || "" }).filter(Boolean);
  const avg = (k) => others.reduce((s, o) => s + o[k], 0) / others.length;
  const start = p.gps || (others.length ? { lat: avg("lat"), lng: avg("lng") } : null);
  if (!start) { location.hash = `#plant/${id}`; return; }
  const ring = p.gps?.source === "gps" ? p.gps : null;
  const overlay = document.createElement("div");
  overlay.className = "mapScreen";
  overlay.innerHTML = `
    <canvas aria-label="Satellite map: drag or pinch to put the tree under the crosshair"></canvas>
    <div class="crosshair" aria-hidden="true"></div>
    <div class="mapTop"><button id="mapCancel">Cancel</button><b>${n}. ${esc(kb.hostById[p.hostId]?.name || "")}</b><button id="mapSave" class="save">Save</button></div>
    <div class="mapHint">Drag the map to put the tree under the crosshair</div>
    <div class="mapOffline" hidden>No satellite imagery: you're offline or the imagery service didn't respond. Fine-tune later when you're back in signal.</div>
    <div class="mapZoom"><button id="zoomIn" aria-label="Zoom in">+</button><button id="zoomOut" aria-label="Zoom out">−</button></div>
    ${ring ? `<button class="mapGps" id="mapGps">◎ Back to GPS</button>` : ""}
    <div class="mapCredit">${esc(ATTRIBUTION)}</div>`;
  document.body.append(overlay);
  document.body.classList.add("mapOpen");
  setHeader("Fine-tune on map");
  $view.innerHTML = "";
  const $offline = overlay.querySelector(".mapOffline");
  const map = fineTuneMap(overlay.querySelector("canvas"), {
    start, zoom: 20, gps: ring, pins: others,
    onTiles: ({ loaded, failed }) => { $offline.hidden = !(failed && !loaded); },
  });
  closeMap = () => { map.destroy(); overlay.remove(); document.body.classList.remove("mapOpen"); closeMap = null; };
  overlay.querySelector("#mapCancel").onclick = () => { location.hash = `#plant/${id}`; };
  overlay.querySelector("#mapSave").onclick = () => {
    const c = map.center();
    p.gps = { lat: +c.lat.toFixed(7), lng: +c.lng.toFixed(7), acc: null, source: "map", at: new Date().toISOString(),
      ...(ring && { gpsAcc: ring.acc }) };
    save();
    toast("Position saved from map");
    location.hash = `#plant/${id}`;
  };
  overlay.querySelector("#zoomIn").onclick = () => map.zoomBy(1);
  overlay.querySelector("#zoomOut").onclick = () => map.zoomBy(-1);
  overlay.querySelector("#mapGps")?.addEventListener("click", () => map.backToGps());
}

function route() {
  const [name, arg] = (location.hash || "#plan").slice(1).split("/");
  gpsCapture?.stop();
  closeMap?.();
  const tab = { plan: "plan", add: "plan", plant: "plan", map: "plan", result: "plan", library: "library", condition: "library", reference: "reference", ops: "reference" }[name] || "plan";
  document.querySelectorAll("nav.tabs a").forEach((a) => a.classList.toggle("on", a.dataset.tab === tab));
  ({
    add: renderAddPlant, plant: () => renderPlant(arg), map: () => renderMap(arg), result: renderResult,
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
  document.getElementById("update").onclick = updateApp;
  window.addEventListener("hashchange", route);
  route();
  if ("serviceWorker" in navigator) {
    // When an updated version takes over, reload once so the new files are shown (skipped on first install).
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController || updateRequested) location.reload(); });
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

start();
