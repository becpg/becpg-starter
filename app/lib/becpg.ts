// Minimal server-side client for the beCPG remote API (JSON format).
// Reference: https://www.becpg.net/docs/en/development/API.html
// Credentials stay on the server: never import this module from a client component.

const BASE = (process.env.BECPG_URL ?? "http://localhost:8080/alfresco") + "/service/becpg/remote";
const AUTH = "Basic " + Buffer.from(`${process.env.BECPG_USER ?? "admin"}:${process.env.BECPG_PASSWORD ?? "becpg"}`).toString("base64");

export type Json = Record<string, any>;

async function call(path: string, params: Record<string, string>, init?: RequestInit): Promise<Json> {
  const url = `${BASE}${path}?${new URLSearchParams({ format: "json", ...params })}`;
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: AUTH, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`beCPG ${init?.method ?? "GET"} ${path} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : {};
}

/** Lists entities matching a search query, e.g. `+TYPE:"bcpg:finishedProduct"`. */
export async function listEntities(query: string, fields: string[] = [], maxResults = 50): Promise<Json[]> {
  const params: Record<string, string> = { query, maxResults: String(maxResults) };
  if (fields.length) params.fields = fields.join(",");
  const data = await call("/entity/list", params);
  return data.entities ?? [];
}

/** Reads one entity with its data lists, e.g. `bcpg:compoList,bcpg:nutList`. */
export async function getEntity(nodeRef: string, lists: string[] = []): Promise<Json> {
  const params: Record<string, string> = { nodeRef };
  if (lists.length) params.lists = lists.join(",");
  const data = await call("/entity", params);
  return data.entity;
}

/** Creates or updates an entity. The root keys identify it, `attributes` and `datalists` hold the values. */
export async function saveEntity(entity: Json): Promise<string> {
  const data = await call("/entity", {}, { method: "PUT", body: JSON.stringify({ entity }) });
  return data.entity?.nodeRef ?? data.nodeRef;
}

/** Runs the formulation engine: composition, nutrients, allergens, costs, ingredients. */
export async function formulate(nodeRef: string): Promise<void> {
  await call("/formulate", { nodeRef });
}

/** Link to the entity in the beCPG user interface, where users edit everything this app does not show. */
export const shareUrl = (id: string) =>
  `${process.env.SHARE_URL ?? "http://localhost:8180/share"}/page/entity-data-lists?nodeRef=workspace://SpacesStore/${id}`;

export const nodeRefFromId = (id: string) => `workspace://SpacesStore/${id}`;
export const idFromNodeRef = (nodeRef: string) => nodeRef.split("/").pop() ?? nodeRef;
