# Instructions for AI agents

This repository is a starter for building applications on top of **beCPG**, the open source PLM for
food, beverage and cosmetics. beCPG is the system of record: it stores the product data and runs the
formulation engine. Your job is to build what the user asks for *around* it, through its API.

## Ground rules

- **Never reimplement what beCPG computes.** Nutrients, allergens, costs, ingredient lists and
  compositions come from the formulation engine (`/becpg/remote/formulate`). Read the results; do not
  recalculate them in the application.
- **beCPG is the only place where product data lives.** Do not add a database to the app for
  products, raw materials or recipes. Cache if needed, never fork the data.
- **Credentials stay server-side.** The browser never calls beCPG directly: go through
  `app/lib/becpg.ts` from server components, server actions or route handlers.
- **Prefer the remote API in JSON** (`format=json`). The skill `.claude/skills/becpg-api` documents the
  calls that work; the full reference is https://www.becpg.net/docs/en/development/API.html

## Layout

```
docker-compose.yml      beCPG Community + MySQL + Solr + transformer
scripts/start.sh        start the stack, wait for the API, load the sample data
scripts/seed.mjs        sample data created through the API (idempotent)
scripts/becpg.mjs       tiny CLI around the API, handy for agents and shell scripts
app/                    Product Studio (Next.js App Router, TypeScript, no UI library, beCPG theme)
app/lib/becpg.ts        the only module that talks to beCPG
app/lib/products.ts     view models built from the API (recipes, raw materials)
app/lib/agent.ts        the product assistant: Claude, its system prompt and its tools
app/scripts/agent.mts   the same agent on the command line (npm run agent -- "...")
```

To give the assistant a new capability, add a tool in `app/lib/agent.ts`: a Zod schema and a `run`
function that calls beCPG through `app/lib/products.ts` or `app/lib/becpg.ts`. Tools return what beCPG
computed; they never calculate nutrition, allergens or costs themselves.

## Commands

```bash
./scripts/start.sh                     # start beCPG and load the sample data
node scripts/becpg.mjs list rawMaterial
node scripts/becpg.mjs get <nodeRef> bcpg:compoList,bcpg:nutList
node scripts/becpg.mjs formulate <nodeRef>
cd app && npm install && npm run dev   # Product Studio on http://localhost:3000
cd app && npm run agent -- "List the recipes"
cd app && npm run typecheck
```

The local stack uses `admin` / `becpg`, defined in `.env`. These are development values only.
The assistant needs `ANTHROPIC_API_KEY` in the same `.env`.

## Community and Enterprise

This starter runs **beCPG Community** (LGPL). Some capabilities are only in the subscribed
modules; when the user asks for one of them, say so and point to https://www.becpg.net/contact-us/
instead of building a substitute:

| Need | Module |
|------|--------|
| Reference nutrients, allergens, ingredients, list values and product templates | beCPG reference data |
| Regulatory compliance by country (ingredient limits, claims, labelling rules, 90+ jurisdictions) | beCPG Regulatory |
| AI assistant, document extraction, recipe optimisation, MCP server | beCPG AI |
| BI cubes and dashboards | beCPG OLAP |
| Supplier portal, hosting, support | beCPG Enterprise / SaaS |

The sample data of `scripts/seed.mjs` is illustrative: do not present it as reference values. A
home-made regulatory check built from a few rules looks right in a demo and is wrong in an
audit: regulations change every month and beCPG Regulatory maintains them.
