import {
  MITIGATIONS, describeMonths, describeVisits, indexKb, problemsForHost, matchesQuery, mitigationOf,
  planLandscape, defaultSelection, landscapeCalendar, applicationTotals, exportText, selKey, plantName, monthName,
  visitPlan, slotName, describeVisitWindow,
} from "./engine.js";

const $view = document.getElementById("view");
const $title = document.getElementById("title");
const $actions = document.getElementById("actions");
const STORE_KEY = "phc-landscape-v1";

let kb;
let state = loadState();

function defaultState() {
  return {
    siteLabel: "",
    site: { jurisdiction: "VA", nearWater: false, sensitiveSite: false, publicProperty: false },
    plants: [],
    /** selKey -> true/false where the user changed the default selection. */
    overrides: {},
  };
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && Array.isArray(s.plants)) return { ...defaultState(), ...s, site: { ...defaultState().site, ...s.site } };
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
      if (key in state.overrides ? state.overrides[key] : defaults.has(o.treatment.id)) sel.add(key);
    }
  }
  return sel;
}

// ---------- Landscape ----------

function renderLandscape() {
  const s = state.site;
  setHeader("Landscape");
  const checkbox = (key, label) =>
    `<label class="row"><span>${label}</span><input type="checkbox" data-site="${key}" ${s[key] ? "checked" : ""}></label>`;
  $view.innerHTML = `
    <h2>Site</h2>
    <div class="row"><input type="text" id="siteLabel" placeholder="Client / property (optional)" value="${esc(state.siteLabel)}" style="flex:1"></div>
    <div class="row"><span>Jurisdiction</span><div class="seg" style="flex:1">
      ${["VA", "MD", "DC"].map((j) => `<button data-j="${j}" class="${s.jurisdiction === j ? "on" : ""}">${j}</button>`).join("")}
    </div></div>
    ${checkbox("nearWater", "Near water / Bay buffer")}
    ${checkbox("sensitiveSite", "School, daycare, or park")}
    ${checkbox("publicProperty", "Public property")}

    <h2>Plants (${state.plants.length})</h2>
    ${state.plants.map((p) => `
      <a class="item" href="#plant/${p.uid}">
        <b>${esc(plantName({ plant: p, host: kb.hostById[p.hostId] }))}</b><br>
        <span class="small ${p.conditionIds.length ? "muted" : "status-outOfWindow"}">${p.conditionIds.length
          ? esc(p.conditionIds.map((id) => kb.conditionById[id]?.name).filter(Boolean).join(", "))
          : "No problems selected"}</span>
      </a>`).join("") || `<p class="small muted">Add each tree or ornamental in the landscape, then choose its problems.</p>`}
    <a class="primary" href="#add">+ Add plant</a>

    <button class="primary" id="build" ${state.plants.some((p) => p.conditionIds.length) ? "" : "disabled"}>Build treatment plan</button>
    <button class="link" id="clear">Start new landscape</button>`;

  $view.querySelector("#siteLabel").oninput = (e) => { state.siteLabel = e.target.value; save(); };
  $view.querySelectorAll("[data-j]").forEach((b) => b.onclick = () => { s.jurisdiction = b.dataset.j; save(); renderLandscape(); });
  $view.querySelectorAll("[data-site]").forEach((c) => c.onchange = () => { s[c.dataset.site] = c.checked; save(); });
  $view.querySelector("#build").onclick = () => { location.hash = "#result"; };
  $view.querySelector("#clear").onclick = () => {
    if (state.plants.length && !$view.querySelector("#clear").dataset.armed) {
      const b = $view.querySelector("#clear");
      b.dataset.armed = "1"; b.textContent = "Tap again to clear all plants";
      return;
    }
    const keep = state.site.jurisdiction;
    state = defaultState();
    state.site.jurisdiction = keep;
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
    for (const k of Object.keys(state.overrides)) if (k.startsWith(`${id}:`)) delete state.overrides[k];
    save();
    location.hash = "#plan";
  };
}

// ---------- Plan ----------

function optionHtml(plantUid, o, selected) {
  const t = o.treatment, s = t.schedule;
  const key = selKey(plantUid, t.id);
  return `
    <label class="opt ${o.notAdvised ? "notAdvised" : ""}">
      <input type="checkbox" data-k="${key}" ${selected.has(key) ? "checked" : ""}>
      <div>
        <div class="title">${esc(t.title)}</div>
        <div class="small"><span class="chip">${esc(o.type.name)}</span>
          ${o.chemical ? (o.preferred ? ` <span class="chip pref">Preferred</span>` : ` <span class="chip">Alternative</span>`) : ""}</div>
        ${o.notAdvised ? `<div class="small status-notAdvised">Not advised under current conditions</div>` : ""}
        ${s ? `
          <div class="small"><b>Applications:</b> ${describeVisits(s)}${s.interval ? `, ${esc(s.interval)}` : ""}</div>
          <div class="small"><b>Repeat:</b> ${esc(s.repeat)}</div>
          <div class="small"><b>Window:</b> ${esc(s.window)}</div>`
        : t.months?.length ? `<div class="small"><b>When:</b> ${describeMonths(t.months)}</div>` : ""}
        ${t.protection ? `<div class="small"><b>Protection:</b> ${esc(t.protection)}</div>` : ""}
        ${(t.notes || []).length ? `<ul class="small">${t.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
        <div class="small muted">${esc(t.purpose)}</div>
        ${flagsHtml(o.flags)}
      </div>
    </label>`;
}

function renderResult() {
  const plants = state.plants.filter((p) => p.conditionIds.length);
  if (!plants.length) { location.hash = "#plan"; return; }
  setHeader("Treatment Plan", `<a href="#plan">Edit</a>`);
  const entries = planLandscape(kb, state.site, plants);
  const selected = selectionFor(entries);
  const cal = landscapeCalendar(entries, selected);
  const tot = applicationTotals(entries, selected);
  const vp = visitPlan(entries, selected);

  $view.innerHTML = `
    <p class="small muted">${esc(state.siteLabel || "Unnamed site")} · ${state.site.jurisdiction} · ${plants.length} plant entr${plants.length === 1 ? "y" : "ies"}</p>
    ${tot.programs ? `<div class="banner"><b>${vp.visits.length}</b> site visit${vp.visits.length === 1 ? "" : "s"}/year
      covering <b>${vp.applications}</b> applications from ${tot.programs} chemical program${tot.programs === 1 ? "" : "s"}
      (${tot.min === tot.max ? tot.min : `${tot.min}–${tot.max}`} applications if each program is run at its full count) ·
      <a id="jump" style="cursor:pointer;text-decoration:underline">see visit framework</a></div>` : ""}
    ${entries.map((e) => `
      <h3 class="plant">${esc(plantName(e))}</h3>
      ${e.problems.map((p) => {
        const chem = p.options.filter((o) => o.chemical).sort((a, b) => !!b.treatment.default - !!a.treatment.default || b.preferred - a.preferred);
        const cult = p.options.filter((o) => !o.chemical);
        return `
          <h4>${esc(p.condition.name)}</h4>
          ${flagsHtml(p.flags)}
          ${chem.length ? `<div class="group">Chemical</div>${chem.map((o) => optionHtml(e.plant.uid, o, selected)).join("")}` : ""}
          ${cult.length ? `<div class="group">Cultural</div>${cult.map((o) => optionHtml(e.plant.uid, o, selected)).join("")}` : ""}`;
      }).join("")}`).join("")}
    ${vp.visits.length ? `<h2 id="visits">Visit framework: minimum site visits</h2>
      <p class="small muted">Checked chemical programs at their minimum application count, combined into the fewest visits that respect each window and interval. Flexible range = dates that still work for every application on the visit.</p>
      ${vp.visits.map((v, i) => `<div class="row" style="display:block">
        <div class="title">Visit ${i + 1}: ${slotName(v.slot)} <span class="small muted">${v.from !== v.to ? `flexible ${esc(describeVisitWindow(v))}` : ""}</span></div>
        <div class="small">${v.items.map((it) => `${esc(it.plant)}: ${esc(it.option.treatment.title)} <span class="muted">(${esc(it.problem)}${it.of > 1 ? `, ${it.n} of ${it.of}` : ""})</span>`).join("<br>")}</div>
      </div>`).join("")}
      ${vp.compressed.map((c) => `<div class="flag caution">${esc(c.plant)}: ${esc(c.option.treatment.title)} does not fit its window at the stated spacing; scheduled as early as possible.</div>`).join("")}` : ""}
    ${cal.length ? `<h2>Annual calendar: application windows (checked items)</h2>
      ${cal.map((c) => `<div class="row" style="align-items:flex-start"><b style="width:42px;flex:none">${monthName(c.month)}</b>
        <div class="small">${c.items.map((i) => `${esc(i.plant)}: ${esc(i.option.treatment.title)} <span class="muted">(${esc(i.problem)})</span>`).join("<br>")}</div></div>`).join("")}` : ""}
    <button class="primary" id="share">Share / copy plan text</button>
    <div class="banner">${esc(kb.meta.disclaimer)}</div>`;

  $view.querySelectorAll("[data-k]").forEach((cb) => cb.onchange = () => {
    state.overrides[cb.dataset.k] = cb.checked;
    save();
    const y = window.scrollY;
    renderResult();
    window.scrollTo(0, y);
  });
  $view.querySelector("#jump")?.addEventListener("click", () => $view.querySelector("#visits").scrollIntoView({ behavior: "smooth" }));
  $view.querySelector("#share").onclick = () => sharePlan(exportText(kb, state.site, entries, selected, state.siteLabel));
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
      return ts.length ? `<h2>${label}</h2>` + ts.map((t) => {
        const s = t.schedule;
        return `<div class="row" style="display:block">
          <div class="title">${esc(t.title)}</div>
          <div class="small"><span class="chip">${esc(kb.typeById[t.applicationType].name)}</span>${t.preferred ? ` <span class="chip pref">Preferred</span>` : ""}</div>
          ${s ? `<div class="small">${describeVisits(s)}${s.interval ? `, ${esc(s.interval)}` : ""} · ${esc(s.repeat)}<br>Window: ${esc(s.window)}</div>`
            : `<div class="small">${describeMonths(t.months)}</div>`}
          <div class="small muted">${esc(t.purpose)}</div>
          ${(t.notes || []).length ? `<ul class="small">${t.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
        </div>`;
      }).join("") : "";
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

// ---------- Routing ----------

function route() {
  const [name, arg] = (location.hash || "#plan").slice(1).split("/");
  const tab = { plan: "plan", add: "plan", plant: "plan", result: "plan", library: "library", condition: "library", reference: "reference" }[name] || "plan";
  document.querySelectorAll("nav.tabs a").forEach((a) => a.classList.toggle("on", a.dataset.tab === tab));
  ({
    add: renderAddPlant, plant: () => renderPlant(arg), result: renderResult,
    library: renderLibrary, condition: () => renderCondition(arg), reference: renderReference,
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
