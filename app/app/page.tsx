import Link from "next/link";
import { listRawMaterials, listRecipes, type Recipe } from "@/lib/products";

export const dynamic = "force-dynamic";

const COLORS = ["#004353", "#00767b", "#00b39a", "#00ffbd", "#7fd8c9", "#b8e8e0", "#ff642d", "#ffa27f"];
const value = (recipe: Recipe, name: string) => recipe.nutrients.find((n) => n.name === name)?.value ?? null;
const fmt = (n: number | null, digits = 0) => (n === null ? "–" : n.toFixed(digits));

export default async function RecipesPage() {
  const [recipes, materials] = await Promise.all([listRecipes(), listRawMaterials()]);
  const costs = recipes.map((r) => r.costPerKg).filter((c): c is number => c !== null);
  const average = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : null;
  const allergenFree = recipes.filter((r) => r.allergens.length === 0).length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">New product development</div>
          <h1>Recipes</h1>
          <p className="sub">Read live from beCPG. Costs, nutrition, allergens and ingredients come from its formulation engine.</p>
        </div>
        <Link className="button" href="/new">New recipe</Link>
      </div>

      <div className="kpis">
        <div className="card kpi"><div className="value">{recipes.length}</div><div className="label">recipes</div></div>
        <div className="card kpi"><div className="value">{materials.length}</div><div className="label">raw materials</div></div>
        <div className="card kpi"><div className="value">{fmt(average, 2)}<small>€/kg</small></div><div className="label">average raw material cost</div></div>
        <div className="card kpi"><div className="value">{allergenFree}</div><div className="label">recipes without major allergen</div></div>
      </div>

      <div className="grid">
        {recipes.map((recipe) => {
          const total = recipe.composition.reduce((sum, c) => sum + c.qtyKg, 0) || 1;
          return (
            <Link key={recipe.id} href={`/products/${recipe.id}`} className="card recipe-card">
              <div className="title">
                <div>
                  <h3>{recipe.name}</h3>
                  <div className="code">{recipe.code}</div>
                </div>
                <span className="badge dot">{recipe.state}</span>
              </div>
              <div className="stack" title="Composition">
                {recipe.composition.map((c, i) => (
                  <i key={c.id} style={{ width: `${(100 * c.qtyKg) / total}%`, background: COLORS[i % COLORS.length] }} />
                ))}
              </div>
              <div className="facts">
                <div className="fact"><b>{fmt(recipe.costPerKg, 2)} €</b><span>per kg</span></div>
                <div className="fact"><b>{fmt(value(recipe, "Energy"))}</b><span>kcal / 100 g</span></div>
                <div className="fact"><b>{fmt(value(recipe, "Sugars"), 1)} g</b><span>sugars / 100 g</span></div>
              </div>
              <div>
                {recipe.allergens.length ? recipe.allergens.map((a) => <span key={a} className="chip">{a}</span>) : <span className="badge">No major allergen</span>}
              </div>
            </Link>
          );
        })}
        {recipes.length === 0 && <p className="empty">No recipe yet: ask the assistant or create one.</p>}
      </div>
    </>
  );
}
