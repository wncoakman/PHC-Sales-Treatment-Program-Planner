// Run: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ingredientKey, treatmentNeeds, availableKeys, treatmentAvailable } from "../web/products.js";
import { indexKb, planProblem, defaultSelection } from "../web/engine.js";

const { products } = JSON.parse(readFileSync(new URL("../web/data/products.json", import.meta.url)));
const kb = indexKb(JSON.parse(readFileSync(new URL("../web/data/knowledge_base.json", import.meta.url))));
const t = (title) => ({ title });

test("product list builds from reference/phc-product-list.md", () => {
  assert.ok(products.length >= 70);
  assert.ok(products.every((p) => p.name && p.activeIngredient));
});

test("ingredient names line up between labels and treatment titles", () => {
  assert.equal(ingredientKey("triclopyr (triethylamine salt)"), "triclopyr");
  assert.equal(ingredientKey("paraffinic (mineral) oil"), "horticultural oil");
  assert.equal(ingredientKey("Horticultural oil"), "horticultural oil");
  assert.equal(ingredientKey("mono- and di-potassium salts of phosphorous acid (phosphite)"), "phosphite");
  assert.deepEqual(treatmentNeeds("Copper, myclobutanil or pyraclostrobin + boscalid (foliar spray)").alternatives,
    [["copper"], ["myclobutanil"], ["pyraclostrobin", "boscalid"]]);
  assert.deepEqual(treatmentNeeds("Pyraclostrobin + boscalid, with spinosad and flupyradifurone").also, ["spinosad", "flupyradifurone"]);
});

test("availability follows the switched-on products", () => {
  const all = availableKeys(products);
  assert.ok(treatmentAvailable(t("Imidacloprid (soil drench)"), all));
  assert.ok(treatmentAvailable(t("Bifenthrin or permethrin (bark spray)"), all)); // permethrin via Tengard
  assert.ok(treatmentAvailable(t("Abamectin + horticultural oil (foliar spray)"), all));
  assert.ok(!treatmentAvailable(t("Bifenthrin (foliar spray)"), all));
  const noXytect = availableKeys(products, new Set(products.filter((p) => p.name.startsWith("Xytect")).map((p) => p.name)));
  assert.ok(!treatmentAvailable(t("Imidacloprid (soil drench)"), noXytect));
  assert.ok(!treatmentAvailable(t("Abamectin + horticultural oil"), availableKeys(products, new Set(products.filter((p) => /oil/i.test(p.activeIngredient)).map((p) => p.name)))));
});

test("unavailable options are never selected by default", () => {
  const p = planProblem(kb, kb.conditionById["emerald-ash-borer"], { jurisdiction: "VA" }, {});
  for (const o of p.options) if (o.treatment.id.includes("emamectin")) o.unavailable = true;
  assert.ok(!defaultSelection(p).some((id) => id.includes("emamectin")));
  assert.ok(defaultSelection(p).length);
});
