// A product development agent: Claude drives beCPG through the remote API.
// Claude decides what to do; beCPG stores the data and computes every value through its formulation
// engine. The tools never compute nutrition, allergens or costs themselves.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { findRecipeId, getRecipe, listRawMaterials, listRecipes, reformulate, saveRecipe, type Recipe } from "./products";

export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; label: string }
  | { type: "changed"; recipeId: string }
  | { type: "error"; message: string }
  | { type: "done" };

export type History = Anthropic.Beta.Messages.BetaMessageParam[];

const MODEL = "claude-opus-5-5";

const SYSTEM = `You are the product development assistant of a food manufacturer. You work in beCPG, the PLM
that holds the company's raw materials and recipes.

How to work:
- beCPG is the source of truth. Read products with the tools before answering, and never estimate
  nutrients, allergens, costs or ingredient percentages yourself: they come from the beCPG
  formulation engine, which runs every time a recipe is saved.
- To change a recipe, save it with save_recipe and read back what the engine computed. To explore an
  option without touching the original, save it under a new code (for example FP-COOKIE-V2).
- Quantities are in kg for 1 kg of product: the components of a recipe add up to about 1 kg.
- Use only raw materials that exist (list_raw_materials). If one is missing, say so: creating raw
  materials with their supplier data is done in beCPG.
- Answer in the language of the user, briefly, with the figures that matter. Compare before and after
  when you change something. Link to the recipe in beCPG when the user should review it there.

What this instance does not have: it runs beCPG Community. Regulatory compliance by country, the
reference data (official nutrient databases, allergens, ingredient lists) and the pre-configured
beCPG agents come with beCPG Enterprise. When the user needs one of them, say it plainly and do not
improvise a regulatory verdict.`;

const summary = (r: Recipe) => ({
  code: r.code,
  name: r.name,
  state: r.state,
  cost_per_kg: r.costPerKg,
  allergens: r.allergens,
  nutrition_per_100g: Object.fromEntries(r.nutrients.map((n) => [`${n.name} (${n.unit})`, n.value === null ? null : Math.round(n.value * 10) / 10])),
  ingredients_percent: r.ingredients.map((i) => `${i.name} ${Math.round(i.percent * 10) / 10}%`),
  composition_kg: r.composition.map((c) => ({ code: c.code, name: c.name, kg: c.qtyKg })),
  open_in_becpg: r.shareUrl,
});

function buildTools(emit: (event: AgentEvent) => void) {
  const recipeId = async (code: string) => {
    const id = await findRecipeId(code);
    if (!id) throw new Error(`No recipe with code or name "${code}"`);
    return id;
  };

  return [
    betaZodTool({
      name: "list_recipes",
      description: "List the recipes (finished products) with their cost, energy, sugars and allergens.",
      inputSchema: z.object({}),
      run: async () => {
        emit({ type: "tool", name: "list_recipes", label: "Reading the recipes" });
        const recipes = await listRecipes();
        return JSON.stringify(
          recipes.map((r) => ({
            code: r.code,
            name: r.name,
            state: r.state,
            cost_per_kg: r.costPerKg,
            energy_kcal: r.nutrients.find((n) => n.name === "Energy")?.value ?? null,
            sugars_g: r.nutrients.find((n) => n.name === "Sugars")?.value ?? null,
            allergens: r.allergens,
          })),
        );
      },
    }),
    betaZodTool({
      name: "get_recipe",
      description: "Read a recipe from beCPG: composition, ingredients, nutrition per 100 g, allergens and cost, as computed by the formulation engine.",
      inputSchema: z.object({ code: z.string().describe("ERP code or name of the recipe, e.g. FP-COOKIE") }),
      run: async ({ code }) => {
        emit({ type: "tool", name: "get_recipe", label: `Reading ${code}` });
        return JSON.stringify(summary(await getRecipe(await recipeId(code))));
      },
    }),
    betaZodTool({
      name: "list_raw_materials",
      description: "List the raw materials available in beCPG, with their cost, allergens and nutrition per 100 g.",
      inputSchema: z.object({}),
      run: async () => {
        emit({ type: "tool", name: "list_raw_materials", label: "Reading the raw materials" });
        const materials = await listRawMaterials();
        return JSON.stringify(
          materials.map((m) => ({
            code: m.code,
            name: m.name,
            cost_per_kg: m.costPerKg,
            allergens: m.allergens,
            nutrition_per_100g: Object.fromEntries(m.nutrients.map((n) => [n.name, n.value])),
          })),
        );
      },
    }),
    betaZodTool({
      name: "save_recipe",
      description:
        "Create a recipe, or replace the composition of an existing one (same code), then formulate it in beCPG. Returns what the engine computed.",
      inputSchema: z.object({
        code: z.string().describe("ERP code; reuse an existing code to update that recipe, use a new one for a variant"),
        name: z.string().describe("Recipe name"),
        components: z
          .array(z.object({ code: z.string().describe("Raw material ERP code"), qty_kg: z.number().positive() }))
          .min(1)
          .describe("Quantities in kg for 1 kg of product"),
      }),
      run: async ({ code, name, components }) => {
        emit({ type: "tool", name: "save_recipe", label: `Saving and formulating ${code}` });
        const id = await saveRecipe({ code, name, components: components.map((c) => ({ code: c.code, qtyKg: c.qty_kg })) });
        emit({ type: "changed", recipeId: id });
        return JSON.stringify(summary(await getRecipe(id)));
      },
    }),
    betaZodTool({
      name: "formulate_recipe",
      description: "Run the beCPG formulation engine again on a recipe, for example after its raw materials changed.",
      inputSchema: z.object({ code: z.string() }),
      run: async ({ code }) => {
        emit({ type: "tool", name: "formulate_recipe", label: `Formulating ${code}` });
        const id = await recipeId(code);
        await reformulate(id);
        emit({ type: "changed", recipeId: id });
        return JSON.stringify(summary(await getRecipe(id)));
      },
    }),
  ];
}

/**
 * Runs one user turn. The history is append-only: it holds every block Claude returned, thinking
 * included, so it can be sent back unchanged on the next turn.
 */
export async function runAgent(history: History, userText: string, emit: (event: AgentEvent) => void): Promise<History> {
  const client = new Anthropic();
  const runner = client.beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 64000,
    stream: true,
    max_iterations: 20,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    // Re-run a declined request on Anthropic's recommended fallback model instead of failing.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    tools: buildTools(emit),
    messages: [...history, { role: "user", content: userText }],
  });

  for await (const stream of runner) {
    stream.on("text", (delta) => emit({ type: "text", delta }));
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") {
      emit({ type: "error", message: "The request was declined." });
      break;
    }
    if (message.stop_reason === "max_tokens") {
      emit({ type: "error", message: "The answer was cut off." });
      break;
    }
  }

  return [...runner.params.messages];
}
