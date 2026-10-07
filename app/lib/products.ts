// Product view models built from the beCPG remote API.
// Every value comes from beCPG and its formulation engine; this module only reshapes it for display.
import { formulate, getEntity, idFromNodeRef, listEntities, nodeRefFromId, saveEntity, shareUrl, type Json } from "./becpg";

export type Nutrient = { name: string; value: number | null; unit: string };
export type CompoLine = { id: string; code: string; name: string; qtyKg: number };
export type Ingredient = { name: string; percent: number };
export type Recipe = {
  id: string;
  name: string;
  code: string;
  state: string;
  costPerKg: number | null;
  costUnit: string;
  allergens: string[];
  nutrients: Nutrient[];
  ingredients: Ingredient[];
  composition: CompoLine[];
  modified: string;
  shareUrl: string;
};
export type RawMaterial = {
  id: string;
  code: string;
  name: string;
  costPerKg: number | null;
  allergens: string[];
  nutrients: Nutrient[];
};

const SITE_PATH = "/app:company_home/st:sites/cm:npd/cm:documentLibrary";
const charactName = (assoc: Json | undefined) => assoc?.["bcpg:charactName"] ?? "";
const rows = (entity: Json, list: string): Json[] => (entity.datalists?.[list] ?? []).map((row: Json) => row.attributes ?? {});

const allergensOf = (entity: Json) =>
  rows(entity, "bcpg:allergenList")
    .filter((a) => a["bcpg:allergenListVoluntary"] || a["bcpg:allergenListInVoluntary"])
    .map((a) => charactName(a["bcpg:allergenListAllergen"]));

// A formulated value lives in nutListFormulatedValue; nutListValue holds manual input.
const nutrientsOf = (entity: Json) =>
  rows(entity, "bcpg:nutList").map((n) => ({
    name: charactName(n["bcpg:nutListNut"]),
    value: n["bcpg:nutListFormulatedValue"] ?? n["bcpg:nutListValue"] ?? null,
    unit: String(n["bcpg:nutListUnit"] ?? "").replace("/100g", ""),
  }));

function toRecipe(entity: Json): Recipe {
  const cost = rows(entity, "bcpg:costList")[0];
  return {
    id: entity.id,
    name: entity["cm:name"],
    code: entity["bcpg:erpCode"] ?? entity.attributes?.["bcpg:erpCode"] ?? "",
    state: entity.attributes?.["bcpg:productState"] ?? "",
    costPerKg: cost?.["bcpg:costListValue"] ?? null,
    costUnit: cost?.["bcpg:costListUnit"] ?? "€/kg",
    allergens: allergensOf(entity),
    nutrients: nutrientsOf(entity),
    ingredients: rows(entity, "bcpg:ingList")
      .map((i) => ({ name: charactName(i["bcpg:ingListIng"]), percent: i["bcpg:ingListQtyPerc"] ?? 0 }))
      .sort((a, b) => b.percent - a.percent),
    composition: rows(entity, "bcpg:compoList").map((c) => ({
      id: c["bcpg:compoListProduct"]?.id ?? "",
      code: c["bcpg:compoListProduct"]?.["bcpg:erpCode"] ?? "",
      name: c["bcpg:compoListProduct"]?.["cm:name"] ?? "",
      qtyKg: c["bcpg:compoListQtySubFormula"] ?? 0,
    })),
    modified: entity.attributes?.["cm:modified"] ?? "",
    shareUrl: shareUrl(entity.id),
  };
}

const RECIPE_LISTS = ["bcpg:compoList", "bcpg:nutList", "bcpg:allergenList", "bcpg:costList", "bcpg:ingList"];

export async function getRecipe(id: string): Promise<Recipe> {
  return toRecipe(await getEntity(nodeRefFromId(id), RECIPE_LISTS));
}

export async function findRecipeId(codeOrName: string): Promise<string | null> {
  const value = codeOrName.replace(/"/g, "");
  const [byCode] = await listEntities(`TYPE:"bcpg:finishedProduct" AND @bcpg\\:erpCode:"${value}"`, [], 1);
  if (byCode) return byCode.entity.id;
  const [byName] = await listEntities(`TYPE:"bcpg:finishedProduct" AND @cm\\:name:"${value}"`, [], 1);
  return byName?.entity.id ?? null;
}

export async function listRecipes(): Promise<Recipe[]> {
  const entities = await listEntities('TYPE:"bcpg:finishedProduct"');
  const recipes = await Promise.all(entities.map((e) => getRecipe(e.entity.id)));
  return recipes.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listRawMaterials(): Promise<RawMaterial[]> {
  const entities = await listEntities('TYPE:"bcpg:rawMaterial"', ["bcpg:erpCode"], 500);
  const materials = await Promise.all(
    entities.map(async ({ entity }) => {
      const full = await getEntity(nodeRefFromId(entity.id), ["bcpg:costList", "bcpg:allergenList", "bcpg:nutList"]);
      return {
        id: entity.id,
        code: entity["bcpg:erpCode"] ?? "",
        name: entity["cm:name"],
        costPerKg: rows(full, "bcpg:costList")[0]?.["bcpg:costListValue"] ?? null,
        allergens: allergensOf(full),
        nutrients: nutrientsOf(full),
      };
    }),
  );
  return materials.sort((a, b) => a.name.localeCompare(b.name));
}

export type RecipeInput = {
  name: string;
  code?: string;
  /** Raw materials by ERP code, quantities in kg for 1 kg of product. */
  components: { code: string; qtyKg: number }[];
};

/**
 * Creates the recipe, or replaces its composition when the code already exists, then lets beCPG
 * formulate it. Returns its id.
 */
export async function saveRecipe(input: RecipeInput): Promise<string> {
  const nodeRef = await saveEntity({
    type: "bcpg:finishedProduct",
    path: SITE_PATH,
    "cm:name": input.name,
    ...(input.code ? { "bcpg:erpCode": input.code } : {}),
    // beCPG files products in a site by state, so look them up by code wherever they are.
    params: { ignorePathOnSearch: true, replaceExistingLists: true, dataListsToReplace: "bcpg:compoList" },
    attributes: { "bcpg:legalName": input.name, "bcpg:productUnit": "kg", "bcpg:productQty": 1, "bcpg:productState": "Simulation" },
    datalists: {
      "bcpg:compoList": input.components.map((c) => ({
        "bcpg:compoListProduct": { "bcpg:erpCode": c.code },
        attributes: { "bcpg:compoListQtySubFormula": c.qtyKg, "bcpg:compoListUnit": "kg" },
      })),
      // The formulation only fills lists that exist on the product.
      "bcpg:nutList": [],
      "bcpg:allergenList": [],
      "bcpg:costList": [],
      "bcpg:ingList": [],
    },
  });
  await formulate(nodeRef);
  return idFromNodeRef(nodeRef);
}

export async function reformulate(id: string): Promise<void> {
  await formulate(nodeRefFromId(id));
}
