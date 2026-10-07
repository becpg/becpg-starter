#!/usr/bin/env node
// Loads test data into beCPG through the remote API: characteristics, ingredients, raw materials
// and two recipes, then formulates the recipes. Safe to run again: every entity is matched on its key
// and updated instead of duplicated. The values are illustrative, not reference data.
import { api } from "./becpg.mjs";

const SITE = "npd";
const SITE_PATH = `/app:company_home/st:sites/cm:${SITE}/cm:documentLibrary`;
const LISTS = "/app:company_home/cm:System/cm:Characts/bcpg:entityLists";

const NUTRIENTS = [
  ["Energy", "kcal"],
  ["Fat", "g"],
  ["Saturated fat", "g"],
  ["Carbohydrate", "g"],
  ["Sugars", "g"],
  ["Protein", "g"],
  ["Salt", "g"],
];
const ALLERGENS = ["Gluten", "Milk", "Eggs", "Soy"];
const COST = "Raw material cost";

// Ingredients with the allergens they carry and their legal name on the label.
const INGREDIENTS = [
  ["Wheat flour", "wheat flour", ["Gluten"]],
  ["Rice flour", "rice flour", []],
  ["Sugar", "sugar", []],
  ["Butter", "butter", ["Milk"]],
  ["Sunflower oil", "sunflower oil", []],
  ["Egg", "whole egg", ["Eggs"]],
  ["Cocoa mass", "cocoa mass", []],
  ["Cocoa butter", "cocoa butter", []],
  ["Soy lecithin", "emulsifier: soy lecithin", ["Soy"]],
  ["Salt", "salt", []],
  ["Oat flakes", "oat flakes", []],
  ["Inulin", "chicory inulin", []],
];

// Nutrients per 100 g, in the order of NUTRIENTS. Cost in €/kg. Ingredients in % of the raw material.
const RAW_MATERIALS = [
  { code: "RM-FLOUR", name: "Wheat flour", nut: [364, 1, 0.2, 76, 0.3, 10, 0], allergens: ["Gluten"], cost: 0.6, ings: [["Wheat flour", 100]] },
  { code: "RM-RICE", name: "Rice flour", nut: [366, 1.4, 0.4, 80, 0.1, 6, 0], allergens: [], cost: 1.4, ings: [["Rice flour", 100]] },
  { code: "RM-SUGAR", name: "Cane sugar", nut: [400, 0, 0, 100, 100, 0, 0], allergens: [], cost: 0.9, ings: [["Sugar", 100]] },
  { code: "RM-INULIN", name: "Chicory inulin", nut: [150, 0, 0, 5, 5, 0, 0.1], allergens: [], cost: 4.2, ings: [["Inulin", 100]] },
  { code: "RM-BUTTER", name: "Butter", nut: [717, 81, 51, 0.1, 0.1, 0.9, 0.02], allergens: ["Milk"], cost: 7.5, ings: [["Butter", 100]] },
  { code: "RM-OIL", name: "Sunflower oil", nut: [884, 100, 10, 0, 0, 0, 0], allergens: [], cost: 1.6, ings: [["Sunflower oil", 100]] },
  { code: "RM-EGG", name: "Whole egg", nut: [143, 9.5, 3.1, 0.7, 0.4, 12.6, 0.36], allergens: ["Eggs"], cost: 3.2, ings: [["Egg", 100]] },
  {
    code: "RM-CHOCO", name: "Dark chocolate chips", nut: [546, 31, 19, 61, 48, 4.9, 0.03], allergens: ["Milk", "Soy"], cost: 9.8,
    ings: [["Cocoa mass", 55], ["Sugar", 40], ["Cocoa butter", 4.5], ["Soy lecithin", 0.5]],
  },
  { code: "RM-SALT", name: "Sea salt", nut: [0, 0, 0, 0, 0, 0, 100], allergens: [], cost: 0.4, ings: [["Salt", 100]] },
  { code: "RM-OAT", name: "Gluten-free oat flakes", nut: [379, 6.5, 1.1, 60, 1, 13, 0], allergens: [], cost: 1.8, ings: [["Oat flakes", 100]] },
];

// Quantities in kg for one kg of dough.
const RECIPES = [
  {
    code: "FP-COOKIE",
    name: "Chocolate chip cookie",
    compo: { "RM-FLOUR": 0.38, "RM-SUGAR": 0.2, "RM-BUTTER": 0.2, "RM-EGG": 0.08, "RM-CHOCO": 0.135, "RM-SALT": 0.005 },
  },
  {
    code: "FP-OAT-BAR",
    name: "Oat and chocolate bar",
    compo: { "RM-OAT": 0.55, "RM-SUGAR": 0.15, "RM-BUTTER": 0.15, "RM-CHOCO": 0.15 },
  },
];

const save = (entity) => api("/entity", {}, { method: "PUT", body: JSON.stringify({ entity }) }).then((r) => r.nodeRef);

async function ensureSite() {
  const base = `${process.env.BECPG_URL}/api/-default-/public/alfresco/versions/1/sites`;
  const auth = "Basic " + Buffer.from(`${process.env.BECPG_USER}:${process.env.BECPG_PASSWORD}`).toString("base64");
  const exists = await fetch(`${base}/${SITE}`, { headers: { Authorization: auth } });
  if (exists.ok) return;
  const res = await fetch(base, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ id: SITE, title: "New product development", visibility: "PUBLIC" }),
  });
  if (!res.ok) throw new Error(`Site creation failed: ${res.status} ${await res.text()}`);
}

const charact = (type, list, name, attributes) =>
  save({ type, path: `${LISTS}/cm:${list}`, "bcpg:charactName": name, attributes });

async function main() {
  console.log("Site 'New product development'");
  await ensureSite();

  console.log("Characteristics: nutrients, allergens, ingredients, cost");
  // isCharactPropagateUp: the formulation adds the characteristic to a recipe as soon as one of its
  // components carries it. Without it, a recipe only gets the characteristics its template declares.
  for (const [name, unit] of NUTRIENTS) {
    await charact("bcpg:nut", "Nuts", name, { "bcpg:nutUnit": unit, "bcpg:isCharactPropagateUp": true });
  }
  for (const name of ALLERGENS) await charact("bcpg:allergen", "Allergens", name, { "bcpg:allergenType": "Major" });
  for (const [name, legalName, allergens] of INGREDIENTS) {
    await charact("bcpg:ing", "Ings", name, {
      "bcpg:legalName": legalName,
      "bcpg:ingAllergens": allergens.map((allergen) => ({ "bcpg:charactName": allergen })),
    });
  }
  await charact("bcpg:cost", "Costs", COST, {
    "bcpg:costCurrency": "€",
    "bcpg:costFixed": false,
    "bcpg:costType": "Composition",
    "bcpg:isCharactPropagateUp": true,
  });

  console.log("Raw materials");
  for (const rm of RAW_MATERIALS) {
    await save({
      type: "bcpg:rawMaterial",
      path: SITE_PATH,
      "bcpg:erpCode": rm.code,
      "cm:name": rm.name,
      // ignorePathOnSearch: beCPG files products in a site by state, so they leave SITE_PATH.
      params: {
        ignorePathOnSearch: true,
        replaceExistingLists: true,
        dataListsToReplace: "bcpg:nutList,bcpg:allergenList,bcpg:costList,bcpg:ingList",
      },
      attributes: { "bcpg:legalName": rm.name, "bcpg:productUnit": "kg", "bcpg:productState": "Valid" },
      datalists: {
        "bcpg:nutList": NUTRIENTS.map(([nut], i) => ({
          "bcpg:nutListNut": { "bcpg:charactName": nut },
          attributes: { "bcpg:nutListValue": rm.nut[i] },
        })),
        "bcpg:allergenList": ALLERGENS.map((allergen) => ({
          "bcpg:allergenListAllergen": { "bcpg:charactName": allergen },
          attributes: { "bcpg:allergenListVoluntary": rm.allergens.includes(allergen), "bcpg:allergenListInVoluntary": false },
        })),
        "bcpg:costList": [{ "bcpg:costListCost": { "bcpg:charactName": COST }, attributes: { "bcpg:costListValue": rm.cost } }],
        "bcpg:ingList": rm.ings.map(([ing, perc]) => ({
          "bcpg:ingListIng": { "bcpg:charactName": ing },
          attributes: { "bcpg:ingListQtyPerc": perc },
        })),
      },
    });
    console.log(`  ${rm.code} ${rm.name}`);
  }

  console.log("Recipes");
  for (const recipe of RECIPES) {
    const nodeRef = await save({
      type: "bcpg:finishedProduct",
      path: SITE_PATH,
      "bcpg:erpCode": recipe.code,
      "cm:name": recipe.name,
      params: { ignorePathOnSearch: true, replaceExistingLists: true, dataListsToReplace: "bcpg:compoList" },
      attributes: { "bcpg:legalName": recipe.name, "bcpg:productUnit": "kg", "bcpg:productQty": 1, "bcpg:productState": "Simulation" },
      datalists: {
        "bcpg:compoList": Object.entries(recipe.compo).map(([code, qty]) => ({
          "bcpg:compoListProduct": { "bcpg:erpCode": code },
          attributes: { "bcpg:compoListQtySubFormula": qty, "bcpg:compoListUnit": "kg" },
        })),
        // Empty lists for the formulation to fill: it only writes into lists that exist.
        "bcpg:nutList": [],
        "bcpg:allergenList": [],
        "bcpg:costList": [],
        "bcpg:ingList": [],
      },
    });
    await api("/formulate", { nodeRef });
    console.log(`  ${recipe.code} ${recipe.name} formulated (${nodeRef})`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
