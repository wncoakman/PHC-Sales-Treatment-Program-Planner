// PDF report for one landscape: job details, tree inventory, the selected treatment plan and the visit breakdown.
// reportFilename and reportData are pure (tested); renderReport draws the data with jsPDF + AutoTable in the browser.

import { coordinateExports } from "./geo.js";
import {
  plantName, selKey, chosenCount, describeMonths, visitPlan, numberedVisits, slotName, describeVisitWindow,
  anytimeLabel, alsoFitsText, PROGRAM_UID, ASAP_TEXT,
} from "./engine.js";

const blank = (v) => v == null || String(v).trim() === "";
const SOURCE_NOTE = { map: "placed on map", manual: "entered manually" };
/** "39.108012, -77.556034 (±5 m)", or "(placed on map)" / "(entered manually)" for those sources. */
export const gpsLine = (g) => {
  const how = SOURCE_NOTE[g.source] || [g.acc != null && `±${Math.round(g.acc)} m`, g.weak && "weak signal"].filter(Boolean).join(", ");
  return `${Number(g.lat).toFixed(6)}, ${Number(g.lng).toFixed(6)}${how ? ` (${how})` : ""}`;
};

/** "12345_PHC Program-Smith residence_2026-10-10.pdf"; blank parts are left out. */
export function reportFilename(job = {}) {
  const clean = (s) => String(s ?? "").trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ");
  let name = "PHC Program";
  if (!blank(job.clientName)) name += `-${clean(job.clientName)}`;
  if (!blank(job.leadNumber)) name = `${clean(job.leadNumber)}_${name}`;
  if (!blank(job.inspectionDate)) name += `_${clean(job.inspectionDate)}`;
  return `${name}.pdf`;
}

/**
 * Everything the report prints, as plain rows.
 * plants: every plant in the landscape (the inventory lists them all, with or without problems).
 * entries: the plan entries (plants with problems, plus Soil Care). productsOf(plantUid, option) → product names.
 */
export function reportData(kb, { site, job = {}, plants = [], entries, selected, counts = {}, productsOf = () => [] }) {
  const vp = visitPlan(entries, selected, counts);
  const oneTime = vp.asap.length + vp.anytime.length;
  const summary = [
    vp.visits.length && `${vp.visits.length} program visit${vp.visits.length === 1 ? "" : "s"} per year`,
    vp.applications && `${vp.applications} application${vp.applications === 1 ? "" : "s"}`,
    oneTime && `${oneTime} one-time visit${oneTime === 1 ? "" : "s"}${vp.asap.length ? " (ASAP)" : ""}`,
  ].filter(Boolean).join(" · ");

  // Inventory numbers are the site map pin numbers; item IDs ("12345-1") label the map pins, photos and coordinates.
  const photoLabel = (n) => (blank(job.leadNumber) ? `Tree ${n}` : `${String(job.leadNumber).trim()}-${n}`);
  const species = (p) => kb.hostById[p.hostId]?.name || p.hostId;
  const inventory = plants.map((p, i) => [
    String(i + 1),
    kb.hostById[p.hostId]?.name || p.hostId,
    String(p.qty || 1),
    blank(p.dbh) ? "" : `${p.dbh} in.`,
    blank(p.crownLoss) ? "" : `${p.crownLoss}%`,
    [p.label?.trim(), p.gps ? gpsLine(p.gps) : "No GPS position", p.photos?.length ? `Photos: ${photoLabel(i + 1)}` : "",
      !blank(p.notes) ? `Arborist notes: ${p.notes.trim()}` : ""].filter(Boolean).join("\n"),
    [...p.conditionIds.map((id) => kb.conditionById[id]?.name).filter(Boolean), ...(p.customProblems || [])].join(", ") || "None noted",
  ]);
  const mapPoints = plants.map((p, i) => p.gps && { n: i + 1, lat: p.gps.lat, lng: p.gps.lng, label: `${photoLabel(i + 1)} ${species(p)}` }).filter(Boolean);
  const coordinates = coordinateExports(plants.map((p, i) => ({
    id: photoLabel(i + 1), n: i + 1, species: species(p), location: p.label?.trim() || "", qty: p.qty || 1,
    dbh: blank(p.dbh) ? "" : String(p.dbh), crownLoss: blank(p.crownLoss) ? "" : String(p.crownLoss),
    problems: p.conditionIds.map((id) => kb.conditionById[id]?.name).filter(Boolean).join("; "), gps: p.gps || null,
  })));
  const photoGroups = plants.map((p, i) => ({
    label: photoLabel(i + 1),
    title: [kb.hostById[p.hostId]?.name || p.hostId, p.label?.trim()].filter(Boolean).join(" · "),
    photoIds: p.photos || [],
  })).filter((g) => g.photoIds.length);

  const timing = (o) => {
    const t = o.treatment, s = t.schedule;
    if (t.oneOff) return t.asap ? "ASAP, before program visits begin" : "One-time, no set timing";
    const when = t.months?.length ? describeMonths(t.months) : s?.window || "";
    return [when, s?.repeat].filter(Boolean).join(" · ");
  };
  const plan = entries.map((e) => {
    const rows = [], notes = new Set();
    for (const p of e.problems) {
      const chosen = p.options.filter((o) => selected.has(selKey(e.plant.uid, o.treatment.id)));
      if (!chosen.length) continue;
      for (const f of p.flags) if (f.level !== "info" || e.plant.uid !== PROGRAM_UID) notes.add(f.text);
      for (const o of chosen) {
        const t = o.treatment, s = t.schedule;
        rows.push([
          p.condition.name,
          `${t.oneOff ? anytimeLabel(o) : t.title}${o.notAdvised ? " (NOT ADVISED under current conditions)" : ""}`,
          o.type.name,
          s ? String(chosenCount(s, counts[selKey(e.plant.uid, t.id)])) : t.oneOff ? "1" : "As needed",
          timing(o),
          productsOf(e.plant.uid, o).join(", "),
        ]);
        for (const f of o.flags) if (f.level !== "info") notes.add(f.text);
      }
    }
    return { name: plantName(e), rows, notes: [...notes], customProblems: e.plant.customProblems || [], plantNotes: e.plant.notes?.trim() || "" };
  });

  const visits = numberedVisits(vp).map((x) => {
    if (x.kind === "program") {
      const v = x.visit;
      return {
        title: `Visit ${x.n} · ${slotName(v.slot)}`,
        when: v.from !== v.to ? `Flexible ${describeVisitWindow(v)}` : "",
        rows: v.items.map((it) => [it.plant, `${it.option.treatment.title}${it.of > 1 ? ` (${it.n} of ${it.of})` : ""}`, it.problem,
          it.alsoFits.length ? alsoFitsText(it).replace("⇄ ", "") : ""]),
      };
    }
    return {
      title: `Visit ${x.n} · ${x.kind === "asap" ? "ASAP" : "One-time"}`,
      when: x.kind === "asap" ? `${ASAP_TEXT}; not scheduled to a date` : "No set timing; schedule at the arborist's discretion",
      asap: x.kind === "asap",
      rows: [[x.item.plant, anytimeLabel(x.item.option), x.item.problem, ""]],
    };
  });
  const compressed = vp.compressed.map((c) => `${c.plant}: ${c.option.treatment.title} does not fit its window at the stated spacing; scheduled as early as possible.`);

  const jobRows = [
    ["Client", job.clientName], ["SingleOps lead #", job.leadNumber], ["Inspection date", job.inspectionDate],
    ["Work address", site.address], ["Jurisdiction", site.jurisdiction], ["Arborist notes (program stage)", job.programNotes],
  ].filter(([, v]) => !blank(v)).map(([k, v]) => [k, String(v)]);

  return { filename: reportFilename(job), title: "PHC Program", jobRows, summary, inventory, mapPoints, coordinates, photoGroups, plan, visits, compressed, disclaimer: kb.meta.disclaimer };
}

/** A photo's caption in the report: "12345-1", or "12345-1a", "12345-1b"… when the item has several; the zip names its file the same. */
export const photoCaption = (group, i) => (group.photoIds.length > 1 ? `${group.label}${photoLetter(i)}` : group.label);
// a…z, then aa, ab… for an item with more than 26 photos.
const photoLetter = (i) => (i < 26 ? "" : photoLetter(Math.floor(i / 26) - 1)) + String.fromCharCode(97 + (i % 26));

/**
 * The zip export's layout, all inside "<report name>/": the PDF, the site map image, coordinates as GeoJSON and
 * CSV, and "photos/<caption>.jpg".
 */
export function exportFiles(data) {
  const folder = data.filename.replace(/\.pdf$/, "");
  return {
    zipName: `${folder}.zip`,
    pdfPath: `${folder}/${data.filename}`,
    mapPath: `${folder}/${folder}_site map.jpg`,
    geojsonPath: `${folder}/${folder}_coordinates.geojson`,
    csvPath: `${folder}/${folder}_coordinates.csv`,
    photos: data.photoGroups.flatMap((g) => g.photoIds.map((id, i) => ({ id, path: `${folder}/photos/${photoCaption(g, i)}.jpg` }))),
  };
}

// The PDF's built-in Helvetica has no glyphs for these; swap them for plain equivalents.
const pdfText = (s) => String(s ?? "")
  .replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/[⇄→]/g, "->").replace(/[⚠ⓘ⛔]/g, "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff–—•…×·°]/g, "");

/**
 * Draws the report and returns the jsPDF document. assets (built in the browser): siteMap { dataUrl, width,
 * height, note } from drawSiteMap, photos { id: { dataUrl, width, height } }.
 */
export function renderReport(jsPDF, autoTable, data, assets = {}) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 40;
  const GREEN = [47, 107, 58], GREY = [102, 102, 102];
  let y = M;
  const room = (h) => { if (y + h > H - M) { doc.addPage(); y = M; } };
  // A heading needs room for its first rows beneath it, or it moves to the next page.
  const heading = (text) => {
    room(110);
    y += 14;
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...GREEN).text(pdfText(text), M, y);
    doc.setDrawColor(...GREEN).setLineWidth(1).line(M, y + 4, W - M, y + 4);
    y += 14;
  };
  const para = (text, { size = 9, color = GREY, style = "normal" } = {}) => {
    doc.setFont("helvetica", style).setFontSize(size).setTextColor(...color);
    const lines = doc.splitTextToSize(pdfText(text), W - 2 * M);
    room(lines.length * size * 1.25);
    doc.text(lines, M, y + size);
    y += lines.length * size * 1.25 + 2;
  };
  const table = (head, body, extra = {}) => {
    autoTable(doc, {
      startY: y, head: [head.map(pdfText)], body: body.map((r) => r.map(pdfText)), margin: { left: M, right: M, bottom: M + 10 },
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 4, valign: "top", overflow: "linebreak" },
      headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [244, 244, 244] },
      rowPageBreak: "avoid",
      ...extra,
    });
    y = doc.lastAutoTable.finalY + 8;
  };

  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(...GREEN).text(data.title, M, y + 16);
  y += 26;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...GREY).text(pdfText(data.filename.replace(/\.pdf$/, "")), M, y + 8);
  y += 16;
  if (data.jobRows.length) table(["Job", ""], data.jobRows, { showHead: false, theme: "plain", styles: { fontSize: 10, cellPadding: 2 }, columnStyles: { 0: { fontStyle: "bold", cellWidth: 110 } } });
  if (data.summary) { para(data.summary, { size: 11, color: [27, 27, 27], style: "bold" }); y += 6; }

  heading(`Tree inventory (${data.inventory.length})`);
  const map = assets.siteMap;
  if (map) {
    const w = W - 2 * M, h = (w * map.height) / map.width;
    room(h + 24);
    doc.addImage(map.dataUrl, "JPEG", M, y, w, h);
    y += h + 2;
    para(`Site map: pins are the inventory numbers. ${map.note}`, { size: 7.5 });
    const missing = data.inventory.length - data.mapPoints.length;
    if (missing > 0) para(`${missing} item${missing === 1 ? " has" : "s have"} no GPS position and ${missing === 1 ? "is" : "are"} not pinned.`, { size: 7.5 });
    y += 4;
  } else if (data.inventory.length) para("No GPS positions recorded: no site map.", { size: 8 });
  if (data.inventory.length) {
    table(["#", "Plant", "Qty", "DBH", "Crown loss", "Location", "Problems"], data.inventory,
      { columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 80 }, 2: { cellWidth: 28 }, 3: { cellWidth: 40 }, 4: { cellWidth: 40 }, 5: { cellWidth: 150 } } });
  } else para("No plants entered.");

  heading("Treatment plan");
  for (const p of data.plan) {
    room(50);
    para(p.name, { size: 11, color: [27, 27, 27], style: "bold" });
    if (p.rows.length) {
      table(["Problem", "Treatment", "Method", "Apps/yr", "Timing", "Products"], p.rows,
        { columnStyles: { 0: { cellWidth: 85 }, 1: { cellWidth: 127 }, 2: { cellWidth: 80 }, 3: { cellWidth: 46, halign: "center" }, 4: { cellWidth: 90 } } });
    } else if (!p.customProblems.length && !p.plantNotes) para("No treatment selected.");
    for (const t of p.customProblems) para(`- ${t} (not in knowledge base; no treatment suggested)`, { size: 8 });
    if (p.plantNotes) para(`Arborist notes: ${p.plantNotes}`, { size: 8 });
    for (const n of p.notes) para(`! ${n}`, { size: 8 });
    y += 4;
  }

  if (data.visits.length) {
    heading("Visit breakdown");
    for (const v of data.visits) {
      room(90 + 30 * v.rows.length); // keep a visit's title and table together when it fits on a page
      para(v.title, { size: 11, color: v.asap ? [168, 93, 0] : [27, 27, 27], style: "bold" });
      if (v.when) para(v.when, { size: 9, color: v.asap ? [168, 93, 0] : GREY, style: v.asap ? "bold" : "normal" });
      table(["Plant", "Treatment", "Problem", "Also fits"], v.rows,
        { columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 190 }, 2: { cellWidth: 110 } } });
    }
    for (const c of data.compressed) para(`! ${c}`, { size: 8 });
  }

  const groups = data.photoGroups.filter((g) => g.photoIds.some((id) => assets.photos?.[id]));
  if (groups.length) {
    heading("Photos");
    const cols = 3, gap = 10, cw = (W - 2 * M - gap * (cols - 1)) / cols, ch = cw * 0.75;
    for (const g of groups) {
      const pics = g.photoIds.map((id, i) => assets.photos?.[id] && { ...assets.photos[id], caption: photoCaption(g, i) }).filter(Boolean);
      room(ch + 44);
      para(`${g.label} · ${g.title}`, { size: 11, color: [27, 27, 27], style: "bold" });
      pics.forEach((pic, i) => {
        if (i % cols === 0 && i) { y += ch + 16; room(ch + 16); }
        const x = M + (i % cols) * (cw + gap);
        // Fit inside the cell, keeping the photo's proportions.
        const s = Math.min(cw / pic.width, ch / pic.height), pw = pic.width * s, ph = pic.height * s;
        doc.addImage(pic.dataUrl, "JPEG", x + (cw - pw) / 2, y + (ch - ph) / 2, pw, ph);
        doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GREY)
          .text(pdfText(pic.caption), x, y + ch + 10);
      });
      y += ch + 22;
    }
  }

  y += 6;
  para(data.disclaimer, { size: 7.5 });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GREY);
    doc.text(pdfText(data.filename.replace(/\.pdf$/, "")), M, H - 22);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 22, { align: "right" });
  }
  doc.setProperties({ title: pdfText(data.filename.replace(/\.pdf$/, "")), subject: "PHC Program", creator: "PHC Planner" });
  return doc;
}
