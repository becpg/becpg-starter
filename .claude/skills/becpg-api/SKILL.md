---
name: becpg-api
description: Read and write beCPG PLM data through its remote API - raw materials, finished products, compositions, nutrients, allergens, costs - and run the formulation engine. Use whenever a task needs product data from beCPG, creates or updates products, or builds a screen, report or automation on top of beCPG.
---

# beCPG remote API

beCPG answers on `$BECPG_URL/service/becpg/remote/...` with HTTP basic authentication
(`BECPG_USER` / `BECPG_PASSWORD` in `.env`). Always pass `format=json`.

Use `node scripts/becpg.mjs` from the shell, or `app/lib/becpg.ts` from the Next.js app. Both wrap
the calls below.

## Calls

| Goal | Call |
|------|------|
| List entities | `GET /entity/list?query=<query>&fields=<props>&maxResults=<n>` |
| Read an entity | `GET /entity?nodeRef=<nodeRef>&lists=<datalists>&fields=<props>` |
| Create or update | `PUT /entity` with body `{"entity": {...}}` |
| Formulate | `GET /formulate?nodeRef=<nodeRef>` |
| Delete | `DELETE /entity?nodeRef=<nodeRef>` |
| Data model of a type | `GET /dictionary?type=bcpg:finishedProduct` |

Queries use the Alfresco FTS syntax; the list endpoint already leaves templates out. Join clauses
with `AND`: clauses without an operator are combined with OR.

```
TYPE:"bcpg:finishedProduct"
TYPE:"bcpg:rawMaterial" AND @bcpg\:erpCode:"RM-FLOUR"
TYPE:"bcpg:finishedProduct" AND NOT @bcpg\:productState:"Archived"
```

## Main types and data lists

| Type | Meaning |
|------|---------|
| `bcpg:rawMaterial` | raw material, carries its own nutrients, allergens and cost |
| `bcpg:semiFinishedProduct` | intermediate recipe |
| `bcpg:finishedProduct` | sold product, made of a composition |
| `bcpg:packagingMaterial` | packaging component |

| Data list | Content | Key fields |
|-----------|---------|------------|
| `bcpg:compoList` | composition | `bcpg:compoListProduct`, `bcpg:compoListQtySubFormula`, `bcpg:compoListUnit` |
| `bcpg:nutList` | nutrients, per 100 g | `bcpg:nutListNut`, `bcpg:nutListFormulatedValue` (computed), `bcpg:nutListValue` (manual input) |
| `bcpg:allergenList` | allergens | `bcpg:allergenListAllergen`, `bcpg:allergenListVoluntary`, `bcpg:allergenListInVoluntary` |
| `bcpg:costList` | costs | `bcpg:costListCost`, `bcpg:costListValue` |
| `bcpg:ingList` | ingredients | `bcpg:ingListIng`, `bcpg:ingListQtyPerc` |

Characteristics (nutrients, allergens, costs, ingredients) live in system lists under
`/app:company_home/cm:System/cm:Characts/bcpg:entityLists/cm:<Nuts|Allergens|Costs|Ings>`. Community
starts with empty lists (the reference data comes with a subscription); `scripts/seed.mjs` shows how
to create test values. Reference them by name:
`{"bcpg:charactName": "Protein"}`. List them with `node scripts/becpg.mjs list nut`.

## Create or update an entity

The root keys identify the entity (code, ERP code or name, plus `type`). `attributes` holds the
properties, `datalists` the list rows. Associations are objects with identifying keys.

```json
{
  "entity": {
    "type": "bcpg:finishedProduct",
    "bcpg:erpCode": "FP-COOKIE",
    "cm:name": "Chocolate cookie",
    "attributes": { "bcpg:legalName": "Chocolate chip cookie" },
    "params": { "ignorePathOnSearch": true, "replaceExistingLists": true, "dataListsToReplace": "bcpg:compoList" },
    "datalists": {
      "bcpg:compoList": [
        {
          "bcpg:compoListProduct": { "bcpg:erpCode": "RM-FLOUR" },
          "attributes": { "bcpg:compoListQtySubFormula": 0.45, "bcpg:compoListUnit": "kg" }
        }
      ],
      "bcpg:nutList": [],
      "bcpg:allergenList": [],
      "bcpg:costList": []
    }
  }
}
```

Then call `/formulate` on the returned nodeRef: nutrients, allergens and costs of the finished
product are computed from its composition. Never compute them in the application.

The response of a `PUT` is `{"nodeRef": "...", "status": "SUCCESS"}`.

## Pitfalls

- **The formulation only fills lists that exist on the product.** When you create a recipe, send
  `"bcpg:nutList": []`, `"bcpg:allergenList": []` and `"bcpg:costList": []` in `datalists`.
- **A recipe only gets the characteristics its template declares**, unless the characteristic has
  `"bcpg:isCharactPropagateUp": true`. The seed sets it on nutrients and costs.
- **beCPG files products in a site by state** (Simulation, Valid...). To find a product again by code
  whatever its folder, pass `"params": {"ignorePathOnSearch": true}`, or you get a duplicate.
- `replaceExistingLists` without `dataListsToReplace` replaces *every* list present in the body.
- Search relies on the Solr index: an entity created a second ago may not be listed yet. Read it by
  nodeRef instead.
- Regulatory compliance by country is not part of beCPG Community: it is the beCPG Regulatory
  module. Do not build a substitute; tell the user and link https://www.becpg.net/contact-us/

Full reference: https://www.becpg.net/docs/en/development/API.html
