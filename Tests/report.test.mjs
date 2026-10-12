// Run: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";
import { indexKb, planLandscape, defaultSelection, selKey, siteProgramEntry } from "../web/engine.js";
import { reportFilename, reportData, renderReport } from "../web/report.js";

const kb = indexKb(JSON.parse(readFileSync(new URL("../web/data/knowledge_base.json", import.meta.url))));
const site = { jurisdiction: "VA", address: "1 Main St, Leesburg, VA 20175", nearWater: false, sensitiveSite: false, publicProperty: false };
const job = { clientName: "Smith residence", leadNumber: "12345", inspectionDate: "2026-10-10" };

function landscape(programs = {}) {
  const plants = [
    { uid: "a", hostId: "ash", label: "front", qty: 1, dbh: "18", crownLoss: "10", conditionIds: ["emerald-ash-borer"],
      gps: { lat: 39.108012, lng: -77.556034, acc: 5 }, photos: ["p1", "p2"] },
    { uid: "b", hostId: "boxwood", label: "", qty: 6, dbh: "", crownLoss: "", conditionIds: ["box-tree-moth"], gps: { lat: 39.10812, lng: -77.55590, acc: 8 } },
    { uid: "c", hostId: "dogwood", label: "", qty: 1, dbh: "", crownLoss: "", conditionIds: [] },
  ];
  const entries = planLandscape(kb, site, plants.filter((p) => p.conditionIds.length));
  const pe = siteProgramEntry(kb, programs, plants.map((p) => ({ plant: p, host: kb.hostById[p.hostId] })));
  if (pe) entries.push(pe);
  const selected = new Set(entries.flatMap((e) => e.problems.flatMap((p) => defaultSelection(p).map((id) => selKey(e.plant.uid, id)))));
  return { plants, entries, selected };
}

test("report filename: lead_PHC Program-client_date, blanks left out", () => {
  assert.equal(reportFilename(job), "12345_PHC Program-Smith residence_2026-10-10.pdf");
  assert.equal(reportFilename({ clientName: "A/B: Co", inspectionDate: "2026-10-10" }), "PHC Program-A-B- Co_2026-10-10.pdf");
  assert.equal(reportFilename({}), "PHC Program.pdf");
});

test("report data: full inventory, selected treatments, soil sampling first and ASAP", () => {
  const l = landscape({ soilCare: true, soilAnalysis: true, soilSamples: 2 });
  const d = reportData(kb, { site, job, ...l, productsOf: () => ["Xytect 2F"] });
  assert.equal(d.filename, "12345_PHC Program-Smith residence_2026-10-10.pdf");
  assert.deepEqual(d.inventory.map((r) => r.slice(0, 5)), [
    ["1", "Ash", "1", "18 in.", "10%"], ["2", "Boxwood", "6", "", ""], ["3", "Dogwood", "1", "", ""]]);
  assert.equal(d.inventory[0][5], "front\n39.108012, -77.556034 (±5 m)\nPhotos: 12345-1");
  assert.equal(d.inventory[2][5], "No GPS position");
  assert.equal(d.inventory[2][6], "None noted");
  assert.deepEqual(d.mapPoints.map((p) => [p.n, p.label]), [[1, "12345-1 Ash"], [2, "12345-2 Boxwood"]]);
  const csv = d.coordinates.csv.trim().split("\r\n");
  assert.equal(csv[0], "id,number,species,location,latitude,longitude,accuracy_m,source,qty,dbh_in,crown_loss_pct,problems");
  assert.equal(csv[1], "12345-1,1,Ash,front,39.108012,-77.556034,5,gps,1,18,10,Emerald ash borer");
  assert.equal(csv[3], "12345-3,3,Dogwood,,,,,,1,,,");
  const gj = JSON.parse(d.coordinates.geojson);
  assert.equal(gj.features.length, 2);
  assert.deepEqual(gj.features[0].geometry.coordinates, [-77.556034, 39.108012]);
  assert.deepEqual(d.photoGroups, [{ label: "12345-1", title: "Ash · front", photoIds: ["p1", "p2"] }]);
  assert.equal(reportData(kb, { site, job: {}, ...l }).photoGroups[0].label, "Tree 1");
  assert.deepEqual(d.plan.map((p) => p.name), ["Ash (front)", "Boxwood ×6", "Soil Care"]);
  assert.ok(d.plan.every((p) => p.rows.length));
  assert.ok(d.plan[0].rows.every((r) => r[5] === "Xytect 2F"));
  assert.equal(d.visits[0].title, "Visit 1 · ASAP");
  assert.ok(d.visits[0].asap && /before program visits begin/.test(d.visits[0].when));
  assert.ok(d.visits.slice(1).every((v) => !v.asap));
  const soil = d.plan[2].rows.find((r) => r[1].startsWith("Soil sample analysis"));
  assert.equal(soil[4], "ASAP, before program visits begin");
});

test("report renders a PDF", () => {
  // The vendored files are browser builds: run them as plain scripts, as the page's <script> tags do.
  for (const f of ["jspdf.umd.min.js", "jspdf.plugin.autotable.min.js"]) vm.runInThisContext(readFileSync(new URL(`../web/vendor/${f}`, import.meta.url), "utf8"));
  const { jsPDF } = globalThis.jspdf, { autoTable } = globalThis;
  const l = landscape({ soilCare: true, soilAnalysis: true });
  // A 4×3 grey JPEG stands in for the site map and the photos.
  const jpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAADAAQBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
  const pic = { dataUrl: jpeg, width: 4, height: 3 };
  const doc = renderReport(jsPDF, autoTable, reportData(kb, { site, job, ...l }),
    { siteMap: { ...pic, note: "Imagery: test" }, photos: { p1: pic, p2: pic } });
  const out = doc.output();
  if (process.env.REPORT_PDF) writeFileSync(process.env.REPORT_PDF, Buffer.from(doc.output("arraybuffer")));
  assert.ok(out.startsWith("%PDF-"));
  assert.ok(doc.getNumberOfPages() >= 1);
});

test("zip export: folder named after the report, photos named by caption", async () => {
  const { exportFiles } = await import("../web/report.js");
  const { makeZip, crc32 } = await import("../web/zip.js");
  const l = landscape();
  const files = exportFiles(reportData(kb, { site, job, ...l }));
  assert.equal(files.zipName, "12345_PHC Program-Smith residence_2026-10-10.zip");
  assert.equal(files.pdfPath, "12345_PHC Program-Smith residence_2026-10-10/12345_PHC Program-Smith residence_2026-10-10.pdf");
  assert.deepEqual(files.photos.map((p) => p.path.split("/").slice(1).join("/")), ["photos/12345-1a.jpg", "photos/12345-1b.jpg"]);
  const base = "12345_PHC Program-Smith residence_2026-10-10";
  assert.deepEqual([files.mapPath, files.geojsonPath, files.csvPath],
    [`${base}/${base}_site map.jpg`, `${base}/${base}_coordinates.geojson`, `${base}/${base}_coordinates.csv`]);
  const { gpsLine } = await import("../web/report.js");
  assert.equal(gpsLine({ lat: 39.1, lng: -77.5, acc: 4.4, source: "gps" }), "39.100000, -77.500000 (±4 m)");
  assert.equal(gpsLine({ lat: 39.1, lng: -77.5, acc: 30, weak: true }), "39.100000, -77.500000 (±30 m, weak signal)");
  assert.equal(gpsLine({ lat: 39.1, lng: -77.5, acc: null, source: "map" }), "39.100000, -77.500000 (placed on map)");

  const { photoCaption } = await import("../web/report.js");
  const g = (n) => ({ label: "12345-4", photoIds: Array(n).fill("x") });
  assert.equal(photoCaption(g(1), 0), "12345-4");
  assert.deepEqual([0, 2, 25, 26, 27].map((i) => photoCaption(g(30), i)), ["12345-4a", "12345-4c", "12345-4z", "12345-4aa", "12345-4ab"]);
  assert.equal(crc32(new TextEncoder().encode("123456789")).toString(16), "cbf43926");
  const zip = makeZip([{ name: "a/b.txt", data: new TextEncoder().encode("hello") }, { name: "a/ü.txt", data: new Uint8Array([1, 2, 3]) }]);
  const v = new DataView(zip.buffer);
  assert.equal(v.getUint32(0, true), 0x04034b50);
  const end = zip.length - 22;
  assert.equal(v.getUint32(end, true), 0x06054b50);
  assert.equal(v.getUint16(end + 10, true), 2);
  if (process.env.ZIP_OUT) writeFileSync(process.env.ZIP_OUT, zip);
});
