# Spec 0016 — handoff

**Branch:** `feature/admin-panel-crud-20260816` · **PR:** #310 (open, mergeable)
**Base:** `main` @ `6cad4f4b`, merged in at `83de5864`
**Scope:** 11 commits · 108 files · migration `0118`

Written 2026-08-16 as a handoff for whoever picks this up, including a future
session of mine. `requirements.md` is the spec; `implementation.md` is the
phase-by-phase build log with per-screen test steps. This file is the short
version plus what is *not* done.

---

## 1. What this branch is

One drawer destination, **Administração**, that is the single place an ADMIN
maintains the reference data the rest of the app consumes.

It was not a green-field build. `/catalog` — the admin product list, the
competitor form, the metric CRUD — **was unreachable from the running app**: a
root route whose only entry point was a tab bar rendered by itself. So most of
this is an information-architecture change plus a small number of real API gaps.
The orphaned `/catalog` tree is retired rather than left in place.

### Screens

| Screen | Route | Notes |
|---|---|---|
| Hub | `/admin` | Drawer branch 12, `isAdmin` only |
| Produtos | `/admin/produtos` | Full CRUD + picture upload; conditional delete |
| Produtos concorrentes | `/admin/concorrentes` | CRUD; equivalences are **not** edited here |
| Métricas | `/admin/metricas` | Per-linha; rename/remove live inside the metric |
| Fontes pagadoras | `/admin/fontes-pagadoras` | Deactivate-only |
| Requisitos de cadastro | `/admin/requisitos` | Conditional delete |
| Catálogos | `/admin/catalogos` | 4 segments: especialidades, focos, papéis, conselhos |
| Clínicas desativadas | `/admin/clinicas-desativadas` | **§4.8** — reactivation |

### Decisions that are load-bearing

- **Delete is conditional** (§6.2). `product_equivalences` cascades and
  `facility_product_usage` is `ON DELETE RESTRICT`, so a delete is refused while
  anything references the row and the refusal names what. The row is locked
  `FOR UPDATE` before it is counted.
- **Equivalences are one-directional** — our product → competitor, never the
  reverse (§6.5). An earlier draft had both; it was rejected by the product
  owner and the reverse code was deleted.
- **`metricUnits` is read-only** (§1.2/§7.1), by decision.
- **The product picture is uploaded, not typed.** `pictureUrl` left the request
  body: it names an object this API stores.
- **Clínicas desativadas is the one screen touching operational data**, against
  §2.3's rule, deliberately — deactivation is an admin action and Explorar
  cannot offer to undo something it cannot see.

---

## 2. Deploy — the one blocking item

**Migration `0118_admin_editable_catalogues` must run before deploy.** Four
statements:

```sql
ALTER TABLE "healthcare_specialties" ALTER COLUMN "cnes_id" DROP NOT NULL;
CREATE UNIQUE INDEX "conformity_requirements_name_normalized_uidx" …;
CREATE UNIQUE INDEX "healthcare_providers_name_normalized_uidx" …;
CREATE UNIQUE INDEX "healthcare_specialties_name_normalized_uidx" …;
```

### ⚠️ Run this against production first

The three unique indexes are on `lower(trim(name))`. **If production holds two
rows whose names differ only by case or whitespace, the migration fails and the
deploy stops.**

```sql
select 'payers' t, lower(trim(name)) k, count(*) from healthcare_providers group by 1,2 having count(*)>1
union all select 'specialties', lower(trim(name)), count(*) from healthcare_specialties group by 1,2 having count(*)>1
union all select 'requirements', lower(trim(name)), count(*) from conformity_requirements group by 1,2 having count(*)>1;
```

Empty result ⇒ safe. Anything returned must be renamed before deploying.

**This could not be verified from here.** `atlasmed_prod_snapshot` is 32
migrations stale and holds **0 payers and 0 requirements**, so it says nothing
about production today. Both live scratch databases were clean.

### Other deploy notes

- `cnes_id` keeps a **plain** UNIQUE, not a partial index — a partial index
  cannot be an `ON CONFLICT` arbiter (SQLSTATE 42P10), and a UNIQUE on a
  nullable column already allows unlimited NULLs. Do not "optimise" this.
- This migration was `0117` until `main` shipped its own. It was **regenerated,
  not renamed** — a drizzle snapshot chains to the previous by id, so renaming
  files by hand leaves a dangling `prevId`. Any scratch DB that applied the old
  local `0117` should be rebuilt rather than migrated forward.

---

## 3. Bugs found and fixed along the way

Not features — defects discovered by driving the product, listed because they
say something about where this codebase hides problems.

### Found by walking the screens

| Bug | Cause |
|---|---|
| Competitor list showed `equivalenceCount: 0` for every row while the DB held 42 | Drizzle only qualifies a column reference inside a `sql` template when the query has a join. That one had none, so `where "competitor_product_id" = "id"` resolved `"id"` against the wrong table. Valid SQL, wrong question. |
| Creating a metric crashed the app | `showDialog`'s future completes when the route is *popped*, not when its widgets are gone; the controller was disposed on the next line while a `TextField` still held it. |
| Support-catalogue writes were silent no-ops | Drizzle `insert().values()` keyed by SQL column names instead of TS property names. The type-checker cannot see it. |

### Found by a dedicated QA pass (nine, eight fixed)

Negative prices accepted on both product kinds · any bytes accepted as a
picture (HTML stored and served as `image/png`) · a missing foreign key
reported as "still in use" · two conformity requirements able to share a name ·
no unsaved-changes guard on any form · a disabled "Salvar" that explained
nothing · Família offering every family always · the FAB live on a failed list.
**Not fixed:** deleting a product orphans its stored picture object.

### Found reviewing my own newest code

- **The unsaved-changes guard did not cover a dragged-away sheet.** `PopScope`
  governs the ✕ and the back gesture, not a modal sheet dragged down. Fixed with
  `enableDrag: false` / `isDismissible: false`.
- **The CNPJ blocker on reactivation could silently find nothing.** It searched
  the deactivated list with `limit: 1` and picked its own row out of the result,
  which failed whenever another row sorted ahead. Replaced with a direct
  `findActiveCnpjHolder` lookup.

---

## 4. Data-safety review — can an admin break the app through the panel?

Traced every panel write to its consumers. **No, and here is why**, so nobody
has to redo it:

- **The one destructive cascade is unreachable.** `product_potential_definitions`
  cascades to `facility_product_usage` and `facility_metric_snapshots` — deleting
  a metric would destroy recorded field quantities. The panel's "Remover" is a
  **soft delete**, so it can never fire.
- **Deleting cannot dangle.** All five FKs to `products` are accounted for: four
  counted by the delete check, `product_verticals` deliberately excluded (it
  cascades and belongs to the product). Same for `conformity_requirements`.
- **Deactivating never rewrites history.** `isActive` appears **zero times** in
  the metric snapshot store. Proved by deactivating a product with 649 order
  items, 18 equivalences and a metric link: every rep-facing read 200, comparison
  rows unchanged, order still renders the full product name.
- **Every catalogue follows one pattern**: the *picker* filters `isActive`, the
  *assignment read* does not. So deactivating removes the option going forward
  and leaves existing records intact. Verified empirically for **fontes
  pagadoras** (seeded a 100% share, deactivated the payer, share came back
  identical) and **especialidades** (deactivated one carried by 1155 doctors; the
  professionals list still shows it; picker went 66 → 65). Code-verified only for
  focos clínicos, papéis and conselhos — identical query shape.
- **Compatibility**: Elysia *strips* unknown body fields rather than rejecting,
  so released app builds still sending `pictureUrl` get 200. Extra JSON keys are
  ignored by the Dart models, so adding `facility.deactivated` is safe.
- **Authorization**: every panel write 403s for a REP, tested with a live token.

---

## 5. Deactivation of a clinic — what it does now

Asked to confirm this was coherent. The metrics were; **four things were not**,
three now fixed:

1. **The clinic stayed in the search index.** Approving a "desativar" suggestion
   called `softDelete` and nothing else, so the clinic kept appearing in Explorar
   while every DB read treated it as gone. `DELETE /facilities/:id` had always
   removed the document; the path a reviewer actually uses never did. **Fixed.**
2. **The nightly metric sweep recomputed deactivated clinics forever.** **Fixed.**
3. **The agenda kept dead visits silently.** The appointment is *not* removed — a
   rep's commitment is not ours to erase — but the clinic now carries a
   `deactivated` flag through `CalendarEventRecord` so the agenda can say why the
   row will not open. **Data plumbed; the UI banner is not built** (see §6).
4. **Reactivation was unreachable.** **Fixed** — that is §4.8.

---

## 6. What still needs doing

| # | Item | Why it matters |
|---|---|---|
| 1 | **Run the duplicate-name query against production** (§2) | Blocks deploy |
| 2 | **Merge PR #310** | Nothing else can build on it |
| 3 | **Agenda banner for a deactivated clinic** | The API now sends `facility.deactivated`; no mobile UI consumes it yet, so the dead-visit case is still silent to the rep |
| 4 | **`calendar_editor_screen.dart:501` dialog-controller crash** | Same bug fixed in Métricas, still live in a rep-facing flow. Task chip exists; own branch |
| 5 | Deleting a product orphans its picture object | A few kilobytes; belongs with a storage sweep |
| 6 | `atlasmed_prod_snapshot` is 32 migrations stale | It made me wrongly report `conformity_requirements` as empty once; it will mislead the next person |
| 7 | Spec §9 deferrals: Linhas CRUD, `person_facility_classifications` | Only if wanted |
| 8 | **`product_group` is NULL on every OWN product but one** | Família suggestions therefore fall back to product names. The UI now behaves, but if Família is meant to group variants someone must populate it — a data call |

### Known and accepted, not to be "fixed" by accident

- **Reactivating a clinic leaves its metric snapshots stale until the nightly
  run**, because deactivated clinics are excluded from the sweep. Correct by
  morning.
- **Unlinking an equivalence makes recorded competitor quantities stop counting**
  toward that metric. They are not deleted and relinking restores them (spec 0013
  §4.6, "dormant"). The confirmation dialog says so.
- **The scope-enforcement audit gives no signal on `/facilities/deactivated` and
  `/facilities/:id/reactivate`.** It only asserts a *file* mentions
  `assertResourceInScope`. Those two are deliberately unscoped — a deactivated
  clinic sits in no territory — and are gated on `delete FACILITY`, which only
  ADMIN holds. Tested with a REP token: 403.

---

## 7. Test environment

Everything is torn down. To bring it back:

- API: `cd apps/api && bun src/app/server.ts` (`.env` points at
  `postgresql://postgres:postgres@localhost:5434/atlasmed_admin16_dev`)
- Simulator: `AtlasMed Admin16` = `D04A00EA-66A3-4368-B55C-C6D0ECAAB803`
- Build: `fvm flutter build ios --simulator --debug --dart-define-from-file=/tmp/config.admin16.json`
  — **without the dart-define the app talks to production**
- Admin login: `admin@atlasmed.com.br` / `Admin16!verify` (dev copy only)
- Login endpoint is `POST /api/v1/session/` with `identifier`, not `email`

Dev DB left at: 19 deactivated clinics · 54 products · 66 active specialties ·
5 requirements · 0 payer shares. A rep account's password hash was changed for a
permission test and has been invalidated (`!qa-invalidated-3`).

## 8. Verification at handoff

API **1620 pass** · mobile **739** · temporal **199** · `tsc`, `eslint`,
`dart format`, `drizzle-kit check` all clean · working tree clean · PR mergeable.
