# Spec 0016 — Administração (the admin CRUD surface)

**Status:** Draft (2026-08-15) — §10 questions answered 2026-08-15, decisions folded in
**Depends on:** spec 0013 (potencial de mercado — products, metrics, equivalences) · spec 0010
(verticals & profiles) · spec 0014 §6 (Equipe, the drawer precedent)
**Relates to:** `AGENTS.md` § `apps/web — REMOVED` — "entity CRUDs go in `apps/mobile`"

---

## 1. What this is

One drawer destination, **Administração**, that is the single place an ADMIN maintains the
reference data the rest of the product depends on: the Linhas, our products, the other brands,
which of theirs is equivalent to which of ours, the metrics, and which of our products count
toward each metric.

It is not a new capability. Almost every write it needs already exists on the API, and several of
the screens already exist in the Flutter app. **What does not exist is a way in.**

### 1.1 The finding that motivates it

`/catalog` — `CatalogHomeScreen`, the admin product list with edit, "gerenciar concorrentes" and
the potential-definitions admin behind it — **is unreachable from the running app.** It is a root
route with no entry point:

| route | screen | reachable from |
|---|---|---|
| `/catalog` | `CatalogHomeScreen` (admin list, create/edit product, manage competitors) | `CatalogTabBar` only, which is rendered *by* `/catalog` and `/catalog/price-index` |
| `/catalog/potential-definitions` | `PotentialDefinitionsAdminScreen` (metric CRUD + product links) | `catalog_home_screen.dart:166` — i.e. `/catalog` |
| `/catalog/price-index` | `CatalogPriceIndexScreen` | `CatalogTabBar` — i.e. `/catalog` |
| `/products` | `ProductsHomeScreen` — **read-only**, drawer branch 9 | the drawer |

`appNavigationItems` (`app_shell.dart:448`) lists `Produtos → /products`. Nothing anywhere in
`lib/` navigates to `const CatalogHomeRoute()` except the tab bar inside the section itself
(`catalog_widgets.dart:714`). So the whole administrative half of the catalogue is dead UI in the
same shape spec 0013 §6 already called out for `ClinicProductsSection`.

That single fact reframes the work: **this is mostly an information-architecture change plus a
small number of genuine API gaps**, not a green-field admin build. Building new screens without
first wiring or retiring the existing ones would produce a second product-editing surface able to
disagree with the first.

### 1.2 The second finding — `metric_units` has no writer

Spec 0013 §4.2 states, verbatim: *"Required of the admin UI (not yet built): an editable
`metric_units` per product… This is the only place the value can come from."*

Confirmed still true. `products.metric_units` appears in the schema, in read queries and in tests.
It appears in **no** request body and **no** use case. Every product sits at the `0082` default of
`1.000`.

**Decision 2026-08-15: it stays that way.** `metric_units` remains an informative field — displayed
in the panel, never editable, no write path added. That closes what would otherwise have been this
spec's one blocking question; §7.1 records the trap it avoids.

---

## 2. Inventory — every entity an ADMIN could plausibly CRUD

Audited across `packages/database/src/schema/public/*`, `apps/api/src/modules/*/infrastructure/routes/*`
and `apps/mobile/lib/features/*`. "API" is what exists today; "UI" is what is reachable today.

### 2.1 In scope — the catalogue the user named

| Entity | Table | API today | UI today | This spec |
|---|---|---|---|---|
| Linha (business vertical) | `business_verticals` | `GET`/`POST`/`PATCH /business-verticals` | none | **deferred** (§9) — Linhas are near-static and `code` is immutable |
| Our product | `products` (`ownership = OWN`) | `GET`, `GET /:id`, `POST`, `PATCH` | `CatalogHomeScreen` + `VariantFormScreen` (orphaned) | **rehome + fix payload + delete (§6.2)** |
| Competitor product | `products` (`ownership = COMPETITOR`) | `GET`, `GET /:id`, `POST`, `PATCH /competitor-products` | `CompetitorFormScreen` (reachable only via orphan) | **rehome + list screen + delete (§6.2)** |
| Equivalence (competitor relationship) | `product_equivalences` | `GET /products/:id/competitors/unlinked`, `POST /products/:id/competitors`, `DELETE /products/:id/competitors/:cid` | `ManageCompetitorsScreen` (orphaned) | **rehome — from our product only** (§6.5) |
| Metric (potential definition) | `product_potential_definitions` | `GET`/`POST`/`PATCH`/`DELETE /potential-definitions`, `GET /:id/products`, `GET /:id/competitor-products` | `PotentialDefinitionsAdminScreen` (orphaned) | **rehome + rebuild** |
| Product ↔ metric link | `product_potential_links` | `PUT /products/:id/potential-definition`, `DELETE /products/:id/potential-definitions/:definitionId` | inside the orphan above | **rehome, both directions** |
| Product ↔ Linha | `product_verticals` | folded into product `POST`/`PATCH` as `verticalIds` | inside `VariantFormScreen` | **set at creation, immutable after** (§6.7) |
| Fonte pagadora | `healthcare_providers` | `GET` (read FACILITY), `POST`/`PATCH` (CATALOG) | picker only, in `edit_payer_sources_screen.dart` | **new screen** — creating a new one is a stated requirement |

### 2.2 In scope — the lookups with no write path

`docs/architecture/current.md:95` already records these as "populated manually". Each is a
picker somewhere in the app that an ADMIN cannot extend without a `psql` session.

| Entity | Table | API today | This spec |
|---|---|---|---|
| Especialidade médica | `healthcare_specialties` | `GET /healthcare-specialties` (read PERSON) | **new write path + screen** |
| Foco clínico | `clinical_focuses` | `GET /facilities/clinical-focuses` | **new write path + screen** |
| Papel pessoa–clínica | `person_facility_roles` | `GET /person-facility-roles` | **new write path + screen** |
| Conselho profissional | `person_professional_registration_councils` | `GET` | **new write path + screen** |
| Classificação pessoa–clínica | `person_facility_classifications` | none found | deferred — §9 |

### 2.3 Out of scope — already has its own destination

Named explicitly so the panel does not become a second way to do them.

| Entity | Where it lives | Why not here |
|---|---|---|
| Users, invitations, grants | `Equipe` (`/team`, spec 0014 §6) + `/users` | Equipe is deliberately "the one place people are listed" (`app_shell.dart:490`) |
| Territories, manager zones, patches | `Territórios` (`/territories`) | spatial editing, spec 0009 |
| Territory types | `/territory-types` — `POST`/`PATCH` exist, admin-gated, **no UI** | belongs to Territórios, not the catalogue. Flagged, not built here |
| Facilities, persons | `Explorar` | operational data, not reference data |
| ~~Conformity requirements~~ | — | **Moved in scope** — see §4.7. Seeded by migration `0089` and frozen there, because nothing can write it |
| CNES lookups (`unit_types`, `occupations`, …) | — | mirrors of an official catalogue; a human-editable copy of CNES is a divergence waiting to happen |
| Roles | `roles` table, `GET /roles` | `AGENTS.md` § `packages/access`: roles are enum-typed and stable; adding one is a code change |

---

## 3. Navigation

### 3.1 The drawer item

```dart
AppNavigationItem(
  branchIndex: 12,
  label: 'Administração',
  route: '/admin',
  icon: Icons.tune_rounded,
  visibleFor: isAdmin,
)
```

**Appended, never inserted.** `routes.dart:263` already carries the rule and the reason: a
branch's position *is* its `branchIndex`, so slotting a branch mid-list silently renumbers every
branch after it. `TeamBranch` is 11; `AdminBranch` is 12. Display order in the drawer is decided
by the order of `appNavigationItems`, which is separate — place `Administração` **last**, below
`Produtos`, because it is a maintenance destination rather than daily work.

### 3.2 Role gate

`visibleFor: isAdmin` — the existing `role_capabilities.dart:113` helper. Not `canManageCatalog`
(same predicate today, but the panel is wider than the catalogue and the two should be free to
diverge).

Client visibility is not security (`AGENTS.md` § `packages/access`). Every route the panel calls
is already `requirePermission`-gated; the new ones in §5 must be too.

### 3.3 Shape: a hub, not a mega-form

`/admin` renders a **sectioned list of destinations**, each pushing a focused screen on the root
navigator. Rationale: the drawer is a flat list of ~10 branches and a second flat list of ~12
entity screens inside it would be unreadable; and a tabbed shell would put unrelated entities one
swipe apart.

```
/admin                                   Administração (hub)
├── /admin/produtos                      Produtos            → detail → editar
│     └── (product detail)               ├─ Equivalências    (competitor relationships)
│                                        └─ Métrica          (link to one metric per Linha)
├── /admin/concorrentes                  Produtos concorrentes
├── /admin/metricas                      Métricas            → detail (products in, brands derived)
├── /admin/fontes-pagadoras              Fontes pagadoras
└── /admin/catalogos                     Catálogos           → especialidades · focos clínicos ·
                                                               papéis · conselhos
```

The hub groups these under three headings: **Catálogo comercial** (Produtos, Concorrentes,
Métricas), **Clínicas** (Fontes pagadoras), **Catálogos de apoio** (the §2.2 four).

Linhas are absent by decision, not oversight — see §9. The hub is built so a `Linhas` row drops
into the first group later without rearranging anything.

### 3.4 What happens to `/catalog`

`/catalog`, `/catalog/potential-definitions` and `/catalog/price-index` are **retired as
administrative surfaces**:

- `/catalog` → deleted. `CatalogHomeScreen`'s admin affordances (create product, edit product,
  manage competitors) move to `/admin/produtos`; its browse affordances already exist at
  `/products`.
- `/catalog/potential-definitions` → deleted; replaced by `/admin/metricas`.
- `/catalog/price-index` → **kept and rehomed to `/price-index`.** The Brasíndice/Simpro table is a
  *rep-facing* reference (`read CATALOG`, available to REP and MANAGER), not admin data. It becomes
  the second route of the **Produtos shell branch**, so it is a peer tab of `/products` with the
  drawer available on both, and `CatalogTabBar` moves with it.

  Not `/products/price-index`: `/products/:familyId` parses its segment as an `int` and would
  capture it — the same trap `facilities.route.ts:1004` documents for `clinical-focuses`.
- `/catalog/comparison/:variantId` → **kept, path moved** to `/products/:variantId/comparativo`
  (two segments, so no collision with `/products/:familyId`). It is reached from
  `ProductDetailScreen` and `VariantInfoCard` and is rep-facing; only its prefix had to leave the
  retired tree.

Deleting a route that nothing links to is safe by inspection; deleting one a *deep link* may
target is not. These are in-app go_router paths with no external link surface, so the risk is
bookmark-shaped and accepted. Any test asserting on them must be updated in the same PR, not
deleted (see `clinic_detail_loading_test.dart:108` in spec 0013 §6 for the failure mode).

---

## 4. Screens

Common shape for every list screen, so twelve screens are one pattern and not twelve:

- `AtlasAppBar(page: '<Entity>')`, a search field, a flat list, a `+` FAB.
- Each row: primary label, one line of secondary detail, and a state chip when the entity has an
  active/inactive flag.
- Tapping a row opens an edit form (bottom sheet for ≤4 fields, pushed screen otherwise) —
  matching the existing split between `PotentialDefinitionsAdminScreen`'s dialogs and
  `VariantFormScreen`'s full screen.
- **Inactive rows are listed by default**, dimmed and chipped `Inativo`, with a filter to hide
  them. The rest of the app filters inactive out; the panel is the one place you go *because*
  something is inactive and you want it back. A default that hides them makes reactivation
  undiscoverable.
- Every mutation shows a `SnackBar` on failure carrying the API's message
  (`CatalogApiException.message`), never a generic string. The panel is where a constraint
  violation is most likely and most diagnosable.

### 4.1 Linhas — not built

`business_verticals` gets no screen. Linhas are near-static, `code` is immutable, and the two that
exist were created once. Where a Linha must be picked (product creation, metric creation) the panel
reads `GET /business-verticals` and renders a picker — no editing.

The one change that follows anyway is a route narrowing, not a screen: `PATCH /business-verticals/:id`
accepts `code` today and must stop (§5.1).

### 4.2 Produtos (`/admin/produtos`)

Lists `ownership = OWN`, active and inactive together. Filters: Linha, state, search.

Full CRUD: create, read, update, deactivate, and delete under the conditions in §6.2.

**Tapping a row opens the edit page**, not an intermediate sheet. The first build reused the
rep-facing quick-view sheet — a read-only copy of the first screenful of the form, with an
"editar" button inside it. On the admin panel that is a tap that buys nothing: the one thing to do
with a row here is edit it. The links the sheet carried (produtos concorrentes, comparativo de
preços, the family's Brasíndice/Simpro publication dates) moved into the page.

**Detail screen** — three sections:

1. **Dados** — every editable column, grouped: identity (`name`, `code`, `brand`, `description`),
   codes (`simproCode`, `brasindiceCode`, `tissCode`, `barcode`, `ncm`, `anvisaRegistration`,
   `commercialCode`, `idProdutoEmultec`), classification (`productGroup`,
   `productClassification`, `internalClassification`, `manufacturer`, `countryOfOrigin`,
   `requiresSterilization`), pricing (`price`, `price17`, `price18`, `price20`,
   `brasindiceUpdatedAt`), unidades (`unit`, plus `metricUnits` **read-only**), Linhas
   (`verticalIds`, **editable only while creating** — §6.7), state (`isActive`), and the
   **imagem** (see below).
2. **Equivalências** — the competitor products linked to this one, add/remove. This is
   `ManageCompetitorsScreen`, rehomed; the "add" sheet keeps its current shape (pick from
   unlinked, or create a competitor inline via `CompetitorFormScreen`).
3. **Métrica** — for each Linha the product belongs to, which metric it counts toward
   (`PUT /products/:id/potential-definition`, `DELETE …/:definitionId`). One metric per Linha is a
   schema invariant (`product_potential_links_product_vertical_key`), so this renders as one
   picker per Linha, not a multi-select.

**The picture is uploaded, not typed.** `products.picture_url` and `picture_blurhash` have existed
since the Emultec import with no way to fill them: the column was writable through
`PATCH /products/:id` as a bare string, which only helps someone who already has a URL.

- `POST /products/:id/picture` — multipart, field `picture`, JPEG/PNG/WebP up to 5 MB. Stores the
  object, derives the blurhash from the bytes, writes both columns.
- `DELETE /products/:id/picture` — clears both and deletes the object.
- `GET /products/pictures/*` — serves the bytes behind `read CATALOG`, because the bucket is
  private and a signed URL would expire inside a page the admin left open.

`pictureUrl` is **removed** from the product request body as part of this. It names an object this
API stores, so as a free-text field it let a product point anywhere on the internet, and the
blurhash beside it is derived rather than typed — the two are written together or not at all.

One picture, not a gallery: the schema has one column, and a product is a thing with one
representative image. Facilities have a gallery because a clinic is a place you photograph from
several angles.

It saves **on selection**, not on "Salvar" — it is a separate endpoint and a separate object, and
a picture lost because the admin backed out over an unrelated field is worse than one saved a
moment early. A product being created has no id to hang an object off yet, so the section says so
rather than accepting a file it would silently drop.

`metricUnits` renders as a **read-only** row with a helper line naming the unit from the linked
metric's label — *"1 unidade deste produto equivale a N ampolas/mês"* — because the number is
meaningless without it. It is informative, per spec 0013 §4.6 and the 2026-08-15 decision, and no
write path exists for it in either the API or the form. §7.1 records why.

### 4.3 Produtos concorrentes (`/admin/concorrentes`)

Lists `ownership = COMPETITOR`, active and inactive together. Create, edit, deactivate, and delete
under §6.2. Same form as ours minus the fields that are ours by definition: no `price` (spec 0013
§2 — we do not sell it), no `code` requirement.

Tapping a row opens its edit form directly — a row has one thing to do, so an intermediate action
sheet buys nothing.

**Equivalences are not editable here.** They are written in one direction only: from our product
to the competitor's, in `ManageCompetitorsScreen` (§4.2). A draft of this spec offered the reverse
as a second entry point; it was removed on the product owner's call. An equivalence is a statement
about one of *our* products ("this is what competes with it"), and two places to make the same
statement is how the two come to disagree.

Each row still shows **how many of our products it is equivalent to**, because a competitor
product equivalent to nothing is one a rep cannot record quantities for (spec 0013 §7 —
"competitor products not equivalent to any of our products are unreachable"). Finding those by
opening every row in turn is not a workflow, so the list says it; the fix is made on our product.

### 4.4 Métricas (`/admin/metricas`)

`product_potential_definitions`, scoped to a Linha (the list requires `verticalId`).

- Create (`label`; `key` auto-derived, the current route already makes it optional), rename,
  soft-delete.
- Detail shows two lists:
  - **Nossos produtos** — from `GET /potential-definitions/:id/products`. Add/remove links here
    as well as from the product side.
  - **Outras marcas que contam** — from `GET /potential-definitions/:id/competitor-products`,
    **read-only and labelled as derived.** Spec 0013 §4.6 is explicit that there is no screen,
    route or use case linking a competitor to a metric and there should not be: it would be a
    second list able to disagree with the first. The panel must therefore render it as an
    *answer*, not a form — and say why, next to it, so the absent "+" reads as a decision rather
    than an omission.

**A destructive-action warning belongs on unlink.** Spec 0013 §4.6: unlinking a product from a
metric stops every recorded competitor quantity for it counting, at every clinic, and the rows go
dormant rather than being deleted. The confirmation must say that, and must not claim the data is
deleted.

### 4.5 Fontes pagadoras (`/admin/fontes-pagadoras`)

`healthcare_providers` — `name`, `type` (`PRIVATE` | `PUBLIC` | `MIXED` | `OTHER`), `isActive`.
Create, edit, deactivate. No delete: rows are referenced by
`facility_healthcare_provider_shares`.

### 4.8 Clínicas desativadas (`/admin/clinicas-desativadas`)

The one screen here that touches **operational** data, against §2.3's rule that
facilities live in Explorar. The exception is deliberate: deactivation is an
admin action, and Explorar cannot offer to undo it because Explorar cannot see
a deactivated clinic at all.

Deactivation is a soft delete — `facilities.deactivated_at` is set and the
Meilisearch document removed — and it was **one-way in practice**. The
repository already had a `reactivate` method; nothing called it, and nothing
could, because no read in the product returns a deactivated row: `findById`
filters them, every list filters them, and Explorar reads the search index they
were removed from. Reactivating meant knowing an id the product could not tell
you.

So this needs a read path of its own:

| Route | Notes |
| --- | --- |
| `GET /facilities/deactivated` | Newest first, searchable by name/CNPJ/CNES |
| `POST /facilities/:id/reactivate` | Clears `deactivated_at`, re-indexes for search |

**Gated on `delete FACILITY`**, not `update`. Only ADMIN holds it — MANAGER and
REP are denied it explicitly. `update FACILITY` is the intuitive choice and is
wrong, because every rep holds that in order to edit clinic fields; the first
draft used it and a rep could both list and reactivate.

**Unscoped, deliberately.** A deactivated clinic has no live vertical profile,
so it belongs to no territory and no rep. Narrowing the list by the caller's
scope would return nothing on every call.

**A CNPJ can block reactivation.** `facilities_active_legal_document_cnpj_uidx`
is unique among *active* rows, so another clinic may have taken the number while
this one was away. The list computes that up front and the row says
"CNPJ em uso por outra clínica" instead of letting the admin discover it by
pressing the button.

### 4.7 Requisitos de cadastro (`/admin/requisitos`)

`conformity_requirements` — the documents the cadastro asks each clinic for.
Added after the fact: §2.3 deferred it to spec 0011, and it was pulled back in on
request.

Migration `0089` seeds five (`identidade`, `crm`, `comprovante_endereco`,
`carta_cnpj`, `licenca_sanitaria`), scoped to Ortopedia. There is **no write
path**, so the catalogue is frozen at whatever that migration seeded: adding a
sixth document, narrowing one to CPF-only, raising a size limit or retiring one
all take a migration today. This screen makes it data instead of schema.

- Create, edit, deactivate, and delete under §6.2 (both referencing FKs are
  `RESTRICT`).
- **`slug` is chosen once**, derived from the name when omitted, and absent from
  the update contract. It is the key every cadastro DTO travels under; renaming
  it would orphan anything that had learned it. Verified first that no production
  code branches on a slug *value*.
- **Scope is first-class.** `verticalId` null means every Linha,
  `appliesToLegalDocumentType` null means CNPJ *and* CPF. The form states the
  reach in one line rather than leaving it to be inferred.
- **Activation is confirmed.** An active requirement is immediately missing from
  every clinic in scope — one save moves the conformity of the whole base — so
  creating an active one, or switching an inactive one on, asks first and offers
  "save inactive" as the alternative. Editing an already-active one does not
  re-ask; the dialog fires on the transition, or it becomes noise.

This is the widest-reaching write in the panel. Everything else in §4 changes what
an admin sees; this changes what every clinic owes.

### 4.6 Catálogos de apoio (`/admin/catalogos`)

One screen, four segments, one list pattern:

| Segment | Table | Fields |
|---|---|---|
| Especialidades | `healthcare_specialties` | `name`, `isActive` (+ CNES code if present) |
| Focos clínicos | `clinical_focuses` | `name`, `cnesCode`, `isActive` |
| Papéis pessoa–clínica | `person_facility_roles` | `name`, `isActive` |
| Conselhos | `person_professional_registration_councils` | `name`/`acronym`, `isActive` |

Grouped rather than given four drawer-level destinations: each is a handful of rows, edited
rarely, and four near-identical screens in the hub would bury the catalogue work above them.

---

## 5. API work

The panel is mostly wiring. These are the real backend changes.

### 5.1 `POST /products` and `PATCH /products/:id` contradict the schema

The route (`catalog.route.ts:134`) requires `code`, `simproCode`, `brasindiceCode`, `tissCode`
and `brasindiceUpdatedAt` as non-null strings. Spec 0013 §2 made all five **nullable on purpose**,
precisely so the Emultec importer would stop inventing `EMULTEC-SIM-{id}` values to satisfy a
constraint that guaranteed a string rather than a code.

The migration landed; the route did not follow. Today an admin creating a product by hand is
forced to invent exactly the synthetic codes the spec removed.

Required:

| Field | Now | Change |
|---|---|---|
| `code`, `simproCode`, `brasindiceCode`, `tissCode` | required `String` | `Optional(Nullable(String))` |
| `brasindiceUpdatedAt` | required `String` | `Optional(Nullable(String))` |
| `price` | required `Number` | `Optional(Nullable(Number))` — null for COMPETITOR per schema comment |
| `metricUnits` | absent | **stays absent.** Informative field, no writer — §7.1 |
| `brand`, `unit`, `barcode`, `description`, `productGroup`, `productClassification`, `internalClassification`, `commercialCode`, `ncm`, `anvisaRegistration`, `requiresSterilization`, `idProdutoEmultec` | absent | added, all optional |
| `ownership` | absent | **not added** — §6.1 |
| `verticalIds` on `PATCH` | `Optional(Array, minItems 1)` | **removed from `PATCH`** — §6.7 |

Partial-unique indexes already enforce uniqueness-when-present, so relaxing the route relaxes
nothing at the database.

Also narrowed here: `PATCH /business-verticals/:id` drops `code` from its body (§4.1).

### 5.2 Write paths for the §2.2 lookups

Four new route groups, each `POST` + `PATCH` (no `DELETE` — §6.2), each following the module
layout in `AGENTS.md` § `apps/api`: use case → repository port → Drizzle repository →
`composition.ts` → route.

| Route | Subject | Module |
|---|---|---|
| `POST`/`PATCH /healthcare-specialties` | `CATALOG` | `person` |
| `POST`/`PATCH /clinical-focuses` | `CATALOG` | `facility` |
| `POST`/`PATCH /person-facility-roles` | `CATALOG` | `person` |
| `POST`/`PATCH /person-professional-registration-councils` | `CATALOG` | `person` |

**Reads stay on their current subject** (`read PERSON` / `read FACILITY`) — a rep needs the
picker. **Writes go on `CATALOG`**, which only ADMIN holds (`role.permissions.ts:23`). This is the
same asymmetry `listHealthcareProvidersRoute` already documents at `catalog.route.ts:192`, and it
is the reason `CATALOG` is the right subject rather than a new one: the panel edits reference data,
which is what `CATALOG` already means here.

Each new route must be added to `route-security.manifest.ts` and, where it takes a scope, to
`scope-enforcement.manifest.ts`. These lookups are global, not scoped — state that explicitly in
the manifest rather than omitting them.

### 5.3 Counts the hub and lists need

Rendering "3 produtos" next to a Linha, or "equivalente a 2 dos nossos" next to a competitor,
must not be N+1 client calls.

- `GET /competitor-products` → add `equivalenceCount`.
- `GET /products` → add `verticalIds` and `linkedDefinitionIds` (already needed by §4.2's detail;
  cheaper as one aggregate than per-row fetches).
- `GET /products` and `GET /competitor-products` → accept `isActive` omitted meaning *both*, which
  they already do, and must keep doing now that the panel lists both by default.

Vertical counts are dropped along with the Linhas screen.

### 5.4 Deletion

Two new endpoints, both guarded as described in §6.2:

| Route | Behaviour |
|---|---|
| `DELETE /products/:id` | 409 with a structured reason when the product is referenced; hard-deletes otherwise |
| `DELETE /competitor-products/:id` | same rule, against `facility_product_usage` and `product_equivalences` |

The reference check runs **inside the same transaction as the delete**, not as a prior read — a
check-then-delete pair races an order landing between the two, and the referencing tables'
foreign keys are `restrict`/`cascade` in ways that would either fail opaquely or take field data
with them.

`GET /products/:id` gains a `deletable: boolean` + `blockingReferences` summary so the UI can
disable the action rather than offer it and fail.

---

## 6. Decisions

### 6.1 `ownership` is chosen by the endpoint, never by a field

`products.ownership` distinguishes ours from theirs and is load-bearing: composite foreign keys
pin `order_items` to `OWN` and `facility_product_usage` to `COMPETITOR` (spec 0013 §2.1). A form
field that flips it would let an admin turn a product with orders against it into a competitor,
and the failure would surface as a foreign-key error from a screen that had no business offering
the choice.

So: `POST /products` creates `OWN`, `POST /competitor-products` creates `COMPETITOR`, and neither
`PATCH` accepts the column. The panel expresses the distinction as **two destinations**, which is
also how an admin thinks about it.

The two endpoints stay separate for the same reason, even though spec 0013 §2 merged the tables.

### 6.2 Delete only what nothing references; otherwise deactivate

Products and competitor products get a real delete, per the 2026-08-15 decision that the panel
CRUDs products. It is conditional, and the condition is not a policy — it is what the schema
already enforces.

A product may be **hard-deleted only when nothing references it**: no `order_items`, no
`facility_product_usage`, no `product_equivalences` on either side, no `product_potential_links`.
That is the "created it by mistake, wrong name, wrong Linha" case, which is the case an admin
actually needs delete for.

When anything does reference it, the panel **refuses and offers deactivation instead**, naming
what blocks it — *"3 pedidos e 1 equivalência"*. Not a warning to click through: the FK topology
makes both alternatives unacceptable. `product_equivalences` and `product_verticals` cascade, so a
forced delete would silently drop equivalences a rep's picker depends on; `facility_product_usage`
is `restrict`, so it would fail opaquely mid-transaction. And spec 0013 §4.1 is explicit that
field-collected data is never invalidated by a catalogue edit.

Everything else in §2.1 and §2.2 — fontes pagadoras, especialidades, focos clínicos, papéis,
conselhos — is **deactivate-only**. Each is referenced by operational rows by design, each already
carries `isActive`, and none has a "created by mistake" volume worth a delete path. Metrics keep
their existing soft delete (`deleted_at`, via `DELETE /potential-definitions/:id`).

So: a trash can on products and competitor products, disabled with a reason when blocked; a state
toggle everywhere else.

### 6.3 The panel is ADMIN-only, single-role

No partial admin. MANAGER holds `read CATALOG` and will keep seeing the read-only `/products`;
they do not see `/admin` at all. If a "catalogue editor" role is ever wanted it is a new role in
`packages/access`, coordinated across consumers in one PR (`AGENTS.md` § `packages/access`) — not
a per-screen exception here.

### 6.4 One editing surface per entity

The orphaned `/catalog` tree is retired rather than left in place (§3.4). Two product-editing
screens reachable by different paths is exactly the drift spec 0013 §2 dismantled at the schema
level; reintroducing it at the UI level would be worse, because nothing would flag it.

### 6.5 A relationship has one editor, on the side that owns the statement

An earlier draft of this section had equivalences editable from both entities — "two views of one
row, never two rows". The product owner rejected it: *"we should not link produtos concorrentes to
our products, we link our products to produtos concorrentes."*

So each relationship gets exactly **one** editor, on the entity the statement is about:

| Relationship | Edited from | Not from |
| --- | --- | --- |
| Equivalence | our product (§4.2) | the competitor product (§4.3) |
| Metric link | our product / the metric (§4.4) | competitor products — spec 0013 §4.6 forbids it outright |

The other side may still **display** the relationship (a count, a read-only list) — that is an
answer, not a form. One editor is not a limitation to work around; two editors for one row is how
the two come to disagree, and nothing in the schema would flag it.

### 6.6 What the panel does not compute

The panel never triggers a recompute of anything. Spec 0013 §4.6 backlogs the catalogue-change
fan-out explicitly: linking, unlinking or editing a product changes the answer for every clinic
holding orders or usage for it, recompute is per-profile, and there is no fan-out. Those clinics
are corrected by the nightly pass.

**The panel must say so.** After a link or unlink, the confirmation reads *"Os números das clínicas
são atualizados no próximo processamento noturno."* Silence here is how an admin concludes the
edit did not work and does it again.

### 6.7 A product's Linhas are set once and never moved

`verticalIds` is chosen at creation and is not editable afterwards. `PATCH /products/:id` stops
accepting it (§5.1) and the form renders it read-only once the product exists.

Moving a product between Linhas is not a rename — orders key on `facility_vertical_profile_id`
(spec 0010 §4) and `product_potential_links` is unique per `(product, vertical)`, so re-verticalising
a product with history silently changes which profiles its sales join to and orphans its metric
link. There is no correct automatic answer, and a warn-and-proceed dialog just relocates the
mistake.

The escape hatch, when it is genuinely needed, is deactivate-and-recreate: it keeps the old rows
attached to the old product, which is what actually happened.

---

## 7. Risks

### 7.1 `metric_units` stays informative — and here is what that avoids

**Resolved 2026-08-15: informative field, no writer, no UI.** The section stays because the reason
is a live inconsistency in the code, and the next person who reaches for "just make it editable"
needs to find this.

Spec 0013 §4.6 demoted `metric_units` to an information field: the calculation uses **raw**
quantities, which is safe "only while every product in a metric is measured in the same unit…
all 54 products carry `metric_units = 1.000`, so the multiplier is already a no-op".

Two things follow.

**First, the code does not agree with itself.** In `packages/database/src/queries/metric-snapshot-store.ts`:

- `sumOurs` (L66) sums `order_items.quantity` **raw**, with a comment citing §4.6.
- `sumOursByProduct` (L305) sums `order_items.quantity * products.metric_units`.

`sumOurs` produces the total the rep sees; `sumOursByProduct` produces the per-product breakdown
beneath it, added by the 2026-08-12 amendment specifically so "both lists now sum to the total
above them". **They stop summing to the total the moment any product's `metric_units ≠ 1`** —
which is precisely what this panel would enable. Today it is invisible because every value is 1.

**Second, the competitor side never multiplies at all** (`listTheirs`, L103 — raw `quantity`), so
a real `metric_units` on our side would inflate our share against an unscaled denominator.

Therefore: **`metric_units` is read-only in the panel and gains no write path.** Every value stays
at `1.000`, the multiplier stays a no-op, and the divergence above stays latent rather than live.

Two consequences to keep visible:

- **The inconsistency is still a defect**, just an unreachable one. `sumOursByProduct` should be
  reconciled to `sumOurs` (drop the multiplication) so the two agree by construction rather than by
  the accident of every row holding 1. Small, safe, changes no number today — worth doing, not
  worth blocking this spec on. Filed as a §9 item.
- **The catalogue must stay uniform in unit.** Nothing enforces it (spec 0013 §7 says so outright).
  A box of five entered as one product with `metric_units` left at 1 understates our side exactly
  as it does today. The panel does not fix that and must not appear to: the read-only field is
  labelled as information, not as a setting someone forgot to enable.

Making it writable later means amending spec 0013 §4.6 and picking one of two consistent answers —
multiply on both sides, or on neither — not adding a form field.

### 7.2 An admin can create a product no rep can reach

`GET /products` applies scope and role (`catalog.route.ts:75`). A product created without
`verticalIds` — or in a Linha the admin does not intend — is invisible to the reps who need it and
contributes nothing to any metric. The product form must require at least one Linha (the current
route already enforces `minItems: 1`) and the list must show the Linhas per row so the mistake is
visible without opening anything.

**§6.7 raises the stakes on this**: Linhas cannot be corrected afterwards, so the creation form is
the only chance to get it right. It gets an explicit confirmation step naming the Linhas before the
product is created, and the field is the one place in the panel where a wrong value costs a
recreate rather than an edit.

### 7.3 The Emultec dead-letter queue is the admin's inbound work and has no surface

Spec 0013 §5: an order line referencing an unknown `id_produto_emultec` dead-letters the **whole
order** into `ops.emultec_order_import_dead_letters`, and "the DLQ becomes the admin's signal:
*this product exists in Emultec and not here — register it*".

There is no API and no screen for it. So the loop the spec describes is open: the importer parks
orders and nobody is told. This is real revenue not landing.

Not built here — it is an ops surface over an `ops.*` table, not catalogue CRUD, and bolting it on
would widen this spec past what can be reviewed in one pass. Flagged as §9 and worth its own
spec; the Administração hub is the obvious home for it when it exists.

### 7.4 Retiring `/catalog` touches tests

`VariantFormScreen`, `ManageCompetitorsScreen` and `CompetitorFormScreen` are moved, not
rewritten. Any widget test that mounts them through `/catalog`, and the mobile widget-test traps
already known to this repo (viewport width, empty role catalogue, repo timers, snackbar timing),
apply. Update assertions; do not delete tests to make a route change green.

---

## 8. Delivery

Each phase is independently mergeable and leaves the app working. Build notes and the
screen-by-screen test guide live in [`implementation.md`](./implementation.md).

| Phase | Contents | Why this order |
|---|---|---|
| **P1** ✅ | `AdminBranch` (12), `/admin` hub, `Administração` drawer item, `/admin/produtos` + `/admin/concorrentes` + `/admin/metricas` — mostly by **rehoming** the existing screens. `/catalog` retired; price index → `/price-index`; comparativo → `/products/:id/comparativo`. Métricas gained the derived-brands list and the unlink confirmation. | Zero API changes. Turns dead code into reachable product on day one, which is the largest single win available |
| **P2** ✅ | §5.1 — product payload aligned to the schema, `verticalIds` off `PATCH`, `code` off vertical `PATCH`. Full product form with read-only `metricUnits` and a real Brasíndice date picker. Inactive rows listed in both admin lists. Fixed five live defects, including a `POST /competitor-products` that answered 422 for every brand. | Unblocks creating a product without inventing codes |
| **P3** ✅ | §5.4 — conditional delete for products and competitor products, and `deletable` on the detail read | Needs P2's form to have somewhere to put the action |
| **P4** ✅ | `/admin/fontes-pagadoras`, §5.3 counts | Existing endpoints, new screen |
| **P5** ✅ | §5.2 — **three** of the four lookup write paths + `/admin/catalogos`. `healthcare_specialties` is held back: `cnes_id` is `NOT NULL UNIQUE` and it mirrors the official CBO list, so a create form needs a schema decision first (§10) | The only phase adding backend surface area; last because nothing else waits on it |

---

## 9. Deferred

- **Linhas CRUD** (§4.1). Near-static data, `code` immutable, two rows in production. Drops into
  the hub's first group when there is a reason.
- **Reconciling `sumOursByProduct` with `sumOurs`** (§7.1). Drop the `metric_units` multiplication
  so the breakdown and the total agree by construction. Changes no number today. Not this spec's
  code, but this spec found it.
- **Emultec DLQ review surface** (§7.3). Needs its own spec; the hub is its future home.
- **Territory types CRUD** — `POST`/`PATCH /territory-types` exist, admin-gated, with no UI. Belongs
  to Territórios.
- **`person_facility_classifications`** — no endpoint found in either direction; needs a read path
  before a write path.
- **Bulk import / CSV** — the catalogue is ~54 products. A bulk path is a validation surface with
  its own failure modes and no current demand.
- **Audit trail in the UI.** `audit.audit_logs` exists; who changed a product and when is not
  surfaced anywhere. Wanted eventually, not a v1 blocker.
- **CNES lookup editing** — deliberately never.

---

## 10. Questions, answered 2026-08-15

| # | Question | Answer | Lands in |
|---|---|---|---|
| 1 | `metric_units` — reinstate the multiplication, or drop it? | Neither. Leave it as an **informative field**; no write path, no editable UI | §1.2, §4.2, §5.1, §7.1 |
| 2 | Move a product between Linhas after it has orders? | **Forbid.** Set at creation, immutable after. Linhas themselves deprioritised | §6.7, §5.1, §7.2 |
| 3 | List inactive products by default? | **Yes** — and products get full CRUD, delete included | §4 conventions, §4.2, §6.2, §5.4 |
| 4 | `business_verticals.code` immutable? | **Immutable**, and no Linhas CRUD screen at all | §4.1, §5.1, §9 |
| 5 | Label? | **Administração** | §3.1 |
| 6 | Fontes pagadoras — catalogue or clinic data? | **Catalogue.** Creating a new fonte pagadora from the panel is a requirement | §2.1, §4.5 |

### Opened during implementation, answered 2026-08-15

**Q7 — may `healthcare_specialties` be extended locally? → yes.** Its `cnes_id`
was `NOT NULL UNIQUE` and all 66 production rows carry a real CNES id
(223119–225355), so the table mirrored the official CBO list and adding a
specialty meant inventing an official id.

The migration makes `cnes_id` nullable with a partial-unique index — exactly
what spec 0013 §2 did for the product coding columns, for the same reason — plus
a normalised unique index on the name. Especialidades are now the fourth segment
of `Administração › Catálogos`.

**Q8 — should duplicate fonte pagadora names be blocked? → yes.**
`healthcare_providers` had no uniqueness at all, so *Unimed* could be registered
twice with no warning, splitting a clinic's payer mix across two identical-looking
rows. Same migration adds `healthcare_providers_name_normalized_uidx`.

Both were checked against production data before the indexes were written: zero
duplicate specialty names, and `healthcare_providers` is empty.

### Still open

Two judgement calls made in the absence of an answer, flagged for veto:

1. **Delete is conditional, not absolute** (§6.2). "CRUD products" is read as *delete what nothing
   references, deactivate what something does* — because a delete that cascades would drop
   equivalences a rep's picker depends on, and spec 0013 §4.1 forbids a catalogue edit invalidating
   field data. If unconditional delete is genuinely wanted, that is a different decision and it
   needs the cascade behaviour designed rather than inherited.
2. **Competitor products get the same delete rule** as ours, by symmetry. Not asked about directly.
