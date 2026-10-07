"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { reformulate, saveRecipe } from "@/lib/products";

export async function createRecipeAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim() || `FP-${Date.now().toString(36).toUpperCase()}`;
  const components = [...formData.entries()]
    .filter(([key, value]) => key.startsWith("qty:") && Number(value) > 0)
    .map(([key, value]) => ({ code: key.slice(4), qtyKg: Number(value) }));

  if (!name || components.length === 0) {
    throw new Error("A recipe needs a name and at least one raw material.");
  }

  const id = await saveRecipe({ name, code, components });
  revalidatePath("/");
  redirect(`/products/${id}`);
}

export async function reformulateAction(formData: FormData) {
  const id = String(formData.get("id"));
  await reformulate(id);
  revalidatePath(`/products/${id}`);
}
