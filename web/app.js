import {
  MITIGATIONS, monthName, describeMonths, indexKb, conditionsForHost, matchesQuery,
  planCondition, schedule, exportText, mitigationOf,
} from "./engine.js";

const $view = document.getElementById("view");
const $title = document.getElementById("title");
const $actions = document.getElementById("actions");
const STORE_KEY = "phc-plan-v1";

let kb;
let state = loadState();

function defaultState() {
  return {
    siteLabel: "", hostId: "", conditionIds: [], selected: [],
    site: { jurisdiction: "VA", month: new Date().getMonth() + 1, dbh: "", crownLoss: "",
            nearWater: false, sensitiveSite: false, publicProperty: false, inBloom: false },
  };
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && s.site) return { ...defaultState(), ...s, site: { ...defaultState().site, ...s.site } };
  } catch {}
  return defaultState();
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));

function siteForEngine() {
  const s = state.site;
  const loss = num(s.crownLoss);
  return { ...s, dbh: num(s.dbh), crownLoss: loss == null ? null : Math.min(Math.max(loss, 0), 100) };
}

function toggleCondition(id) {
  const c = kb.conditionById[id];
  const tids = c.treatments.map((t) => t.id);
  if (state.conditionIds.includes(id)) {
    state.conditionIds = state.conditionIds.filter((x) => x !== id);
    state.selected = state.selected.filter((x) => !tids.includes(x));
  } else {
    state.conditionIds.push(id);
    state.selected.push(...tids.filter((t) => !state.selected.includes(t)));
  }
  save();
}

function flagsHtml(flags) {
  return flags.map((f) => `<div class="flag ${f.level}">${esc(f.text)}</div>`).join("");
}

function setHeader(title, actionsHtml = "") {
  $title.textContent = title;
  $actions.innerHTML = actionsHtml;
}

// ---------- Plan builder ----------

function renderPlan() {
  const s = state.site;
  setHeader("Treatment Plan");
  const checkbox = (key, label) =>
    `<label class="row"><span>${label}</span><input type="checkbox" data-site="${key}" ${s[key] ? "checked" : ""}></label>`;
  $view.innerHTML = `
    <h2>Site</h2>
    <div class="row"><input type="text" id="siteLabel" placeholder="Site / client / tree ID (optional)" value="${esc(state.siteLabel)}" style="flex:1"></div>
    <div class="row"><span>Jurisdiction</span><div class="seg" style="flex:1">
      ${["VA", "MD", "DC"].map((j) => `<button data-j="${j}" class="${s.jurisdiction === j ? "on" : ""}">${j}</button>`).join("")}
    </div></div>
    <label class="row"><span>Planned month</span><select id="month">
      ${[...Array(12)].map((_, i) => `<option value="${i + 1}" ${s.month === i + 1 ? "selected" : ""}>${monthName(i + 1)}</option>`).join("")}
    </select></label>
    <label class="row"><span>Host</span><select id="host">
      <option value="">Any</option>
      ${kb.hosts.map((h) => `<option value="${h.id}" ${state.hostId === h.id ? "selected" : ""}>${esc(h.name)}</option>`).join("")}
    </select></label>
    <label class="row"><span>DBH (in.)</span><input type="number" inputmode="decimal" min="0" id="dbh" value="${esc(s.dbh)}"></label>
    <label class="row"><span>Crown loss (%)</span><input type="number" inputmode="numeric" min="0" max="100" id="crownLoss" value="${esc(s.crownLoss)}"></label>
    ${checkbox("nearWater", "Near water / Bay buffer")}
    ${checkbox("sensitiveSite", "School, daycare, or park")}
    ${checkbox("publicProperty", "Public property")}
    ${checkbox("inBloom", "Host in bloom")}

    <h2>Problems (${state.conditionIds.length})</h2>
    ${state.conditionIds.map((id) => `<div class="row"><span>${esc(kb.conditionById[id].name)}</span>
        <button class="link" data-remove="${id}">Remove</button></div>`).join("")}
    <a class="item" href="#problems">Add / remove problems</a>

    <button class="primary" id="build" ${state.conditionIds.length ? "" : "disabled"}>Build treatment framework</button>
    <button class="link" id="clear">Clear plan</button>`;

  $view.querySelector("#siteLabel").oninput = (e) => { state.siteLabel = e.target.value; save(); };
  $view.querySelectorAll("[data-j]").forEach((b) => b.onclick = () => { s.jurisdiction = b.dataset.j; save(); renderPlan(); });
  $view.querySelector("#month").onchange = (e) => { s.month = Number(e.target.value); save(); };
  $view.querySelector("#host").onchange = (e) => { state.hostId = e.target.value; save(); };
  $view.querySelector("#dbh").oninput = (e) => { s.dbh = e.target.value; save(); };
  $view.querySelector("#crownLoss").oninput = (e) => { s.crownLoss = e.target.value; save(); };
  $view.querySelectorAll("[data-site]").forEach((c) => c.onchange = () => { s[c.dataset.site] = c.checked; save(); });
  $view.querySelectorAll("[data-remove]").forEach((b) => b.onclick = () => { toggleCondition(b.dataset.remove); renderPlan(); });
  $view.querySelector("#build").onclick = () => { location.hash = "#result"; };
  $view.querySelector("#clear").onclick = () => {
    const keep = { jurisdiction: s.jurisdiction, month: s.month };
    state = defaultState();
    Object.assign(state.site, keep);
    save(); renderPlan();
  };
}

function renderProblems() {
  const hostName = state.hostId ? kb.hostById[state.hostId].name : "All problems";
  setHeader(hostName, `<a href="#plan">Done</a>`);
  $view.innerHTML = `<input type="search" id="q" placeholder="Search name or symptom">
    ${state.hostId ? `<p class="small muted">Showing problems recorded for ${esc(hostName)}, then general problems. Set Host to “Any” on the Plan tab to see everything.</p>` : ""}
    <div id="list"></div>`;
  const $list = $view.querySelector("#list");
  const draw = (q) => {
    const list = conditionsForHost(kb, state.hostId).filter((c) => matchesQuery(c, q));
    $list.innerHTML = list.map((c) => `
      <label class="row"><span>${esc(c.name)}<br><span class="small muted">${esc(kb.categoryById[c.category].name)}</span></span>
      <input type="checkbox" data-c="${c.id}" ${state.conditionIds.includes(c.id) ? "checked" : ""}></label>`).join("")
      || `<p class="muted">No matches.</p>`;
    $list.querySelectorAll("[data-c]").forEach((cb) => cb.onchange = () => toggleCondition(cb.dataset.c));
  };
  $view.querySelector("#q").oninput = (e) => draw(e.target.value);
  draw("");
}

// ---------- Result ----------

function currentPlans() {
  const site = siteForEngine();
  return state.conditionIds.map((id) => planCondition(kb, kb.conditionById[id], site));
}

function statusText(o) {
  const window = describeMonths(o.treatment.months);
  if (o.status === "inWindow") return `In window (${window})`;
  if (o.status === "outOfWindow") return `Out of window: next ${monthName(o.nextWindow)} (${window})`;
  return "Not advised under current conditions";
}

function renderResult() {
  if (!state.conditionIds.length) { location.hash = "#plan"; return; }
  setHeader("Framework", `<a href="#plan">Edit</a>`);
  const plans = currentPlans();
  const selected = new Set(state.selected);
  const s = state.site;
  const sched = schedule(plans, selected);

  $view.innerHTML = `
    <p class="small muted">${esc(state.siteLabel || "Unnamed site")} · ${s.jurisdiction} · ${monthName(s.month)}
      ${num(s.dbh) != null ? ` · DBH ${esc(s.dbh)} in.` : ""}${num(s.crownLoss) != null ? ` · crown loss ${esc(s.crownLoss)}%` : ""}</p>
    ${plans.map((p) => `
      <h3>${esc(p.condition.name)}</h3>
      ${flagsHtml(p.flags)}
      ${MITIGATIONS.map(([key, label]) => {
        const opts = p.options.filter((o) => o.mitigation === key);
        if (!opts.length) return "";
        return `<h4>${label}</h4>` + opts.map((o) => `
          <label class="opt ${o.status}">
            <input type="checkbox" data-t="${o.treatment.id}" ${selected.has(o.treatment.id) ? "checked" : ""}>
            <div>
              <div class="title">${esc(o.treatment.title)}</div>
              <div class="small"><span class="chip">${esc(o.type.name)}</span></div>
              <div class="small status-${o.status}">${statusText(o)}</div>
              ${o.treatment.frequency ? `<div class="small">${esc(o.treatment.frequency)}</div>` : ""}
              ${o.treatment.protection ? `<div class="small">Protection: ${esc(o.treatment.protection)}</div>` : ""}
              <div class="small muted">${esc(o.treatment.purpose)}</div>
              ${(o.treatment.notes || []).length ? `<ul class="small">${o.treatment.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
              ${flagsHtml(o.flags)}
            </div>
          </label>`).join("");
      }).join("")}`).join("")}
    ${sched.length ? `<h2>Annual schedule (checked options)</h2>
      ${sched.map((e) => `<div class="row" style="align-items:flex-start"><b style="width:42px">${monthName(e.month)}</b>
        <div class="small">${e.items.map(esc).join("<br>")}</div></div>`).join("")}` : ""}
    <button class="primary" id="share">Share / copy plan text</button>
    <div class="banner">${esc(kb.meta.disclaimer)}</div>`;

  $view.querySelectorAll("[data-t]").forEach((cb) => cb.onchange = () => {
    const id = cb.dataset.t;
    state.selected = cb.checked ? [...state.selected, id] : state.selected.filter((x) => x !== id);
    save();
    const y = window.scrollY;
    renderResult();
    window.scrollTo(0, y);
  });
  $view.querySelector("#share").onclick = () => sharePlan(plans);
}

async function sharePlan(plans) {
  const text = exportText(kb, plans, new Set(state.selected), siteForEngine(), state.siteLabel);
  if (navigator.share) {
    try { await navigator.share({ title: "PHC treatment framework", text }); return; } catch (e) { if (e.name === "AbortError") return; }
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
  const inPlan = state.conditionIds.includes(id);
  setHeader(c.name, `<a href="#library">Back</a>`);
  const list = (title, items) => items?.length ? `<h2>${title}</h2><ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
  const hosts = [...c.hostIds.map((h) => kb.hostById[h].name), ...(c.generalist ? ["many others"] : [])].join(", ");
  $view.innerHTML = `
    ${c.scientificName ? `<p><i>${esc(c.scientificName)}</i></p>` : ""}
    <p><b>Hosts:</b> ${esc(hosts || "Any")}${c.hostNote ? `<br><span class="small muted">${esc(c.hostNote)}</span>` : ""}</p>
    ${c.activeMonths?.length ? `<p><b>Active:</b> ${describeMonths(c.activeMonths)}${c.peakNote ? ` <span class="small muted">${esc(c.peakNote)}</span>` : ""}</p>` : ""}
    <button class="primary" id="add">${inPlan ? "Remove from plan" : "Add to plan"}</button>
    ${list("Identification", c.symptoms)}
    ${list("Biology", c.biology)}
    ${MITIGATIONS.map(([key, label]) => {
      const ts = c.treatments.filter((t) => mitigationOf(t.applicationType) === key);
      return ts.length ? `<h2>${label}</h2>` + ts.map((t) => `
        <div class="row" style="display:block">
          <div class="title">${esc(t.title)}</div>
          <div class="small"><span class="chip">${esc(kb.typeById[t.applicationType].name)}</span> ${describeMonths(t.months)}</div>
          ${t.frequency ? `<div class="small">${esc(t.frequency)}</div>` : ""}
          <div class="small muted">${esc(t.purpose)}</div>
          ${(t.notes || []).length ? `<ul class="small">${t.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
        </div>`).join("") : "";
    }).join("")}
    ${c.lookalikeIds?.length ? `<h2>Look-alikes</h2>` + c.lookalikeIds.map((l) => `<a class="item" href="#condition/${l}">${esc(kb.conditionById[l].name)}</a>`).join("") : ""}
    ${list("Regulatory", (c.regulatory || []).map((r) => `${r.jurisdictions.join("/")}: ${r.text}`))}
    ${list("Cost-share", (c.costShare || []).map((x) => `${x.jurisdiction}: ${x.text}`))}
    ${list("Warnings", c.warnings)}
    ${list("Content review flags", c.reviewFlags)}
    ${list("Sources", c.sources)}`;
  $view.querySelector("#add").onclick = () => { toggleCondition(id); renderCondition(id); };
  window.scrollTo(0, 0);
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
  const hash = location.hash || "#plan";
  const [name, arg] = hash.slice(1).split("/");
  const tab = { plan: "plan", problems: "plan", result: "plan", library: "library", condition: "library", reference: "reference" }[name] || "plan";
  document.querySelectorAll("nav.tabs a").forEach((a) => a.classList.toggle("on", a.dataset.tab === tab));
  ({ problems: renderProblems, result: renderResult, library: renderLibrary, condition: () => renderCondition(arg), reference: renderReference }[name] || renderPlan)();
  if (name !== "result") window.scrollTo(0, 0);
}

async function start() {
  try {
    const res = await fetch("data/knowledge_base.json");
    kb = indexKb(await res.json());
  } catch (e) {
    $view.innerHTML = `<p>Could not load the knowledge base. Connect once to install the offline copy.</p>`;
    return;
  }
  // Drop saved references to conditions/options that no longer exist after a data update.
  state.conditionIds = state.conditionIds.filter((id) => kb.conditionById[id]);
  window.addEventListener("hashchange", route);
  route();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}

start();
