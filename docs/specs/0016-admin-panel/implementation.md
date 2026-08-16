# Spec 0016 — implementation log & test guide

Companion to [`requirements.md`](./requirements.md). One section per phase: what
changed, where, and **how to test it on screen**. Written as the work lands, so a
section exists only once its phase is merged-ready.

Branch: `claude/admin-panel-crud-6a3c9f`.

---

## Phase 1 — the way in (navigation only)

**Shipped:** `Administração` in the drawer, an `/admin` hub, three entity screens
behind it, and the retirement of the unreachable `/catalog` tree. **No API
changes.** Behaviour of the screens themselves is unchanged except where noted
under Métricas.

### What moved

| Before | After | Note |
|---|---|---|
| `/catalog` → `CatalogHomeScreen` | `/admin/produtos` → `AdminProductsScreen` | file renamed via `git mv`, class renamed |
| `/catalog/potential-definitions` → `PotentialDefinitionsAdminScreen` | `/admin/metricas` → `AdminMetricsScreen` | renamed; detail screen rebuilt (below) |
| `/catalog/price-index` | `/price-index` | **not** admin — rep-facing, moved into the Produtos shell branch |
| `/catalog/comparison/:variantId` | `/products/:variantId/comparativo` | rep-facing, unchanged otherwise |
| — | `/admin` → `AdminHomeScreen` | new hub |
| — | `/admin/concorrentes` → `AdminCompetitorProductsScreen` | new list screen |

`/catalog` no longer exists in any form.

### Files touched

| File | Change |
|---|---|
| `apps/mobile/lib/features/admin/presentation/screens/admin_home_screen.dart` | **new** — the hub |
| `apps/mobile/lib/features/catalog/presentation/screens/admin_products_screen.dart` | renamed from `catalog_home_screen.dart`; app bar now `Produtos`, tab bar and the metrics shortcut removed |
| `apps/mobile/lib/features/catalog/presentation/screens/admin_metrics_screen.dart` | renamed from `potential_definitions_admin_screen.dart`; labels updated; detail screen rebuilt |
| `apps/mobile/lib/features/catalog/presentation/screens/admin_competitor_products_screen.dart` | **new** — competitor list |
| `apps/mobile/lib/features/catalog/presentation/screens/products_home_screen.dart` | gained the `CatalogTabBar` |
| `apps/mobile/lib/features/catalog/presentation/widgets/catalog_widgets.dart` | `CatalogTabBar` now targets `/products` and `/price-index` |
| `apps/mobile/lib/router/routes.dart` | `AdminBranch` (12) + `/admin`, three admin routes, `PriceIndexRoute`, `/catalog` tree deleted |
| `apps/mobile/lib/router/routes.g.dart` | regenerated (`build_runner`) |
| `apps/mobile/lib/shared/widgets/app_shell.dart` | `Administração` nav item |
| `apps/mobile/test/router/typed_routes_smoke_test.dart` | 2 new tests |
| `apps/mobile/test/shared/widgets/app_shell_test.dart` | 1 new test |

### Two routing traps, and what was done about them

1. **`/price-index` is not `/products/price-index`.** `/products/:familyId`
   parses its segment as an `int`, so a nested path would be captured and fail
   to parse. This is the same trap the API documents at `facilities.route.ts:1004`
   for `clinical-focuses`. It lives in the Produtos *shell branch* instead, so
   the drawer is available on both tabs and the tab bar switches without leaving
   the branch.
2. **`/products/:variantId/comparativo` is two segments**, so it cannot collide
   with `/products/:familyId`. Asserted in `typed_routes_smoke_test.dart`.

### Behaviour change inside Métricas

The metric detail screen (products linked to one metric) gained what spec 0013
§4.6 and 0016 §4.4 require and it did not have:

- a second, **read-only** section, *"Outras marcas que contam"*, from
  `GET /potential-definitions/:id/competitor-products`, with a paragraph saying
  it is derived and where to change it. There is deliberately no "+" here.
- **a confirmation before unlinking a product**, stating that the product stops
  counting at every clinic and that recorded quantities are kept, not deleted.
- a snackbar after link/unlink: *"Os números das clínicas são atualizados no
  próximo processamento noturno."* (spec 0013 §4.6 backlogs the fan-out.)

### Testing Phase 1 on screen

Sign in as **ADMIN** unless a step says otherwise.

**1 · The drawer**
- Open the drawer. `Administração` is the **last** entry, below `Produtos`,
  with a tune/sliders icon.
- Tap it → the hub. The drawer's active dot moves to `Administração`.
- Sign in as **MANAGER**, **REP** and **OPS** in turn: the entry is absent for
  all three. (`Produtos` stays visible for admin, manager and rep.)

**2 · The hub (`/admin`)**
- Heading `Administração`, subtitle, one section — `CATÁLOGO COMERCIAL` — and
  three cards: `Produtos`, `Produtos concorrentes`, `Métricas`.
- Leading control is the **hamburger** (it is a shell branch, so the drawer is
  one tap away).

**3 · Produtos (`/admin/produtos`)**
- Flat list of every product, one row per presentation, price on the right.
- Leading control is a **back arrow** (pushed over the shell) → returns to the hub.
- Search narrows by name; the filter button opens family / manufacturer / country.
- `Novo produto` FAB opens the create form.
- Tap a row → quick-view sheet with `Ver comparativo`, `Editar`, and
  `Gerenciar outras marcas`.
- `Ver comparativo` lands on `/products/<id>/comparativo` — check the URL shape
  if you can, since it moved.
- **There is no longer a metrics shortcut in this app bar** — Métricas is on the hub.

**4 · Produtos concorrentes (`/admin/concorrentes`)** — new screen
- List of competitor brands: name, `marca · fabricante` beneath, ICMS-20 price.
- Search narrows by name, brand or manufacturer.
- `Nova marca` FAB → the competitor form → on save, a snackbar `<nome> registrado`
  and the row appears without a manual refresh.
- Tap an existing row → the same form prefilled → save → `<nome> atualizado`.
- ⚠️ **Known limit of this phase:** the list is active-only, and there is no
  delete and no equivalence editor here yet (P2/P3).

**5 · Métricas (`/admin/metricas`)**
- Linha dropdown at the top; the list reloads on change.
- `Nova métrica` FAB; the row menu offers `Editar label`, `Produtos vinculados`,
  `Remover`.
- Open a metric → **two sections**:
  - `NOSSOS PRODUTOS` — linked products, each with an unlink button; `+` in the
    app bar links another product of the same Linha.
  - `OUTRAS MARCAS QUE CONTAM` — derived, read-only, with the explanatory
    paragraph. **Confirm there is no add button here.** If the metric has no
    linked products, or none of them has an equivalence, it reads *"Nenhuma
    outra marca equivalente aos produtos acima"*.
- Tap unlink → a dialog naming the product and the metric, saying quantities are
  kept. Cancel → nothing happens. Confirm → the row goes and the nightly-recompute
  snackbar appears.
- Pull to refresh reloads both sections.

**6 · Produtos, rep-facing (`/products`)** — sign in as **REP**
- The family list now shows a segmented control: `Produtos` | `Tabela Brasíndice`.
- Tap `Tabela Brasíndice` → the full price index, **with the drawer still
  available** (hamburger, not a back arrow). Tap `Produtos` to return.
- Flipping between them repeatedly must not stack screens: the device back
  button should leave the section, not walk back through tabs.
- A rep must not be able to reach `/admin` — there is no link, and the API
  refuses the writes regardless.

**7 · Nothing points at `/catalog`**
- Search the app for any route that still opens it: there should be none. The
  old admin catalogue is reachable **only** through `Administração` now.

### Automated coverage

```bash
cd apps/mobile && fvm flutter test test/router/typed_routes_smoke_test.dart test/shared/widgets/app_shell_test.dart
```

- `Administração is admin-only and pinned to branch 12` — label, index, all four
  roles, and that it is last in the list.
- `Administração routes resolve to their locations`.
- `the price index and the comparativo left the retired /catalog tree` — including
  the two collision assertions.

Full suite at the end of this phase: **692 passing, 0 failing**;
`fvm flutter analyze` clean.

### Accepted gap: `/admin` has no route guard

The drawer entry is hidden from non-admins, but the routes themselves are not
guarded — a deep link to `/admin/produtos` as a REP would render the screen. Every
write behind it answers 403 (`requirePermission("create"/"update", "CATALOG")`),
and the reads are `read CATALOG`, which a REP holds anyway, so nothing leaks that
`/products` does not already show.

This matches how `/users` and `/profile` are handled — branch and route alive,
drawer entry gone. `AgendaRouteGuard` is the precedent for the other choice; if a
guard is wanted here it is one wrapper, not a redesign.

### Deliberately not in this phase

- Listing inactive rows by default (0016 §4 conventions) — needs `isActive` on the
  product/competitor DTOs, which is P2's payload work.
- The full product form, `metricUnits` display, immutable `verticalIds` — P2.
- Delete — P3.
- Fontes pagadoras, the four support catalogues — P4/P5.

---

## Phase 2 — the product write contract

**Shipped:** the API stops requiring codes it made nullable, twelve more columns
become editable, Linhas become immutable after creation, `metricUnits` becomes
visible and stays unwritable, and the admin lists show inactive rows.

Three live defects were found and fixed on the way; they are called out below
because each produced data rather than an error.

### API

| File | Change |
|---|---|
| `application/interfaces/product.repository.interface.ts` | `ProductRecord` gains `internalClassification`, `barcode`, `ncm`, `anvisaRegistration`, `requiresSterilization`, `idProdutoEmultec`, `metricUnits`. New `ProductWritableFields` / `CreateProductInput` / `UpdateProductInput` — one place that says what an admin may set |
| `infrastructure/repositories/drizzle/drizzle-product.repository.ts` | reads and writes the new columns; `update` no longer takes `verticalIds`; **`price: String(data.price)` fixed** |
| `application/use-cases/catalog.use-cases.ts` | `serializeProduct` takes `ProductRecord` and emits the new fields; `CreateProductUseCase` rejects an empty `verticalIds`; `UpdateProductUseCase` cannot forward Linhas; `UpdateBusinessVerticalUseCase` drops `code` |
| `infrastructure/routes/catalog.route.ts` | `productWritableFields` shared by `POST` and `PATCH`; codes nullable; `verticalIds` create-only; `code` off the vertical `PATCH` |
| `infrastructure/routes/competitor-products.route.ts` | `brasindiceUpdatedAt` optional + nullable on both verbs |
| `…/competitor-product.repository.interface.ts`, `drizzle-competitor-product.repository.ts` | same, down the stack |

**Defect 1 — `POST /products` demanded the codes spec 0013 §2 removed.** The
migration made `code` / `simproCode` / `brasindiceCode` / `tissCode` /
`brasindiceUpdatedAt` nullable *precisely so* the Emultec importer would stop
inventing `EMULTEC-SIM-{id}`; the route kept requiring them, so an admin
registering a product by hand had to invent the same values. Now all nullable.

**Defect 2 — `price: String(data.price)` wrote the literal `"null"`.**
`String(null)` is `"null"`, which Postgres rejects for `numeric`. Unreachable
while `price` was required; reachable the moment §5.1 made it nullable, which is
the same edit. Fixed with a `numericOrNull` helper.

**Defect 3 — creating a competitor product was impossible.**
`POST /competitor-products` required `brasindiceUpdatedAt` as a string and
nothing in the app could supply one — the competitor form has no date field — so
every attempt answered 422. The column is meaningless without a
`brasindice_code` (spec 0013 §2), which no competitor row has. Now optional.
**This means the `Nova marca` button shipped in P1 could not have worked.**

### Mobile

| File | Change |
|---|---|
| `data/models/catalog_variant.dart` | the twelve new fields, `productGroup` read explicitly, `metricUnits`, `copyWith` gains `clear*` companions |
| `data/models/competitor_product.dart` | `isActive` |
| `data/repositories/catalog_repository.dart` | `productRequestBody` extracted to a top-level, testable function; `getFamilies` / `getAllCompetitorProducts` gain `includeInactive`; competitor writes carry `isActive` |
| `presentation/providers/catalog_providers.dart` | `adminCatalogFamiliesProvider`, `adminAllCompetitorsProvider` (inactive included), both invalidated on mutation |
| `presentation/screens/variant_form_screen.dart` | full form; read-only `metricUnits`; Linhas read-only when editing; Brasíndice **date picker**; `Ativo` switch; validation relaxed |
| `presentation/screens/competitor_form_screen.dart` | `Ativa` switch; no longer stamps a Brasíndice date |
| `presentation/screens/admin_products_screen.dart`, `admin_competitor_products_screen.dart` | inactive rows shown, dimmed, with an `Inativo` / `Inativa` chip |

**Two more defects, both in the product form:**

- **`brasindiceUpdatedAt: DateTime.now()` on every save.** The column records
  when the *Brasíndice* record was published; stamping today turned it into
  "when someone last opened this form". Replaced with a date picker that can
  also clear the value.
- **The `Família` field was silently discarded.** The form asked for it, the
  request never sent `productGroup`, and the saved product came back grouped
  under its own name. Now sent.

### Testing Phase 2 on screen

**1 · Register a product with no codes** — `Administração › Produtos › Novo produto`
- Fill only **Nome**, **Fabricante**, **País** and pick at least one **Linha**.
  Leave Código, SIMPRO, BRASÍNDICE, TISS and every price blank.
- `Salvar` must be **enabled** and the save must succeed. Before this phase it
  was disabled, and the API would have refused anyway.
- Reopen the product: the code fields are empty, not `EMULTEC-…` or `""`.

**2 · Linhas are chosen once**
- On **Novo produto**, the Linhas render as selectable chips and at least one is
  required (`Salvar` stays disabled with none).
- On **Editar produto**, the same Linhas render as **plain text** with the
  sentence *"A linha de um produto é definida no cadastro e não pode ser
  alterada…"*. There are no chips and nothing to tap.

**3 · `metricUnits` is visible and dead**
- On any product, section `UNIDADES` shows **Unidades da métrica** with its
  value in a grey box and a note that it is informative and not editable.
- There is no input, no stepper, no way to change it. (Production values are all
  `1`; the test above uses a seeded `5` to prove it is read, not defaulted.)

**4 · The Brasíndice date is the admin's, not the clock's**
- Edit a product with a Brasíndice date. Change only the name and save.
- Reopen: the date is **unchanged**. Before this phase, saving rewrote it to
  today.
- `Escolher` opens a date picker; the `×` clears it back to *Sem data*.

**5 · Família round-trips**
- Create a product with **Família** = `TESTE`. Save, go back to
  `Administração › Produtos`, and confirm it groups under `TESTE` — and that the
  rep-facing `/products` list shows a `TESTE` card rather than one named after
  the product.

**6 · Inactive rows are listed**
- Edit a product, switch **Ativo** off, save.
- `Administração › Produtos` still lists it, dimmed, with an `Inativo` chip.
- The rep-facing `/products` list and the `Tabela Brasíndice` do **not** show it.
- Switch it back on from the same form; it un-dims.
- Same for a competitor brand at `Administração › Concorrentes` (`Inativa`).

**7 · Register a competitor brand** — the P1 button that could not have worked
- `Administração › Concorrentes › Nova marca`, fill nome / fabricante / país /
  three prices, save. It must succeed and appear in the list.
- Confirm it then shows up in a product's `Gerenciar outras marcas` picker.

### Automated coverage

```bash
cd apps/api && bun run test
cd apps/mobile && fvm flutter test
```

API — `catalog.use-cases.test.ts`, new `product write contract` group:
null codes pass through · a product with no Linha is refused ·
`metricUnits` is never written and is reported on read · `update` forwards
neither `verticalIds` nor `productId` · a Linha's `code` is never updated.

Mobile — `product_request_body_test.dart` (new, 7 tests): no `verticalIds`, no
`metricUnits`, blank codes → null, date as `YYYY-MM-DD` and present-but-null when
unset, `productGroup` sent, presentation folded into the name, `isActive` both
ways. `catalog_variant_test.dart` gained 4 tests for the new columns.

Totals after this phase: **API 1557 passing across 186 files**, **mobile 706
passing**; `tsc`, `eslint` and `flutter analyze` all clean.

### Deliberately not in this phase

- Delete — P3.
- Delete on the competitor form — P3.
- Fontes pagadoras — P4. The four support catalogues — P5.

---

## Phase 3 — conditional delete

**Shipped:** `DELETE /products/:id` and `DELETE /competitor-products/:id`, both
refusing while anything references the row and saying what, plus the trash button
on both forms, disabled with a reason.

### The rule, and where each half of it lives

Delete is conditional (spec 0016 §6.2). It is not caution — it is the foreign-key
topology:

- `product_equivalences` **cascades**, so a forced delete would silently drop
  equivalences a rep's picker depends on.
- `facility_product_usage` is **`ON DELETE RESTRICT`**, so it would instead fail
  mid-transaction with an opaque `23503`.
- Spec 0013 §4.1: field-collected data is never invalidated by a catalogue edit.

So a product nothing points at can go; one with orders, recorded quantities,
equivalences or a metric link cannot, and the answer is `isActive = false`.

| Layer | File | What it holds |
|---|---|---|
| SQL | `infrastructure/repositories/drizzle/product-deletion.ts` | `FOR UPDATE` on the row, then the counts, then the delete — one transaction |
| Contract | `application/interfaces/product.repository.interface.ts` | `ProductReferences`, `ProductDeletionOutcome` (three states, not a boolean) |
| Use case | `catalog.use-cases.ts` | `DeleteProductUseCase`, `DeleteCompetitorProductUseCase` → 404 vs 409 |
| Error | `shared/errors/domain-errors.ts` | `ResourceInUseError` (409), carrying `blockedBy` |
| Exposure | `shared/errors/base-error.ts` | `RESOURCE_IN_USE: ["blockedBy"]` on the client-safe allow-list |
| Client | `data/models/product_deletability.dart` | the counts, and the Portuguese label |
| UI | `presentation/widgets/catalog_delete_action.dart` | the button and both dialogs, shared by the two forms |

**Two details that would otherwise be quietly wrong:**

1. **The row is locked before it is counted.** Without `FOR UPDATE`, the check and
   the delete are independent statements, and an order item inserted between them
   is counted as absent and then removed by a cascade nobody chose. With it, the
   concurrent insert blocks on the `FOR KEY SHARE` it needs on the parent.
2. **`blockedBy` had to be allow-listed.** `AppError.toClientJSON` drops `context`
   for any code not in `CLIENT_SAFE_CONTEXT_KEYS`, so without the new entry the
   client would have received `{code, message}` and could only have said "cannot
   be deleted" — a refusal with no next step. Asserted in the use-case test
   against `toClientJSON()`, not against the error object.

`product_verticals` is deliberately **not** counted: a product's Linhas are part
of the product (§6.7), not a reference to it, and counting them would make every
product undeletable, since one cannot be created without a Linha.

### Equivalences stay one-directional (§4.3, §6.5)

This phase originally also shipped the reverse editor: `GET
/competitor-products/:id/products`, a `ManageEquivalentProductsScreen`, and
`findLinkedByCompetitor` / `findUnlinkedByCompetitor` on the repository — open a
competitor product, attach ours. **It was removed before the branch landed**, on
the product owner's call: *"we should not link produtos concorrentes to our
products, we link our products to produtos concorrentes."*

The reasoning holds up. An equivalence is a statement about one of *our*
products, and the write always went through `POST`/`DELETE
/products/:id/competitors` regardless of which screen the admin was standing on;
the second screen only added a second place to make the same statement.

What survives is the **count**: `GET /competitor-products` still returns
`equivalenceCount`, and the list marks a product equivalent to nothing, because
spec 0013 §7 makes that one unreachable in the rep's picker. The row is a
signpost, not a form — the fix is made on our product.

Removed with it: `EquivalentProductSummary`, `ListCompetitorEquivalencesUseCase`,
`equivalent_product.dart`, and `getCompetitorEquivalences` on the mobile
repository.

### Testing Phase 3 on screen

**1 · Delete a product nothing references**
- `Administração › Produtos › Novo produto`, create a throwaway (name +
  fabricante + país + one Linha). Save.
- Reopen it. The app bar now has a **red trash icon**.
- Tap it → a dialog explaining the delete is only possible because nothing
  references it. Confirm → the form closes, a snackbar says `<nome> excluído`,
  and the row is gone from the list.

**2 · Delete is blocked, with the reason**
- Open a product that has orders (any Emultec-imported one).
- The trash icon is **grey and disabled-looking**; long-press shows a tooltip
  naming the blocker.
- Tap it → a dialog: *"Há N itens de pedido no sistema que dependem dele…"*, and
  the instruction to uncheck **Ativo** instead. There is **no "excluir mesmo
  assim"** — confirm that.
- Do that: uncheck Ativo, save, and confirm the product goes dim in the admin
  list and disappears from the rep-facing `/products`.

**3 · Each blocker is named**
- A product linked to a metric (`Administração › Métricas › <métrica> › vincular`)
  but with no orders should report *"1 vínculo com métrica"*, not a generic
  message. Unlink it there and the trash icon becomes available.
- A product with an equivalence reports *"1 equivalência"*. Remove it from
  `Gerenciar outras marcas` and retry.

**4 · Same rule for a brand**
- `Administração › Concorrentes`, tap a brand → `Editar marca`. Trash icon
  behaves identically (`Esta marca não pode ser excluída`).
- A brand a rep has recorded a quantity against must be blocked by
  *"N quantidades registradas"*.

**5 · Equivalences from the brand**
- `Administração › Concorrentes`, tap a brand → the sheet now offers **Editar
  marca** and **Produtos equivalentes**.
- Open `Produtos equivalentes`. With none, it says in red that the rep cannot
  record quantities for this brand while it stays that way.
- `+` in the app bar → picker of our products → pick one → it appears in the
  list.
- Cross-check the other direction: open that product in
  `Administração › Produtos › <produto> › Gerenciar outras marcas` and confirm
  the brand is there. **One row, both screens.**
- Unlink from either side and confirm it disappears from both.

**6 · The 409 race is handled**
- Hard to stage by hand; the code path is `showDeleteFailure`. If a delete ever
  fails with 409 after the button was enabled, the admin sees the same blocked
  dialog rather than a raw error.

### Automated coverage

API — `catalog.use-cases.test.ts`: deletes an unreferenced product · refuses a
referenced one and the counts survive `toClientJSON` · a missing product is 404,
not a refused delete · the detail read carries `deletable` + `blockingReferences`.

API — `product-deletion.db.test.ts` (new, 5 tests, real Postgres): a fresh
product is referenced by nothing · its own Linhas do not block it · an
equivalence blocks **both** sides of it · a metric link blocks it · removing the
blocker makes it deletable again.

Mobile — `product_deletability_test.dart` (new, 6 tests): parses the payload ·
defaults to not-deletable when the field is absent · names each blocker in
Portuguese, singular and plural, in a fixed order · `CatalogApiException` carries
`blockedBy` off a 409 and leaves it empty otherwise.

Totals after this phase: **API 1566 passing across 187 files**, **mobile 712
passing**; `tsc`, `eslint` and `flutter analyze` clean.

### Deliberately not in this phase

- Deleting anything other than products and competitor brands. Everything else in
  §2 is deactivate-only (§6.2) — referenced by design, and with no
  "created by mistake" volume worth a delete path.
- Fontes pagadoras — P4. The four support catalogues — P5.

---

## Phase 4 — Fontes pagadoras

**Shipped:** `/admin/fontes-pagadoras`, and the equivalence count on the
competitor list.

The API already had `GET`/`POST`/`PATCH /healthcare-providers`; this phase is the
screen and one count.

| File | Change |
|---|---|
| `data/models/healthcare_provider.dart` | **new** — the model and a `HealthcareProviderType` enum with Portuguese labels |
| `data/repositories/catalog_repository.dart` | list (with `includeInactive`), create, update |
| `presentation/providers/catalog_providers.dart` | `adminHealthcareProvidersProvider` |
| `presentation/screens/admin_healthcare_providers_screen.dart` | **new** — list + bottom-sheet form |
| `router/routes.dart`, `admin_home_screen.dart` | the route and the hub's second section |
| API `drizzle-competitor-product.repository.ts` | `equivalenceCount` as a subquery on the list read (§5.3) |
| `admin_competitor_products_screen.dart` | *"Sem produto equivalente"* on brands at zero |

**Why the count matters.** Spec 0013 §7 accepts that a brand equivalent to
nothing is unreachable in the rep's picker. Finding those by opening each row in
turn is not a workflow, so the list marks them — and P3's editor is one tap away
to fix it.

`equivalenceCount` is **undefined** rather than `0` on reads that do not compute
it (the comparison table, the picker), so "not asked" and "none" stay
distinguishable. Only the second means a rep is blocked.

### Testing Phase 4 on screen

**1 · The hub grew a section**
- `Administração` now shows `CATÁLOGO COMERCIAL` and `CLÍNICAS`, the second
  holding `Fontes pagadoras`.

**2 · Register a fonte pagadora** — the stated requirement (§10 Q6)
- `Nova fonte` → sheet with **Nome**, **Tipo** (Privado / Público / Misto /
  Outro) and **Ativa** → save → snackbar and the row appears.
- Now open a clinic in `Explorar`, edit its **Fontes pagadoras**, and confirm the
  new entry is offered in the picker. That round trip is the whole point.

**3 · Deactivate one**
- Tap a row, switch **Ativa** off, save. It stays in the admin list, dimmed, with
  an `Inativa` chip — and disappears from the clinic picker.
- There is **no trash can** (§6.2): shares reference these rows.

**4 · Unmapped brands are visible**
- `Administração › Concorrentes`: any brand with no equivalence shows a red
  *"Sem produto equivalente"* line under its name.
- Attach one via `Produtos equivalentes`; the line goes on the next load.

### Automated coverage

Mobile — `healthcare_provider_test.dart` (new, 5 tests): every type the column
allows · an unknown type falls back to `OTHER` instead of throwing · the row
parses · `equivalenceCount` is null when absent and carries zero when present.
`typed_routes_smoke_test.dart` gained the new location.

---

## Phase 5 — the support catalogues

**Shipped:** `/admin/catalogos` with three segments — focos clínicos, papéis na
clínica, conselhos — and the API writes behind them.

`docs/architecture/current.md` recorded these as having "no write path in code"
and being "populated manually". That line is now false for three of the five it
named, and the doc is updated.

### One implementation, not three

| File | What it is |
|---|---|
| `shared/catalog/simple-catalog.ts` | the `SimpleCatalogRepository` port, a Drizzle factory over any `(id, name, is_active, extra?)` table, and three use cases |
| `shared/catalog/simple-catalog.route.ts` | `POST` + `PATCH` for one catalogue. **Writes only** |
| `shared/catalog/support-catalogs.ts` | the three concrete instances |
| `modules/person/index.ts` | mounts the two person-side write route groups |
| `modules/facility/…/facilities.route.ts` | mounts the clinical-focus writes, and adds `includeInactive` to the existing read |
| `modules/person/…/person-facility-roles.route.ts`, `…-councils.route.ts` | `includeInactive` on the existing reads |

**The reads did not move.** Each catalogue already had a `GET` on its own subject
— `read PERSON`, `read FACILITY` — because a rep needs the picker, and those stay
exactly where they were. Only the writes are new, on `create`/`update CATALOG`,
which only an ADMIN holds. The reads gained one optional `includeInactive=true`,
which the admin screen sets and no picker does.

### Two bugs the tests caught before they shipped

1. **`insert().values()` was keyed by SQL column names.** The factory built its
   payloads from `column.name` — `is_active`, `cnes_code` — but Drizzle keys
   those by the schema's *property* names, `isActive`, `cnesCode`. Anything it
   does not recognise is dropped silently: the statement ran, the row came back,
   and the field was simply unchanged. `name` is the one column where the two
   spellings coincide, which is why it appeared to work. Fixed by deriving the
   property key from `getTableColumns`. **Found by `simple-catalog.db.test.ts`,
   not by the type-checker** — this is the "succeeds and does nothing" shape
   `AGENTS.md` opens with.
2. **A `PATCH` with an empty body would have 500'd.** `UPDATE … SET` with no
   assignments is a syntax error, not a no-op. It now returns the row unchanged.

### One thing the route-security audit caught

Adding the factory failed `route-security.registry.test.ts` twice — once for a
file it did not know about, once because it wrote its auth default in a shape the
audit does not recognise. Both were fixed by conforming (a defaulted
`authPlugin: typeof auth = auth` second parameter, matching every other factory
here), **not** by widening the audit.

### `healthcare_specialties` is not one of the three — open question

The spec listed four support catalogues; three shipped. `healthcare_specialties`
has `cnes_id NOT NULL UNIQUE`, and all 66 production rows carry a real CNES id in
the 223119–225355 range — it is a mirror of the official CBO list, like the
`unit_types` / `occupations` tables §2.3 excluded from editing on purpose.

Giving it a create form means one of two things, and both are decisions rather
than implementation details:

- a migration making `cnes_id` nullable with a partial-unique index — exactly
  what spec 0013 §2 did for the product coding columns, for exactly the same
  reason; or
- accepting that it stays CNES-only and is never locally extended.

Nothing was invented in the meantime, and the absence is asserted in
`support_catalog_test.dart` so it cannot be filled in by accident.

### Testing Phase 5 on screen

**1 · The third hub section**
- `Administração` → `CATÁLOGOS DE APOIO` → `Catálogos`.
- Segmented control: **Focos clínicos | Papéis na clínica | Conselhos**.
  Switching segments reloads the list; switching back is instant (each is cached
  per catalogue).

**2 · Focos clínicos** — optional second field
- `Novo foco clínico` → **Nome** required, **Código CNES (opcional)** blank →
  save. Reopen: the code field is empty, and saving a second one with a blank
  code must also succeed (they store as `null`, not `""` — two `""` would
  collide on the unique index).
- Now go to `Explorar`, open a clinic's clinical focuses, and confirm the new
  focus is offered.

**3 · Conselhos** — required second field
- `Novo conselho`: **Salvar** stays disabled until both **Nome** and **Sigla**
  are filled. That mirrors `abbreviation` being NOT NULL.
- Save a duplicate sigla deliberately: the API's unique violation must surface as
  a message in the sheet, not a silent failure.

**4 · Papéis na clínica** — no second field
- The form shows only **Nome** and **Ativo**.
- Create one, then open a clinic's professional roster and confirm the new role
  is offered when assigning a role.

**5 · Deactivate and reactivate**
- Switch **Ativo** off on any entry. It stays in this list marked `Inativo`, and
  disappears from the picker in the rest of the app.
- Switch it back on from the same sheet.
- No trash can anywhere in this screen (§6.2).

**6 · Especialidades are absent**
- Confirm there is no fourth segment. That is deliberate — see the open question
  above.

### Automated coverage

API — `simple-catalog.db.test.ts` (new, 5 tests, real Postgres): creates with the
optional column and trims it · a blank second column stores as `null` · rename +
deactivate, and the two list reads differ accordingly · an empty `PATCH` returns
the row instead of failing · a missing row returns null and creates nothing.

Mobile — `support_catalog_test.dart` (new, 4 tests): blank `extra` reads as
absent · each catalogue points at the endpoint that exists · only the councils
require their second field · specialties are deliberately not among them.

Totals after this phase: **API 1572 passing across 188 files**, **mobile 721
passing**; `tsc`, `eslint` and `flutter analyze` clean.

---

## Safety audit — what an admin can break

Asked after P5: *can any of these CRUDs break the system if someone messes with
them?* Every claim below was checked against the code, not assumed.

### Verified safe

| An admin does this | Why it does not break anything |
|---|---|
| Deactivates a product that has orders | `metric-snapshot-store.ts` contains **no `isActive` filter at all**, so every clinic's `ours`, `theirs`, total and share stay exactly as they were. Existing `order_items` are untouched |
| Deactivates a fonte pagadora in use | `drizzle-facility-healthcare-provider-share.repository.ts` does not filter provider `isActive`, so the clinic's payer mix still renders with its name and percentage |
| Deactivates a role, focus or council in use | The roster resolves them by `INNER JOIN … ON r.id = a.role_id`, with no active filter — an assignment made under a since-retired role still displays |
| Deletes a product or brand | Refused while anything references it, under a `FOR UPDATE` lock taken before the counts (§6.2) |
| Unlinks a product from a metric | Confirmed first, and the rep's recorded quantities are kept, not deleted — relinking restores them |
| Tries to move a product between Linhas | Not offered, and `PATCH` does not accept `verticalIds` (§6.7), so orders cannot be re-keyed |
| Tries to change `metricUnits` | No writer anywhere (§7.1), so the `sumOurs` / `sumOursByProduct` divergence stays unreachable |
| Tries to turn a product into a competitor | `ownership` is chosen by the endpoint, never a field (§6.1) — a product with orders cannot cross the composite FK |
| Soft-deletes a metric | Reads filter `deleted_at`; usage rows and snapshots survive |

### Was broken — fixed in this pass

**Every constraint violation came back as `500 An unexpected error occurred.`**
The global handler mapped `AppError`, `HttpError`, validation and parse failures,
then fell through to a generic 500 for everything else — and a Postgres
constraint is "everything else".

So an admin who typed a SIMPRO code that already existed, or a second clinical
focus called *Ortopedia*, or a duplicate council sigla, was told the system had
failed. Nothing said what to change, and the panel's error surfacing (§4) had no
message worth showing.

`shared/errors/database-constraint.ts` now maps the SQLSTATEs a caller can
actually cause:

| SQLSTATE | Was | Now |
|---|---|---|
| `23505` unique violation | 500 | **409** `RESOURCE_CONFLICT` |
| `23503` foreign key violation | 500 | **409** `RESOURCE_IN_USE` |
| `23514` check violation | 500 | **400** `CONSTRAINT_VIOLATION` |
| `23502` not-null violation | 500 | **400** `CONSTRAINT_VIOLATION` |

It reads the code off the error or off the error Drizzle wrapped it in, and
**never sends the constraint name to the client** — that names our indexes, and
`toClientJSON` drops context by default. The name still reaches the logs.

This closes it for every write in the panel: duplicate `code`, `simproCode`,
`brasindiceCode`, `tissCode`, `idProdutoEmultec`, focus name, council
abbreviation, role name — and for the delete race the §6.2 guard cannot close.

Covered by four new tests in `app.error-handler.test.ts`, including one asserting
the index name does not appear in the response body.

### Known, still open

1. **A wrong `idProdutoEmultec` is silent.** The unique constraint stops it
   colliding with another product, but nothing stops an admin typing a valid,
   unused id that belongs to a different Emultec product — after which imported
   order lines attach to the wrong product. The field carries an explanatory
   note; it has no verification against Emultec.
2. **Deactivating every product in a Linha empties the reps' lists.** No guard,
   and arguably correct — that is a legitimate business action, not a mistake.

---

## Phase 6 — migration `0117`, from the two answered questions

Two answers required schema changes; both landed in one migration.

```
packages/database/drizzle/0117_admin_editable_specialties_and_unique_payers.sql
```

Three statements, and **the unique constraint is not one of them**:

| Statement | Why |
|---|---|
| `healthcare_specialties ALTER COLUMN cnes_id DROP NOT NULL` | **Q7 answered "allow adding our own".** The column made the table a mirror nobody could extend |
| `CREATE UNIQUE INDEX healthcare_specialties_name_normalized_uidx` | Two specialties with the same name are a mistake however they got there, and the panel can now create one by hand |
| `CREATE UNIQUE INDEX healthcare_providers_name_normalized_uidx` | **Q8 answered "block duplicates".** The table had no uniqueness at all |

`healthcare_specialties_cnes_id_key` is **untouched**. A plain `UNIQUE` on a
nullable column already allows unlimited NULLs in Postgres, so it keeps refusing
two rows that claim the same official CNES id while letting any number of
locally-created specialties coexist without one. See the investigation below for
why that matters more than it looks.

Both new unique indexes were checked against the production snapshot first:
**zero duplicate specialty names, and `healthcare_providers` is empty** — the
panel is the first thing that will ever populate it. Normalised on
`lower(trim(name))`, matching `person_facility_roles`, because the duplicate
someone actually creates is `"Unimed "`, not a second byte-identical string.

⚠️ **Before deploying:** a unique index fails loudly if production holds a
duplicate the snapshot did not. That is the correct behaviour — a duplicate
specialty name is a data error someone must resolve — but check first rather than
discover it in a deploy log.

### The regression this nearly shipped — and why the fix is the schema, not the caller

The first version of this migration replaced the unique **constraint** with a
**partial** unique index (`UNIQUE … WHERE cnes_id IS NOT NULL`), copying the form
`products.code` uses. That broke `cnes-import.db.test.ts` with SQLSTATE `42P10`:

> there is no unique or exclusion constraint matching the ON CONFLICT specification

Postgres cannot infer a partial index as an `ON CONFLICT` arbiter unless the
statement repeats the predicate. The obvious fix is to make every caller write
`on conflict (cnes_id) where cnes_id is not null`.

**That fix was wrong, and it was reverted.** The partial form bought nothing here:

```sql
-- plain UNIQUE on a nullable column, verified against Postgres 
INSERT INTO t (cnes_id, name) VALUES (NULL,'a'), (NULL,'b');  -- INSERT 0 2 ✅
INSERT INTO t (cnes_id, name) VALUES (7,'x');                 -- ok
INSERT INTO t (cnes_id, name) VALUES (7,'y');                 -- 23505 ✅
```

NULLs are distinct under a plain `UNIQUE`, so it already allows unlimited
locally-created specialties *and* still refuses two rows claiming the same
official id — the exact behaviour the partial index was reached for, minus the
`ON CONFLICT` breakage.

The distinction matters because of what this table is. `healthcare_specialties`
is a CNES mirror; an upsert keyed on `cnes_id` is its natural shape, and the day
someone automates that sync they will write `on conflict (cnes_id) do update`.
A constraint that silently turns that into a runtime 42P10 is a trap laid for a
future author, and "document the workaround" is a worse answer than "do not lay
the trap". `products.code` keeps the partial form because nothing upserts on it.

`0117` was local and unmerged, so it was deleted and regenerated rather than
stacked on: the test database was dropped, rebuilt from the full chain, and
re-migrated. The result is three statements that never touch the constraint.

Locked in by `simple-catalog.db.test.ts` → *"ON CONFLICT (cnes_id) still works on
specialties"*, which asserts the second insert is **skipped** rather than merely
not erroring.

### The sweep that made the claim checkable

The first write-up asserted "only a test fixture used that constraint — no
production code did". That was based on one narrow grep, so it was re-checked
properly:

| Checked | Result |
|---|---|
| Every raw `insert into healthcare_specialties` / `healthcare_providers`, across **all 16 worktrees** | One hit: the `cnes-import.db.test.ts` fixture, identical in every worktree because it is on `main`. No production writer, and no migration seeds these tables either — which is exactly why the panel exists |
| Every Drizzle `healthcareSpecialties` reference | All reads: selects and joins in the search index, the professional repository and the person repository |
| Every raw `ON CONFLICT` in the repo, resolved to its table | The `(cnes_id)` ones target `registry.professionals`, `registry.occupations` and `registry.professional_councils` — different tables, untouched |
| Every Drizzle `onConflict*({ target })` cross-referenced against the **32 partial unique indexes** in the database | None targets a partial index. The one place code does — `person_facilities` — already repeats its predicate, so the pattern was known |
| Migration numbering across every branch | `main` is at `0116`; no branch holds a `0117`. No collision |

So the bug class is not latent anywhere else, and the claim now rests on a sweep
rather than on one grep.

### What changed in the panel

- `Administração › Catálogos` now has **four** segments, `Especialidades` first.
  The strip scrolls horizontally — four labels do not fit a phone width.
- A specialty's **ID CNES** is optional. Imported ones show theirs; a new one has
  none, and that absence is what distinguishes them.
- `extra` is normalised to a **string** on the way out even though `cnes_id` is a
  `bigint`, so one client model covers all four catalogues. Text that is not a
  whole number is refused rather than stored as null.
- Creating a second fonte pagadora called *Unimed* now answers **409** with
  "A record with this value already exists." — which works because of the
  constraint mapping added in the audit above. The two changes need each other:
  without the mapping this would have been a 500.

### Testing Phase 6 on screen

**1 · Add a specialty CNES does not list**
- `Administração › Catálogos › Especialidades › Nova especialidade`.
- Fill only **Nome**, leave **ID CNES (opcional)** blank → save. Do it again with
  a different name → also saves. (Under the old schema neither was possible.)
- Open a doctor and confirm the new specialty is offered in the picker.
- Type `12a` into **ID CNES** → the save is refused with a message, not stored
  blank.

**2 · Duplicate names are refused**
- Create a specialty named the same as an existing one → **409** with a message
  in the sheet, not a spinner and not "unexpected error".
- Same for `Administração › Fontes pagadoras`: create *Unimed*, then *unimed* —
  the second is refused.

**3 · Nothing else moved**
- The 66 imported specialties still show their `ID CNES`.
- A doctor's existing specialties still display.

### Automated coverage

`simple-catalog.db.test.ts` grew three tests: a specialty is creatable without a
CNES id **twice** · a CNES id round-trips as a string despite the bigint column ·
a non-numeric CNES id is refused rather than dropped.

---

## Phase 7 — Requisitos de cadastro

**Shipped:** `/admin/requisitos` — CRUD over `conformity_requirements`, the
catalogue of documents the cadastro asks each clinic for.

Deferred in §9 on the grounds that spec 0011 owns the cadastro pipeline, then
pulled back in on request.

> ⚠️ **Correction.** An earlier draft of this section claimed the table was
> **empty in production**. It is not. That reading came from
> `atlasmed_prod_snapshot`, which is at **86** applied migrations against the
> chain's **118** — thirty-two behind, and three short of the migration that
> seeds this very table. Counting rows in a snapshot without checking its
> migration level is the same "green is not evidence" trap `AGENTS.md` opens
> with, and it produced a confident, wrong number.

**What is actually there.** `0089_cadastro_requirement_catalog.sql` seeds five
requirements — `identidade`, `crm`, `comprovante_endereco`, `carta_cnpj`,
`licenca_sanitaria` — scoped to Ortopedia, at the column defaults (10 files,
50 MB each, 200 MB combined, jpeg/png/pdf). So cadastro *does* ask for documents.

That does not change why this CRUD is worth having, only the claim made for it:
the catalogue is **frozen at whatever 0089 seeded**. There is no write path, so
adding a sixth document, narrowing one to CPF-only, raising a size limit or
retiring one all require a migration today. This screen is what makes it data
instead of schema.

One interaction worth knowing: 0089 carries a guard that *refuses to run* if
active requirements exist outside its five, to avoid two overlapping catalogues.
It is a one-time migration and already applied everywhere, so a requirement added
through this panel cannot trip it — but an environment rebuilt from migrations
plus a partial data restore could, and the error message names the offending
slugs.

### The widest-reaching write in the panel

An **active** requirement is immediately missing from every clinic in scope. One
save moves the conformity of the whole base. Three things follow:

1. **Scope is first-class in the form.** `verticalId` (null = every Linha) and
   `appliesToLegalDocumentType` (null = CNPJ *and* CPF) sit in their own section
   with the sentence *"Quanto mais amplo, mais clínicas passam a ter uma
   pendência."* The model exposes `scopeLabel` so the reach is one line, not an
   inference.
2. **Activating is confirmed, not just saved.** Creating an active requirement —
   or switching an inactive one on — opens a dialog naming the scope and offering
   the alternative: save it inactive and turn it on deliberately.
3. **Editing an already-active requirement is not re-confirmed.** The dialog
   fires on the transition, not on every save, or it becomes noise people click
   through.

### `slug` is chosen once

It is the key every cadastro DTO travels under — `document.requirement.slug`
reaches the mobile app — so renaming it would silently orphan anything that had
learned it. Set at creation (derived from the name when omitted:
*Licença Sanitária* → `licenca_sanitaria`), and absent from
`ConformityRequirementWritableFields`, so `PATCH` cannot carry it even by
accident. The form shows it greyed out when editing, with the reason.

Verified first: **no production code branches on a slug value** — they appear as
data in DTOs and as fixtures in tests, never as a literal in a condition.

### Delete follows §6.2

Both referencing foreign keys — `conformity_records.requirement_id` and
`submission_documents.requirement_id` — are `ON DELETE RESTRICT`, so this is the
same conditional delete as products: a requirement no clinic has answered can go;
one with submissions refuses and names them. The row is locked with `FOR UPDATE`
before the counts, so a clinic submitting mid-delete cannot decide the outcome.

### Files

| File | Change |
|---|---|
| `application/interfaces/conformity.repository.interface.ts` | `ConformityRequirementWritableFields` (no `slug`), references + deletion-outcome types, four new methods |
| `infrastructure/repositories/drizzle/drizzle-conformity.repository.ts` | `findAllRequirements`, create, update, `deleteRequirementIfUnanswered` — on the class, using the injectable `database` |
| `application/use-cases/conformity.use-cases.ts` | admin serializer, `includeInactive` on the list, create/update/delete use cases, `slugify`, column defaults |
| `infrastructure/routes/facilities.route.ts` | `POST` / `PATCH` / `DELETE /conformity/requirements`, `includeInactive` on the existing `GET` |
| `composition.ts` | three new wirings |
| mobile: `conformity_requirement.dart`, repository methods, provider, `admin_conformity_requirements_screen.dart`, route, hub card | list + full form |

The read keeps `read FACILITY` — a rep needs the checklist. The writes are
`create`/`update`/`delete CATALOG`, ADMIN only.

### Testing Phase 7 on screen

**1 · The seeded catalogue is there**
- `Administração › Requisitos de cadastro` lists the five from migration `0089`:
  Identidade, CRM, Comprovante de Endereço, Cartão de CNPJ, Licença Sanitária —
  all scoped to Ortopedia.
- On a database that predates `0089`, the list instead reads, in red:
  *"Nenhum requisito cadastrado — o cadastro não pede nenhum documento hoje."*

**2 · Create one, narrow**
- `Novo requisito` → **Nome** `Licença Sanitária`, leave the slug blank.
- Scope: pick one **Linha** and **Só CNPJ**.
- Turn on **Pede data de validade**. Leave PDF ticked.
- Save → a dialog names the scope and asks to confirm activation → confirm.
- Reopen it: the **slug** shows `licenca_sanitaria`, greyed out and not editable.

**3 · The scope warning scales**
- Create a second one with **Todas as linhas** + **CNPJ e CPF**. The dialog now
  says `Todas as linhas · CNPJ e CPF` — the widest possible reach.
- Cancel it, switch **Ativo** off, save. No dialog: nothing is being activated.

**4 · Prepare without exigir**
- Create one inactive. It appears in the list dimmed with `Inativo`, and does
  **not** appear on any clinic's cadastro checklist.
- Switch it on later → the activation dialog fires then.

**5 · It reaches the clinic**
- Open a clinic's **Cadastro** and confirm the active requirement now appears as
  a pending document, with a validity-date field if you asked for one.
- A rep's upload must respect the limits you set (file count, MB per file).

**6 · Delete follows the same rule as products**
- A requirement nobody has answered → trash icon → confirm → gone.
- One with a submission → refused, naming *"N registros de conformidade"*, and
  pointing at **Ativo** off instead.

**7 · Editing an active one does not nag**
- Change only the description of an already-active requirement → saves with no
  dialog.

### Automated coverage

API — `conformity-requirement-admin.test.ts` (new, 6 tests): slug derived from
the name · column defaults filled so a short form is complete · a requirement
accepting no file type is refused · **`slug` never reaches the update patch** ·
delete refused with counts that survive `toClientJSON` · the checklist read and
the admin read come from different sources and carry different shapes.

Mobile — `conformity_requirement_test.dart` (new, 5 tests): the admin payload
with limits and flags · null scope means *everyone* · a narrowed scope says so ·
an unknown document type reads as unrestricted rather than crashing · defaults
when the API omits limits.

---

## Simulator verification

Run on a dedicated simulator (`AtlasMed Admin16`, created for this so the three
already-booted ones were left alone), against a **local** API on `:3111` pointed
at `atlasmed_admin16_dev` — an isolated copy of the local snapshot migrated to
`0117`. `AppConfig.apiBaseUrl` throws when `API_BASE_URL` is missing, so there is
no path by which this could have reached production.

Signed in as ADMIN. Desempenho rendered its real numbers (1423 clínicas, 1388
médicos), which is the baseline that nothing existing broke.

### Five defects the run found

The unit tests were green through all of them. Every one needed a screen.

1. **The requirement delete dialog lied.** It promised *"nada no sistema faz
   referência a ele"* and then the API refused — for a requirement a clinic had
   already answered. The form used a bare `IconButton` instead of
   `CatalogDeleteButton`, so it never asked. Exactly the "offer it and fail"
   §6.2 was written against, in the one screen that skipped the shared widget.
2. **A raw JSON key reached the UI.** *"Há 1 **conformityRecords** no sistema"* —
   `ProductDeletability._labelFor` knew only the four product relations and fell
   through to its passthrough branch.
3. **The counts were wrong for every row.** Fixing (1) meant returning reference
   counts with the list; the first implementation wrote correlated subqueries in
   the select list and **they did not correlate** — every requirement came back
   with the table-wide total, so one answered requirement reported all five as
   blocked. Replaced with three grouped queries joined in memory, a shape that
   cannot express the mistake.
4. **Gender disagreement**: the FAB read *"Novo especialidade"*.
5. **Clause-shaped blocker label**: *"Há 1 clínica que já respondeu … que
   dependem dele"*. The labels are noun phrases now.

Each fix carries a regression test naming the simulator as where it was found.

> Worth stating: (3) was introduced *while fixing* (1), and only a second pass on
> the device caught it. A green suite after a fix is not evidence the fix works.

### What was exercised

| Screen | Result |
|---|---|
| Drawer | `Administração` present, last, ADMIN-only |
| Hub | three sections, six destinations |
| Requisitos — list | all five seeded requirements, correct scope labels, `Pede validade` / `Pede frente e verso` flags |
| Requisitos — form | slug greyed out with the reason; Linha resolved to Ortopedia; mime chips; limits 10/50/200 |
| Requisitos — delete | red+enabled on an unreferenced one, grey+blocked on the answered one, with counts |
| Catálogos | 66 especialidades with CNES ids; four segments; horizontal scroll |
| Fontes pagadoras | empty state, create → list refresh |
| Desempenho | unchanged |

Also exercised over HTTP before the UI: nullable-CNES specialty creation (twice,
proving `0117`), duplicate → **409** with a readable message (a **500** before the
constraint mapping), non-numeric CNES id → **400**, requirement create with a
derived slug, `PATCH` ignoring a slug attempt, delete allowed and delete refused
with `blockedBy`.

### Local artifacts

`apps/api/.env` (gitignored), database `atlasmed_admin16_dev`, simulator
`AtlasMed Admin16`, and a known password on that copy's admin user. All local and
disposable; none of it is committed.

Final totals: **API 1585 passing across 189 files**, **mobile 730 passing**;
`tsc`, `eslint`, `flutter analyze` clean, `drizzle-kit check` reports
"Everything's fine".

---

## Phase 8 — the product page, and a picture that can actually be uploaded

**Shipped:** tapping a product in `Administração › Produtos` opens its edit page
directly, and that page can set and clear the product's picture.

### The sheet had to go

`_openQuickView` opened the same bottom sheet the rep-facing product list uses:
a read-only copy of the first screenful of the form, with an "editar" button
inside it. On the admin panel the one thing to do with a row is edit it, so the
sheet was a tap that bought nothing — the same finding as the competitor list in
Phase 3.

Three things lived only in that sheet and moved into the form rather than being
dropped:

| Was in the sheet | Now |
|---|---|
| "Gerenciar outras marcas" | `RELACIONADOS › Produtos concorrentes` |
| "Ver comparativo de preços" | `RELACIONADOS › Ver comparativo de preços` |
| Brasíndice/Simpro publication dates | a read-only panel under the same heading |

The publication panel carried an "editar publicação" pencil that only raised a
"coming soon" snackbar. Inside a form where every other control writes, that is
worse than no button, so it is gone.

### The picture

`products.picture_url` and `picture_blurhash` have existed since the Emultec
import. Nothing could fill them: the column was writable through
`PATCH /products/:id` as a bare string, which only helps an admin who already
has a URL.

| Layer | File | What it holds |
|---|---|---|
| Use cases | `application/use-cases/product-picture.use-cases.ts` | upload / remove / download, mirroring `facility-photo.use-cases.ts` |
| Routes | `infrastructure/routes/catalog.route.ts` | `POST`/`DELETE /products/:id/picture`, `GET /products/pictures/*` |
| Contract | `application/interfaces/product.repository.interface.ts` | `updatePicture`, separate from `update` |
| Client | `data/repositories/catalog_repository.dart` | multipart `picture` field, hand-attached bearer token |
| UI | `presentation/widgets/product_thumbnail.dart` | one thumbnail, used by the list row and the form |

**Four decisions worth the words:**

1. **`pictureUrl` left the request body.** It names an object this API stores,
   so as a free-text field it let a product point anywhere on the internet, and
   the blurhash beside it is derived from the bytes rather than typed. Both
   columns are now written by `updatePicture` or by nothing.
2. **The row points at the new object before the old one is deleted.** The other
   order leaves a product whose picture 404s if the update fails; an orphaned
   object costs a few kilobytes. A failed delete is swallowed for the same
   reason — a leak is not worth failing an upload that worked.
3. **A URL this module did not write is never deleted.** Rows imported from
   Emultec carry external URLs, and deriving a storage key from one would delete
   an unrelated object.
4. **The download key is validated against a pattern, not just used.** It is the
   `*` of a route, so it is a path the caller controls: `products/1/../../…` is
   a different object.

No migration — both columns already existed.

### Testing Phase 8 on screen

**1 · The page replaces the sheet**
- `Administração › Produtos`, tap any row. Expect *"Editar produto"*, not a
  sheet. Scroll to the bottom: `RELACIONADOS` with both links, and the
  publication panel with the family's dates.

**2 · Upload**
- `Imagem › Adicionar imagem › Escolher da galeria`. The thumbnail fills while
  the sheet is still closing, the label becomes *"Trocar imagem"*, and the row
  in the list behind it shows the same picture.
- `select picture_url, picture_blurhash from products where id = <id>` — both
  set, the URL under `/api/v1/products/pictures/products/<id>/`.

**3 · Save does not clear it**
- Press `Salvar` and re-open. The picture is still there: it is not in the
  request body, and the response carries it back.

**4 · Remove**
- `Trocar imagem › Remover imagem`. The placeholder icon returns and both
  columns are null.

**5 · A new product**
- `Novo produto`. The Imagem section reads *"Salve o produto primeiro"* — there
  is no id yet to hang an object off.
