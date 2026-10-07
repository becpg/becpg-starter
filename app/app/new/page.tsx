import { listRawMaterials } from "@/lib/products";
import { createRecipeAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewRecipePage() {
  const materials = await listRawMaterials();

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">New product development</div>
          <h1>New recipe</h1>
          <p className="sub">Enter the quantities for 1 kg, or ask the assistant to build the recipe for you.</p>
        </div>
      </div>
      <form action={createRecipeAction} className="card" style={{ maxWidth: 640 }}>
        <div className="row" style={{ marginBottom: 14 }}>
          <input name="name" placeholder="Recipe name" required style={{ flex: 2 }} />
          <input name="code" placeholder="Code, e.g. FP-SHORTBREAD" style={{ flex: 1 }} />
        </div>
        <h2>Composition</h2>
        {materials.map((m) => (
          <label key={m.id} className="form-line">
            <span>{m.name} <span className="sub" style={{ fontSize: 12 }}>{m.code} · {m.costPerKg?.toFixed(2)} €/kg</span></span>
            <input name={`qty:${m.code}`} type="number" min="0" step="0.001" placeholder="kg" />
          </label>
        ))}
        <div className="row" style={{ marginTop: 16 }}>
          <button className="button" type="submit">Create and formulate</button>
        </div>
      </form>
    </>
  );
}
