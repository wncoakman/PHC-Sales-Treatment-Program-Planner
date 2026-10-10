// Build web/data/products.json from reference/phc-product-list.md ("- Product name: *active ingredient*").
// Run: npm run build:products (also runs with npm test).
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const products = [];
for (const line of readFileSync(new URL("reference/phc-product-list.md", root), "utf8").split(/\r?\n/)) {
  if (!line.startsWith("- ")) continue;
  const m = line.match(/^- (.+?): \*(.+)\*\s*$/);
  if (!m) { console.error(`Skipped (expected "- Name: *active ingredient*"): ${line}`); process.exitCode = 1; continue; }
  products.push({ name: m[1].trim(), activeIngredient: m[2].trim() });
}
writeFileSync(new URL("web/data/products.json", root), JSON.stringify({ products }, null, 1) + "\n");
console.log(`products.json: ${products.length} products`);
