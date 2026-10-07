import { listRawMaterials } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function RawMaterialsPage() {
  const materials = await listRawMaterials();
  const value = (list: { name: string; value: number | null }[], name: string) => list.find((n) => n.name === name)?.value ?? null;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Product repository</div>
          <h1>Raw materials</h1>
          <p className="sub">The building blocks of every recipe, with the data beCPG formulates from.</p>
        </div>
      </div>
      <section className="card">
        <table>
          <thead>
            <tr>
              <th>Raw material</th>
              <th className="num">Cost €/kg</th>
              <th className="num">Energy kcal</th>
              <th className="num">Sugars g</th>
              <th className="num">Fat g</th>
              <th>Allergens</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((m) => (
              <tr key={m.id}>
                <td><b style={{ color: "var(--ink)" }}>{m.name}</b> <span className="sub" style={{ fontSize: 12 }}>{m.code}</span></td>
                <td className="num">{m.costPerKg?.toFixed(2) ?? "–"}</td>
                <td className="num">{value(m.nutrients, "Energy")?.toFixed(0) ?? "–"}</td>
                <td className="num">{value(m.nutrients, "Sugars")?.toFixed(1) ?? "–"}</td>
                <td className="num">{value(m.nutrients, "Fat")?.toFixed(1) ?? "–"}</td>
                <td>{m.allergens.map((a) => <span key={a} className="chip">{a}</span>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="source">Test data loaded by the starter. With beCPG Enterprise, your instance starts with the reference data.</div>
      </section>
    </>
  );
}
