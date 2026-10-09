// Fill lat/lon for operations bases in web/data/bases.json from their addresses (OpenStreetMap Nominatim).
// Run: npm run geocode:bases   (re-run after adding or changing a base address)
import { readFileSync, writeFileSync } from "node:fs";
import { geocode } from "../web/logistics.js";

const file = new URL("../web/data/bases.json", import.meta.url);
const cfg = JSON.parse(readFileSync(file, "utf8"));
const ua = (url, opts = {}) => fetch(url, { ...opts, headers: { ...opts.headers, "User-Agent": "phc-planner-bases/1.0" } });
for (const b of cfg.bases) {
  b.id ||= b.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const hit = await geocode(b.address, ua);
  if (!hit) { console.error(`NOT FOUND: ${b.name}: ${b.address}`); process.exitCode = 1; continue; }
  Object.assign(b, { lat: hit.lat, lon: hit.lon });
  console.log(`${b.name}: ${hit.lat}, ${hit.lon}  (${hit.display})`);
  await new Promise((r) => setTimeout(r, 1100)); // Nominatim: max 1 request/second
}
writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
