#!/usr/bin/env node
// Small CLI around the beCPG remote API, for shell scripts and AI agents.
//
//   node scripts/becpg.mjs list <type|query> [fields] [maxResults]
//   node scripts/becpg.mjs get <nodeRef> [lists] [fields]
//   node scripts/becpg.mjs save <file.json | ->        body: { "entity": { ... } }
//   node scripts/becpg.mjs formulate <nodeRef>
//   node scripts/becpg.mjs delete <nodeRef>
//   node scripts/becpg.mjs dictionary <type>
//
// <type> is a short beCPG type such as rawMaterial or finishedProduct; anything with a colon or a
// space is sent as a full search query. Output is JSON on stdout.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const file of [".env", ".env.example"]) {
  const path = join(root, file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}

const BASE = `${process.env.BECPG_URL}/service/becpg/remote`;
const AUTH = "Basic " + Buffer.from(`${process.env.BECPG_USER}:${process.env.BECPG_PASSWORD}`).toString("base64");

export async function api(path, params = {}, init = {}) {
  const url = `${BASE}${path}?${new URLSearchParams({ format: "json", ...params })}`;
  const res = await fetch(url, { ...init, headers: { Authorization: AUTH, "Content-Type": "application/json" } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

export const typeQuery = (type) =>
  /[:\s]/.test(type) ? type : `TYPE:"bcpg:${type}"`;

async function main([command, ...args]) {
  switch (command) {
    case "list": {
      const [type, fields, maxResults = "100"] = args;
      const params = { query: typeQuery(type), maxResults };
      if (fields) params.fields = fields;
      return api("/entity/list", params);
    }
    case "get": {
      const [nodeRef, lists, fields] = args;
      const params = { nodeRef };
      if (lists) params.lists = lists;
      if (fields) params.fields = fields;
      return api("/entity", params);
    }
    case "save": {
      const body = readFileSync(args[0] === "-" || !args[0] ? 0 : args[0], "utf8");
      return api("/entity", {}, { method: "PUT", body });
    }
    case "formulate":
      return api("/formulate", { nodeRef: args[0] });
    case "delete":
      return api("/entity", { nodeRef: args[0] }, { method: "DELETE" });
    case "dictionary":
      return api("/dictionary", { type: args[0].includes(":") ? args[0] : `bcpg:${args[0]}` });
    default:
      throw new Error("Usage: becpg.mjs list|get|save|formulate|delete|dictionary ... (see the header of this file)");
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
