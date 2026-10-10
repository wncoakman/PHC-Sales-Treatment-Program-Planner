// Product availability: which chemical treatments the company's stocked products can supply.
// Pure functions, no DOM. Product list source: reference/phc-product-list.md (built to data/products.json).

// Names that differ between product labels and reference treatment titles, matched before the plain name.
const ALIASES = [
  [/anti-?desiccant/, "anti-desiccant"],
  [/tick tube/, "permethrin tick tubes"],
  [/horticultural oil|mineral oil|paraffinic|dormant oil|summer oil/, "horticultural oil"],
  [/phosphite|phosphorous acid/, "phosphite"],
  [/humic|humate/, "humic acids"],
  [/kurstaki|\bbtk\b/, "btk"],
  [/israelensis|\bbti\b/, "bti"],
  [/antibiotic|oxytetracycline/, "oxytetracycline"],
  [/halosulfuron/, "halosulfuron"],
];

const stripParens = (s) => {
  let prev;
  do { prev = s; s = s.replace(/\([^()]*\)/g, ""); } while (s !== prev);
  return s;
};

/** One ingredient phrase -> canonical key ("Triclopyr (triethylamine salt)" -> "triclopyr"). */
export function ingredientKey(text) {
  const t = text.toLowerCase();
  const alias = ALIASES.find(([re]) => re.test(t));
  return alias ? alias[1] : stripParens(t).replace(/\s+/g, " ").trim();
}

/** Ingredient keys a product supplies ("chlorothalonil + propiconazole" -> both). */
export const productKeys = (product) => product.activeIngredient.split(" + ").map(ingredientKey).filter(Boolean);

/**
 * What a treatment needs, from its title: any one alternative (", " / " or "), each alternative needing all of
 * its " + " parts, plus every ", with ..." companion. "Copper, myclobutanil or pyraclostrobin + boscalid"
 * -> { alternatives: [[copper], [myclobutanil], [pyraclostrobin, boscalid]], also: [] }.
 */
export function treatmentNeeds(title) {
  const anti = /anti-?desiccant/i.test(title);
  const [main, withPart = ""] = stripParens(title).split(/,? with /);
  const alternatives = anti ? [["anti-desiccant"]] : main.split(/, | or /).map((alt) => alt.split(" + ").map(ingredientKey).filter(Boolean));
  const also = withPart.split(/, | and /).map(ingredientKey).filter(Boolean);
  return { alternatives: alternatives.filter((a) => a.length), also };
}

/** Keys supplied by the products that are switched on. */
export const availableKeys = (products, unavailable = new Set()) =>
  new Set(products.filter((p) => !unavailable.has(p.name)).flatMap(productKeys));

/** True when the switched-on products supply this treatment. */
export function treatmentAvailable(treatment, keys) {
  const { alternatives, also } = treatmentNeeds(treatment.title);
  return alternatives.some((alt) => alt.every((k) => keys.has(k))) && also.every((k) => keys.has(k));
}

/** Switched-on products that supply any ingredient of this treatment (for display). */
export function productsFor(treatment, products, unavailable = new Set()) {
  const { alternatives, also } = treatmentNeeds(treatment.title);
  const needed = new Set([...alternatives.flat(), ...also]);
  return products.filter((p) => !unavailable.has(p.name) && productKeys(p).some((k) => needed.has(k)));
}
