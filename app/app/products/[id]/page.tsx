import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecipe } from "@/lib/products";
import { reformulateAction } from "../../actions";

export const dynamic = "force-dynamic";

// Order and indentation of the EU nutrition declaration (Regulation 1169/2011, annex XV).
const DECLARATION = [
  { name: "Energy", main: true },
  { name: "Fat", main: true },
  { name: "Saturated fat", main: false },
  { name: "Carbohydrate", main: true },
  { name: "Sugars", main: false },
  { name: "Protein", main: true },
  { name: "Salt", main: true },
];

const MARKETS = ["European Union", "United States", "United Kingdom", "Canada", "China", "Australia"];

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipe = await getRecipe(id).catch(() => null);
  if (!recipe) notFound();

  const total = recipe.composition.reduce((sum, line) => sum + line.qtyKg, 0) || 1;
  const nutrient = (name: string) => recipe.nutrients.find((n) => n.name === name);
  const energy = nutrient("Energy")?.value ?? null;
  const sugars = nutrient("Sugars")?.value ?? null;
  const declared = DECLARATION.filter((d) => nutrient(d.name));

  return (
    <>
      <p className="sub" style={{ margin: "0 0 10px" }}><Link href="/">← Recipes</Link></p>
      <div className="page-head">
        <div>
          <div className="eyebrow">{recipe.code}</div>
          <h1>{recipe.name}</h1>
          <p className="sub"><span className="badge dot">{recipe.state}</span></p>
        </div>
        <div className="row">
          <form action={reformulateAction}>
            <input type="hidden" name="id" value={recipe.id} />
            <button className="button ghost" type="submit">Formulate again</button>
          </form>
          <a className="button petrol" href={recipe.shareUrl} target="_blank" rel="noreferrer">Open in beCPG</a>
        </div>
      </div>

      <div className="kpis">
        <div className="card kpi"><div className="value">{recipe.costPerKg?.toFixed(3) ?? "–"}<small>{recipe.costUnit}</small></div><div className="label">raw material cost</div></div>
        <div className="card kpi"><div className="value">{energy?.toFixed(0) ?? "–"}<small>kcal</small></div><div className="label">energy per 100 g</div></div>
        <div className="card kpi"><div className="value">{sugars?.toFixed(1) ?? "–"}<small>g</small></div><div className="label">sugars per 100 g</div></div>
        <div className="card kpi"><div className="value">{recipe.allergens.length}</div><div className="label">major allergens</div></div>
      </div>

      <div className="grid-2">
        <div className="stack-v">
          <section className="card">
            <h2>Composition for 1 kg</h2>
            <table>
              <tbody>
                {recipe.composition.map((line) => (
                  <tr key={line.id}>
                    <td>
                      {line.name} <span className="sub" style={{ fontSize: 12 }}>{line.code}</span>
                      <div className="bar"><i style={{ width: `${(100 * line.qtyKg) / total}%` }} /></div>
                    </td>
                    <td className="num">{line.qtyKg.toFixed(3)} kg</td>
                    <td className="num" style={{ width: 70 }}>{((100 * line.qtyKg) / total).toFixed(1)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card">
            <h2>Ingredients</h2>
            <p className="ingredients">
              {recipe.ingredients.length
                ? recipe.ingredients.map((i, n) => `${n ? ", " : ""}${i.name} ${i.percent.toFixed(1)} %`).join("")
                : "No ingredient declared on the raw materials."}
            </p>
            <p style={{ margin: "12px 0 0" }}>
              <span className="sub" style={{ marginRight: 8 }}>Contains:</span>
              {recipe.allergens.length ? recipe.allergens.map((a) => <span key={a} className="chip">{a}</span>) : <span className="badge">No major allergen</span>}
            </p>
            <div className="source">Computed by the beCPG formulation engine</div>
          </section>
        </div>

        <div className="stack-v">
          <section className="card">
            <div className="nutrition">
              <div className="head"><span>Nutrition declaration</span><span>per 100 g</span></div>
              <table>
                <tbody>
                  {declared.map((d) => {
                    const n = nutrient(d.name)!;
                    return (
                      <tr key={d.name} className={d.main ? "main" : ""}>
                        <td className={d.main ? "" : "indent"}>{d.main ? d.name : `of which ${d.name.toLowerCase()}`}</td>
                        <td className="num">{n.value === null ? "–" : n.value.toFixed(d.name === "Energy" ? 0 : 1)} {n.unit}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="source">Computed by the beCPG formulation engine</div>
          </section>

          <section className="card enterprise">
            <div className="edition">beCPG Enterprise</div>
            <h2>Regulatory compliance</h2>
            <p style={{ margin: "6px 0 0" }}>
              Check this recipe against each target market: ingredient limits, additives, claims, mandatory
              mentions and labelling rules, maintained by the beCPG regulatory team.
            </p>
            <div className="markets">
              {MARKETS.map((market) => (
                <div key={market} className="market">{market}<span>Enterprise</span></div>
              ))}
            </div>
            <a className="button" href="https://www.becpg.net/contact-us/" target="_blank" rel="noreferrer">Check on my products</a>
          </section>
        </div>
      </div>
    </>
  );
}
