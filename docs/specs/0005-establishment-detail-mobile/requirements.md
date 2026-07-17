# Spec 0005: Mobile Establishment Detail (Estabelecimento / Clínica)

**Status:** Approved for implementation — redesign addendum (v6)  
**Last Updated:** 2026-07-17  
**Domains:** `apps/mobile`, `apps/api` (additive contract changes)  
**Related:** [Spec 0002 — Facility and Professional CRM](../0002-clinic-doctor-crm/requirements.md), [Spec 0003 — Territory Management](../0003-territory-management/requirements.md), [api-mobile integration guide](../../ai/integration-tasks/api-mobile.md)

> **v2 note:** a visual reference (real product screenshots) prompted a redesign of the header, several new sections and a per-field edit pattern. Decisions 1, 3, 4 (representatives/CRM source) are unchanged. Decisions 2 and 5 below are **superseded** — see "Locked product decisions (v2)". Phase 1 (frontend, mocked) of the redesign has shipped; Phase 2 (backend) is documented but not yet implemented.

> **v3 note:** a review pass on the v2 build produced a second round of frontend-only polish — fixed blue header (no longer scrolls away), the four Sinais chips moved inline into the header (dedicated "Sinais" card removed), CNES service-code chips removed from below the header, full formatted address on the header, "Território" dropped from the consultor card (which also moved to the bottom of the section list), a chevron from each administrative professional row to a new (mocked) representative profile screen, Médicos switched to a snapping `PageView` with a doctor-count badge and essential contact fields (phone/email) instead of the personal-fields set, Convênios legend spacing tightened, Pedidos recentes redesigned to mirror the Médicos card layout (with its own count badge), and both Produtos em uso and Histórico de visitas — plus the "Adicionar à rota de hoje" CTA — removed from the screen (models/widgets kept, just unmounted) pending a product decision on whether they return.

> **v4 note:** a further alignment pass made "Ver todos"/"Editar" placement consistent across every section header (Médicos, Profissionais administrativos, Convênios, Pedidos recentes all now use the same header-trailing pattern), rebuilt "Profissionais administrativos" as a snapping `PageView` card carousel identical in structure to Médicos (was a plain `ListTile` column), and added a "Relacionamento" star rating (0–10 scale, 5 stars) to both the Médicos and Profissionais administrativos cards, rendered as faint/undetermined outline stars when no score exists yet.

> **v5 note:** fixed a real layout bug in `ClinicSectionHeader` (the title and the trailing `Spacer` shared flex equally instead of the spacer claiming all leftover space, which could strand "Ver todos"/"Editar" away from the right edge) and hardened two new header widgets against overflow at narrow widths/long text. "Fotos da clínica" is retired as a standalone scrollable section — tapping the header avatar now opens a full-screen, swipeable `ClinicPhotoViewerScreen` instead. The Sinais chips in the header gained an inline category legend ("Comercial:", "Compra:", "Conformidade:") so each pill's meaning is clear without a separate key, and the header now also shows the clinic's phone/e-mail (tap-to-call/e-mail). "Pedidos recentes" cards moved their status badge inline next to the date and added a new order-type badge there too, dropped both the redundant item-count row and the separate `R$ total` row, and gained a full-width item-preview table (product name first, `qty×` right-aligned, "+N itens" beyond 2 lines) with a computed "Subtotal:" as the card's only monetary figure — the `PageView` height was also retuned so the tallest card has ~0px of dead space above "Ver detalhes".

> **v6 note:** the v5 header phone/e-mail and legend work landed in code but the live network-backed `ClinicDetail.phone`/`.email` were null for the test facility, so nothing rendered — `EstablishmentDetailSections` now carries its own mocked `phone`/`email` (with `ClinicDetail`'s as fallback) so the header reliably shows contact info in Phase 1. The "Comercial" chip category label is renamed to "Status" (clearer than "Comercial" for what's really an overall standing signal), and the "Conformidade" chip is dropped from the header entirely (still tracked on `FacilityStatusSignals`, just not surfaced there). The header also gains an "Estabelecimento PF"/"Estabelecimento PJ" line under the specialties line, from the existing `taxIdType` mock field. Finally, the "Toque nos ícones…" edit-suggestion banner moved from the top of the scrollable content (above "Mapa e clínicas próximas") to the very bottom, below "Dados administrativos".

## User Story

As a field rep or manager using the mobile app, I want a complete establishment detail screen with location, administrative contacts, clinical staff, payers, recent orders, and nearby establishments I am allowed to see — so I can plan visits, understand the account, and navigate the territory without switching tools.

## Terminology

| UI (pt-BR) | API / DB |
|------------|----------|
| Clínica / estabelecimento | `facilities` |
| Profissionais administrativos | `public.facility_representatives` |
| Médicos | `public.facility_professionals` + `public.professionals` (CRM, confirmed) |
| Convênios | `healthcare_providers` + `facility_healthcare_provider_shares` |
| Pedidos | `orders` + `order_items` |
| Estabelecimentos próximos | `GET /facilities` geo query scoped to establishment coordinates |

## Locked product decisions (v1, unchanged)

| # | Decision |
|---|----------|
| 1 | **Administrative professionals** come from `public.facility_representatives` only. Do **not** use registry read endpoints (`/registry/professionals`, `/registry/representatives`) on mobile for this screen. |
| 3 | **Médicos** section shows **CRM associations only** (`GET /facilities/:id/professionals?view=confirmed`). |
| 4 | **Convênios** in v1 using existing catalog shares API (`GET /facilities/:id/healthcare-provider-shares`). |
| 6 | Implementation order: **frontend with mocked data first**, then backend contract + wire-up. |

## Locked product decisions (v2 — redesign addendum, supersede v1 #2 and #5)

| # | Decision |
|---|----------|
| 7 | **Signals** are concrete, DB-backed status fields — `commercialStatus`, `purchaseStatus` (shown as "Tipo de cliente"), `conformityStatus`, and a computed `lastPurchaseAt` — not narrative alert cards. `lastPurchaseAt`/`purchaseStatus` are backend-computed from `orders`; mobile only displays whatever the DTO returns. Header additionally shows a color-coded status ring and a `PJ`/`CPF` badge (from `facility_tax_id_type` / cnpj vs cpf presence). |
| 8 | **Saúde comercial** (LTV, ticket médio, frequência) stays **deferred** — not built, not mocked, in v1 or this redesign. |
| 9 | **Produtos em uso** (revenue/6m, trend %, share-of-clinic) is back **in v1, mocked**. Backend aggregation from `orders` is a Phase 2 design task, not yet scoped in detail. |
| 10 | **Nearby establishments** now render **inline** on the detail page: a compact map preview (fixed ~2.5 km radius) plus a scrollable "Clínicas no raio" list. Tapping the map (or its "Expandir" affordance) still opens the existing **full-screen** map with the **1–50 km slider, default 50 km, centered on the establishment** — v1 decision #2's full-screen radius behavior is preserved, just no longer the only entry point. |
| 11 | **Pedidos recentes** stays a dedicated, standalone section (not folded into visit history) — redesigned with a stats row and richer order cards. |
| 12 | **Histórico de visitas** gains sentiment (Positiva/Mista/Negativa), attendees, sample given, linked order value, free-text summary and a stats row (visitas/pedidos/duração média) — **mocked only** in this redesign. The real `visits` schema and `clinicVisitsProvider` (visitedAt/type/summary) are unchanged; "Nova visita" still creates a real, simple visit. |
| 13 | **Per-field edit pencils** (facility admin fields + médico personal fields) open a **suggestion flow** (bottom sheet) conceptually mirroring the existing `FACILITY_FIELD_UPDATE` review pipeline. Mocked in this redesign — submission shows a confirmation snackbar, no network call yet. |
| 14 | **Notas de campo** (facility-scoped private notes, numbered list) and **Fotos da clínica** (photo gallery) are both planned features — **mocked only** in this redesign. Phase 2 backend adds a `facility_notes` table, a `facility_photos` table, and a `profile_picture_id` column on `facilities`. |

## Locked product decisions (v3 — polish pass, supersede v2 IA/layout details)

| # | Decision |
|---|----------|
| 15 | **Header is fixed** (rendered outside the scrollable section list, not as its first child) and uses a **solid blue background** (`#1e40af`). It no longer shows "última interação" or the CNES service-code chips row. The Sinais chips (commercial/purchase/conformity status) render **inline in the header** as translucent pills; the dedicated "Sinais" section card is removed from the scroll (data/model unchanged, just no longer mounted twice). The header shows the establishment's **full formatted address**, not a truncated street/neighborhood pair. |
| 16 | **Consultor responsável** drops the "Território" row (region/city still shown when available) and **moves to the bottom of the section list**, just above "Dados administrativos". |
| 17 | **Profissionais administrativos** rows are tappable — a trailing chevron opens a new `RepresentativeDetailScreen` (mocked: built from the already-loaded `AdministrativeProfessional`, not a dedicated by-id endpoint) showing name, role, contact info and the parent facility name. |
| 18 | **Médicos** uses a snapping `PageView` (one card in view at a time, `viewportFraction: 0.86`) instead of a plain horizontal list. The section header shows a count badge. Each card drops the personal-fields block (Formação/Aniversário/Time/Interesses) in favor of essential contact rows (phone/email, tap-to-call/email) plus a dedicated badges area (role badge + prescritor/comprador/decisor flags together). `FacilityCrmDoctor` gained `phone`/`email` fields for this. |
| 19 | **Convênios** legend rows get a divider + symmetric vertical padding instead of bottom-only padding, to fix the cramped spacing between the donut/callout block and the legend. |
| 20 | **Pedidos recentes** is redesigned to mirror the Médicos card layout 1:1 (icon+identity header, status badge area, info rows, "Ver detalhes" footer) in a snapping `PageView`, with its own count badge on the section header. The previous stats-row card (pedidos/total/ticket médio) is dropped in favor of this consistency. |
| 21 | **Produtos em uso** and **Histórico de visitas** are unmounted from the screen (sections removed from the scroll; the underlying models/mock data/widgets are untouched for a possible future return). The **"Adicionar à rota de hoje"** CTA is removed. |

## Locked product decisions (v4 — header alignment + relationship rating)

| # | Decision |
|---|----------|
| 22 | **"Ver todos"/"Editar" header actions render identically** across Médicos, Profissionais administrativos, Convênios and Pedidos recentes — same `_HeaderLinkButton` widget in the `trailing` slot of `ClinicSectionHeader`, same alignment relative to the title. Count badges (Médicos, Profissionais administrativos, Pedidos recentes) use the same `badge` slot next to the title. |
| 23 | **Profissionais administrativos functions exactly like Médicos**: a snapping `PageView` card carousel (`viewportFraction: 0.86`), one card per professional, with an avatar/name/role header, a contact-type badge area, a divider, always-present phone/e-mail contact rows, and a "Ver perfil completo" footer link. The previous `ListTile`-column layout is retired. A new `AdministrativeProfessionalsListScreen` row (mirroring `DoctorsListScreen`'s row) backs "Ver todos". |
| 24 | **Relacionamento (relationship) rating** — a `RelationshipStars` widget renders "Relacionamento:" + 5 stars on both the Médicos and Profissionais administrativos cards, below the phone/e-mail rows. The underlying value is a 0–10 scale (2 points per star, half-star increments). When a score exists, unfilled stars beyond the fill render as normal-opacity outlines (a real, known "empty" position). When the score is `null` (not yet assessed), all 5 stars render as outlines at reduced opacity, visually distinct from a determined-but-low score. `FacilityCrmDoctor` and `AdministrativeProfessional` both gained an optional `relationshipScore` (`int?`) field; mocked only in this pass — no backend field or endpoint yet. |

## Locked product decisions (v5 — header bugfix, photo viewer, header contact/legend, pedidos items)

| # | Decision |
|---|----------|
| 25 | **"Fotos da clínica" is no longer a scrollable section.** Tapping the header avatar opens a full-screen `ClinicPhotoViewerScreen` (swipeable `PageView`, page-dot indicator, close button) built from the same `PhotoGallerySummary` mock data; the section widget/model are untouched but unmounted, same pattern as Produtos em uso/Histórico de visitas. If there are no photos, tapping the avatar shows a "Nenhuma foto cadastrada" snackbar instead of opening an empty viewer. |
| 26 | **Each Sinais chip gets an inline legend** — the category name renders muted before the value inside the same pill (e.g. "Status: Ativa"), so the chip is self-explanatory without a separate key/legend element. **v6:** only 2 chips remain — "Status" (renamed from "Comercial") and "Compra"; "Conformidade" is dropped from the header (the field stays on `FacilityStatusSignals` for later use, just not rendered here). |
| 27 | **Header shows clinic phone/e-mail** below the address, each tappable (tel:/mailto: via the existing `contact_actions.dart` helpers), consistent with how contact rows behave elsewhere on the screen. **v6:** sourced from a new mocked `EstablishmentDetailSections.phone`/`.email` (falling back to `ClinicDetail.phone`/`.email` from the live API) since the real facility record used for testing had no contact info populated — mirrors the mock-first approach used for every other Phase 1 section. |
| 28 | **Pedidos recentes cards show a full-width item preview + subtotal, and drop the separate total row**: the item-count row and the top `R$ total` row are both removed — the single "Subtotal:" line at the bottom of the items table (sum of `quantity * unitPrice` across all order lines, regardless of how many are previewed) is the only monetary figure shown on the card now. The table itself is capped at **exactly 2** real item rows (`productName` left, `${quantity}x` right-aligned — name always comes first), with a "+N itens" row replacing anything beyond that instead of a bare "…". The `ClinicOrdersSection` `PageView` height is tuned so the tallest card (most items) has ~0px of dead space above "Ver detalhes"; shorter-content cards can still show a small gap since every card in the carousel shares one fixed height. `FacilityOrderSummary` gained an `items` field (`List<FacilityOrderItemSummary>`, mocked) and a computed `itemsSubtotal` getter; the backend `order_items`/detail-endpoint shape (`quantity`, `unitPrice`, `product.name`, computed `lineTotal`) already matches this 1:1, so wiring later just maps `GET /orders/:id` items into the same model. |
| 30 | **Order status + type badges sit next to the date**, not on their own row: the existing status pill (e.g. "Aprovado") moves inline beside the formatted date, and a new order-type pill (`orders.type` — Venda/Consignação/Doação/Outro, pt-BR labels, neutral gray style to avoid competing with the status color) joins it. `FacilityOrderSummary` gained a `type` field (`String`, defaults to `'SALE'`), mocked only in this pass. |
| 29 | **`ClinicSectionHeader` layout bugfix** — the title and the trailing `Spacer` previously shared flex 1:1, which could leave "Ver todos"/"Editar" short of the header's right edge instead of flush against it (worse with longer titles or larger badges). Fixed by giving the title+badge group a single `Expanded` that claims all leftover space, so the trailing action always sits at the true right edge. |

## Locked product decisions (v6 — header contact fix, tax-id label, chip cleanup, banner placement)

| # | Decision |
|---|----------|
| 31 | **Header shows "Estabelecimento PF"/"Estabelecimento PJ"** directly under the specialties line, derived from the existing `EstablishmentDetailSections.taxIdType` mock field — reinforces the same PF/PJ signal already shown as a badge on the avatar, in text form for scanability. |
| 32 | **The "Toque nos ícones…" edit-suggestion banner moves to the bottom of the screen**, below "Dados administrativos" (was above "Mapa e clínicas próximas"). It's a footnote about how per-field suggestions work, not something users need before they've seen any editable fields. |

## Current baseline (audit summary)

### Mobile — wired today

- Explore list: paginated `GET /facilities`, proximity refetch (user-centered, 50 km).
- Detail shell: rich UI; only identity fields + partial admin contact from `GET /facilities/:id`.
- Visit history + create visit: `GET/POST /facilities/:id/visits`.
- Map tab: territory + facilities (coordinate response currently broken server-side).

### Mobile — UI built but empty / stub

- Context card, signals, health metrics, product performance, nearby list, doctors, field notes.
- Quick actions: only **Visita** works; Ligar, WhatsApp, Rota, Pedido are no-ops.
- No mini-map on detail; no expandable nearby map.

### API — exists, not consumed by mobile detail

| Endpoint | Purpose |
|----------|---------|
| `GET /facilities/:id/professionals` | CRM doctors at facility |
| `GET /facilities/:id/healthcare-provider-shares` | Payer mix |
| `GET /facilities/:id/consultant-assignments` | Rep assignment history |
| `GET /orders`, `GET /orders/:id` | Orders (no `facilityId` filter yet) |

### API — missing for this spec

| Gap | Notes |
|-----|-------|
| `GET /facilities/:id/representatives` | List active rows from `facility_representatives` |
| `GET /facilities/:id/orders` (or `facilityId` on list) | Recent orders for establishment; REP sees own sales only |
| Facility DTO coordinates | `location` PostGIS exists; `lat`/`lng` returned as `null` today |
| Facility DTO contact fields | `phone_number`, `email`, `website_url`, full address in DB, not in serializer |

## Screen information architecture (target v3 — redesign)

Sections top → bottom. Items marked **mock** ship in frontend phase 1; **wire** in phase 2/3. The header is fixed (outside the scroll); everything else scrolls beneath it.

| Order | Section | Data source | Phase |
|-------|---------|-------------|-------|
| — | **Header (fixed, blue)** — name, inline Sinais chips (with category legend), PJ/CPF badge, specialty line, full address, phone/e-mail, avatar tap → full-screen photo viewer | Facility DTO + status signals + doctors + photos | mock → wire |
| 1 | Quick actions | Contact fields + coords | wire (Visita already) |
| 2 | Sugerir alterações banner (static) | — | done |
| 4 | **Mapa e clínicas próximas** — inline preview + list, tap → full-screen slider | Facility `lat`/`lng` + geo list centered on facility | mock → wire |
| 5 | **Profissionais administrativos** — row tap → representative profile screen | `facility_representatives` | mock → wire |
| 6 | **Médicos** (CRM) — snapping `PageView`, count badge, essential contact fields, badges area | `/professionals?view=confirmed` + `professional_notes` | mock → wire |
| 7 | **Convênios** — donut chart | healthcare provider shares | mock → wire |
| 8 | **Pedidos recentes** — snapping `PageView` mirroring Médicos card, count badge | facility-scoped orders | mock → wire |
| 9 | **Notas de campo** | none yet — new `facility_notes` table | mock |
| 10 | Consultor responsável (+ tenure, região) | `consultantName`, `consultantSince`, `regionZoneLabel` | mock → wire |
| 11 | Dados administrativos — per-field pencils | Facility DTO + representatives fallback for responsável | mock → wire |

### Removed / hidden in v3 (cumulative with v2)

- Saúde da clínica (LTV, ticket médio, frequência) — stays deferred, not built.
- Registry panels.
- Nearby flat-list-only UX — replaced by inline preview + tap-through full-screen map (both retained, at different zoom levels).
- Dedicated "Sinais" section card — signals now render inline in the fixed header instead.
- CNES service-code chips row below the header.
- "Última interação" line in the header.
- **Produtos em uso** and **Histórico de visitas** sections — unmounted pending a product decision on their return (models/widgets untouched).
- "Adicionar à rota de hoje" CTA.
- "Território" row on the consultor card.
- **"Fotos da clínica" as a standalone scrollable section (v5)** — the section widget/model are untouched but unmounted; the gallery is now reached by tapping the header avatar, which opens a full-screen `ClinicPhotoViewerScreen`.

## Feature requirements

### F-001 — Facility detail DTO enrichment

WHEN `GET /facilities/:id` or list returns a facility with a stored `location` THEN the API SHALL include:

- `lat`, `lng` (WGS84, extracted from PostGIS)
- `phone`, `email`, `website`, `streetAddress`, `streetNumber`, `addressComplement`, `postalCode`, `neighborhood`, `city`, `state`
- `commercialStatus` (enum exposed for status chip mapping)
- `consultantName` (already on list; ensure on detail)
- `services[]` (already on detail)

WHEN a facility has no `location` THEN `lat`/`lng` SHALL be omitted or `null` and the mobile mini-map SHALL show an empty state with address text only.

### F-002 — Administrative professionals

WHEN `GET /facilities/:id/representatives` is called by a user with read access to the facility THEN the system SHALL return active CRM representatives:

- Filter: `ended_at IS NULL`
- Sort: `representative_name ASC`
- Fields per row: `id`, `representativeName`, `roleTitle`, `email`, `phone`, `taxId`, `contactType` (`PROFESSIONAL` \| `DECISOR` \| `COMPRADOR`), `confirmedAt`, `sourceProvider` (optional badge)

WHEN there are no active representatives THEN the mobile UI SHALL show an empty state (“Nenhum contato administrativo cadastrado”).

**Explicit exclusion:** no reads from `registry.facility_representatives` or `/registry/representatives` on this screen.

**v3 addition:** each row is tappable (trailing chevron) and opens a representative profile screen (name, role, phone/email, parent facility). Phase 1 builds this screen from the already-loaded row data (no new endpoint); a future by-id `GET /facilities/:id/representatives/:repId` is optional if the profile ever needs data beyond what the list already returns.

**v4 addition:** the section is rebuilt as a snapping `PageView` card carousel — same structure as F-003's Médicos cards (avatar/name/role header, contact-type badge, divider, always-present phone/e-mail rows, "Ver perfil completo" footer, relationship stars) — replacing the previous `ListTile` column. A count badge and "Ver todos" link (→ `AdministrativeProfessionalsListScreen`) sit on the section header, matching every other section. `AdministrativeProfessional` gained an optional `relationshipScore` (`int?`, 0–10 scale, mocked only).

### F-003 — Médicos (CRM confirmed)

WHEN the mobile app loads doctors for an establishment THEN it SHALL call `GET /facilities/:id/professionals?view=confirmed`.

Each row SHALL display: display name, specialty, CRM (council/number/state when present), role flags (prescriber, buyer, decision-maker) as subtle chips.

WHEN a row is tapped THEN the app SHALL navigate to `/workspace/doctor/:professionalId`.

**v3 addition:** cards render in a snapping `PageView` (one at a time) instead of a plain horizontal list, with a count badge on the section header. Each card prioritizes essential contact fields — phone and e-mail, tap-to-call/e-mail — over the personal-fields set (Formação/Aniversário/Time/Interesses), which is dropped from this card (still available on the doctor detail screen). Role badge + role flags share one dedicated badges area on the card. This requires `phone`/`email` on the CRM doctor row (mirrors `professionals.phone`/`email`).

**v4 addition:** each card gains a "Relacionamento:" 5-star row (below the phone/e-mail rows, above the "Ver perfil completo" footer) driven by an optional `relationshipScore` (`int?`, 0–10 scale) on `FacilityCrmDoctor`. `null` renders 5 faint outline stars instead of a real (zero) rating.

### F-004 — Convênios (payer mix)

WHEN `GET /facilities/:id/healthcare-provider-shares` is called THEN the mobile UI SHALL render payer name + `sharePercent`.

**Visual:** horizontal stacked bar (segments proportional to %) with legend list below. Empty state when no shares.

### F-005 — Pedidos recentes

WHEN a user opens the Pedidos section on an establishment THEN the system SHALL return recent orders for that facility ordered by `orderedAt` / `createdAt` descending.

| Role | Visibility rule |
|------|-----------------|
| `REP` | Orders where `orders.seller_id = authenticated user` AND `orders.facility_id = :id` |
| `MANAGER`, `ADMIN`, `OPS` | All orders for `facility_id = :id` within territory scope |

**Suggested endpoint:** `GET /facilities/:id/orders?page&limit` (resource-scoped, reuses order serializer). Default `limit = 5` on mobile with “Ver todos” linking to orders list pre-filtered by facility when that exists.

Each row: display id (`PED-{legacyId}`), status badge, date, total, item count. Tap → existing order detail route.

**v5 addition:** each card previews up to 2 order lines, full card width, product name first (ellipsized) with `quantity×` right-aligned, plus a computed "Subtotal:" (sum of `quantity * unitPrice` across **all** of the order's lines, not just the previewed ones — `FacilityOrderSummary.itemsSubtotal`) as the row below. Both the item-count row and the separate `R$ total` row are dropped — the "Subtotal:" line is the card's only monetary figure. If an order has more than 2 lines, the 2nd visible row is followed by a "+N itens" row (not a bare "…", so the user knows how many are hidden). The status badge (e.g. "Aprovado") and a new order-type badge (`orders.type` → Venda/Consignação/Doação/Outro) sit inline next to the date instead of on their own row. This maps 1:1 onto the `GET /orders/:id` `items[]` shape (`quantity`, `unitPrice`, `product.name`, computed `lineTotal`) — Phase 2/3 wiring only needs a facility-scoped orders-with-items query (or an items preview embedded in the list endpoint) to drop the mock in.

**Quick action:** wire **Novo pedido** to order creation flow with `facilityId` pre-filled.

### F-006 — Establishment location mini-map

WHEN the establishment has coordinates THEN the detail screen SHALL show a **mini-map** (~160–200 px height) centered on the establishment with a single pin.

WHEN coordinates are missing THEN show address card without map.

### F-007 — Nearby establishments (establishment-centered)

WHEN the user taps **“Ver estabelecimentos próximos”** on the mini-map THEN the app SHALL open a full-screen map overlay (or route) with:

- Map centered on **establishment** `lat`/`lng`
- Radius slider: **1–50 km**, default **50 km**, step 1 km
- On slider change: `GET /facilities?latitude={facilityLat}&longitude={facilityLng}&radiusKm={r}&limit=100`
- Pins for every in-scope facility returned; current establishment styled distinctly
- Pin tap → navigate to that establishment's detail
- Exclude current establishment from pin list (client-side or `excludeId` query param)

**Important:** distance shown on pins is distance **from the establishment**, not from the user. The API already computes distance from the query reference point — pass establishment coords as the reference.

Results SHALL respect existing territory scope (`facilityIds`); no client-side bypass.

### F-008 — Visits (unchanged)

Keep existing visit list + quick-register behavior. Optionally compute **“Última visita: há X dias”** in the header from the most recent visit returned.

### F-009 — Dados administrativos

Show CNPJ/CPF, phone, email, website, full formatted address.

`Responsável` MAY be populated from the first administrative representative with a director-like `roleTitle` if no dedicated field exists on facility.

### F-010 — Quick actions

| Action | Behavior |
|--------|----------|
| Ligar | `tel:` URI from facility phone |
| WhatsApp | `https://wa.me/…` when phone present |
| Rota | Open maps app with establishment coords or address |
| Visita | Existing `POST /facilities/:id/visits` |
| Pedido | Navigate to new order with facility pre-selected |

Use existing `contact_actions.dart` helpers.

### F-011 — Sinais (status signals)

WHEN the detail screen loads THEN the header and the "Sinais" section SHALL show:

- `commercialStatus` (`REGISTERED` \| `ACTIVE` \| `SUSPENDED` \| `INACTIVE`) — pt-BR label + color, also drives the header status chip and avatar ring color.
- `purchaseStatus` (`NON_BUYER` \| `LOW_BUYER` \| `REGULAR_BUYER` \| `HIGH_BUYER`) — shown as "Tipo de cliente", pt-BR label + color.
- `conformityStatus` (`INCOMPLETE` \| `COMPLETE` \| `EXPIRING_SOON` \| `NON_CONFORMING`) — pt-BR label + color.
- `lastPurchaseAt` and a derived "há N dias sem pedido" caption.
- A `PJ`/`CPF` badge on the avatar, derived from `facility_tax_id_type` (or `cnpj`/`cpf` presence as a fallback).

**v5:** each header chip renders its category name inline before the value ("Comercial: Ativa", "Compra: Compra regular", "Conformidade: Completa") so the pill is self-explanatory without a separate legend/key element.

**v6:** only the commercial status and purchase status chips are shown in the header — labeled "Status: Ativa" and "Compra: Compra regular" respectively ("Comercial" renamed to "Status" for clarity). The conformity chip is dropped from the header (still computed and available on `FacilityStatusSignals`/mocked, just not surfaced there — a future "Sinais" detail view could still show it). The `PJ`/`CPF` badge on the avatar is now echoed as an "Estabelecimento PF"/"Estabelecimento PJ" text line under the specialties line in the header, for users who don't notice the small avatar badge.

`lastPurchaseAt` and `purchaseStatus` SHALL be backend-computed from `orders` (most recent order date / recency-based bucket) — this computation is **not** mobile's responsibility.

**Phase 1 (this redesign):** all four fields are mocked via `FacilityStatusSignals` in `establishment_detail_models.dart`.

### F-012 — Produtos em uso

WHEN the detail screen loads THEN a "Produtos em uso" section SHALL show, per product sold to the establishment: name, revenue over the last 6 months, trend % vs. the prior 6 months, and this product's share of the establishment's total revenue.

**Phase 1 (this redesign):** mocked via `ProductUsage`. Phase 2 aggregation query TBD (likely a facility+product grouped sum over `orders`/`order_items` with a rolling 6-month window, compared to the prior window for trend %).

### F-013 — Fotos da clínica

WHEN the user taps the header avatar THEN a full-screen, swipeable photo viewer (`ClinicPhotoViewerScreen`) SHALL open, showing one photo at a time with a page-dot indicator, an "n / total" counter and a close action; if there are no photos, a "Nenhuma foto cadastrada" snackbar SHALL show instead (**v5**: superseded by decision #25 — this is no longer a standalone scrollable section, see below for the original v1–v4 shape).

No backend exists for this today (`facilities.image_url` is a single field). Phase 2 needs a `facility_photos` table (one-to-many) and a `profile_picture_id` column on `facilities` for the single avatar/profile image shown in the header (distinct from the gallery).

**Phase 1 (v1–v4, superseded):** a "Fotos da clínica" row in the scroll showed a photo count, up to 3 thumbnail previews, and the most recent upload date; tapping it showed a "disponível em breve" snackbar. The row/widget (`ClinicPhotosSection`) is kept in the codebase, unmounted, for a possible future "manage photos" entry point.

**Phase 1 (v5, current):** mocked via `PhotoGallerySummary.thumbnailColors` — one placeholder color per photo, rendered full-screen as a colored card with a photo icon (no `facility_photos` URLs to display yet).

### F-014 — Notas de campo

WHEN a user opens the "Notas de campo" section THEN they SHALL see a private, facility-scoped, numbered list of notes visible only to them, with a button to add a new one.

No backend exists for this today (`professional_notes` is professional-scoped only). Phase 2 needs a new `facility_notes` table (`id`, `facility_id`, `user_id`, `text`, `created_at`), mirroring `professional_notes`' shape and privacy model.

**Phase 1 (this redesign):** mocked, in-memory only (added notes do not persist across screen reloads).

### F-015 — Per-field suggestion flow

WHEN a user taps the pencil icon next to any editable field (facility admin data: CNPJ, endereço, telefone, e-mail, site, horário; or médico personal fields: Formação, Aniversário, Time, Interesses) THEN a bottom sheet SHALL open showing the field label, current value and a text input to propose a new value.

WHEN the user submits a suggestion THEN the system SHALL create a reviewable suggestion — conceptually the same review pipeline as the existing `FACILITY_FIELD_UPDATE` type used by the CNES diffing pipeline (`registry-ingestion` module), extended to accept ad-hoc, user-submitted suggestions for both facility fields and professional personal fields (the latter needs a new suggestion type, since today's pipeline only covers facility/professional *registry* fields, not personal fields like birthday/team/hobbies/education).

Empty fields SHALL show a "+ Completar" affordance instead of "—".

**Phase 1 (this redesign):** mocked — submitting shows a "Sugestão enviada para revisão" snackbar; no network call. Phase 2 needs a new suggestion-submission endpoint (e.g. `POST /facilities/:id/field-suggestions`, `POST /professionals/:id/field-suggestions`) reusing/extending the registry-ingestion suggestion review pipeline, plus a new `education` column on `professionals` (no backing field exists today for "Formação").

## Authorization & scope (unchanged rules)

All endpoints use existing CASL + `ScopeContext`:

- List/detail/geo queries filter by `scope.facilityIds` for non-global roles.
- REP: facilities in assigned territories (hierarchy-expanded, sector-filtered).
- MANAGER: oversight facility union.
- ADMIN / OPS: global read.
- Nearby map never shows out-of-scope establishments even inside radius.

Mobile does not implement scope logic — it trusts the API.

## Additional UI recommendations (v1 or v1.1)

High value, visually polished, low scope creep:

| Idea | Rationale |
|------|-----------|
| **Serviços CNES chips** below header | `services[]` already on detail API; small chips add credibility |
| **Commercial status chip** in header | Once `commercialStatus` is exposed; map to pt-BR labels |
| **Consultor badge** in context card | `consultantName` already on list response |
| **Territory warning** | When `territoryAssignmentStatus` is `unassigned` or `ambiguous`, show amber info banner |
| **Pull-to-refresh** on detail | Refresh all section providers |
| **Per-section skeletons** | Avoid single full-page spinner on revisit |
| **Copy on long-press** | CNPJ, phone, address — common field rep action |
| **Convênios bar chart** | Makes payer mix scannable at a glance |
| **Empty states with CTA** | Pedidos → “Criar pedido”; Médicos → link to explore doctors tab |
| **Representative contact row actions** | Inline phone/email icons on admin professional cards |

**Defer to v3:** Saúde comercial (LTV/ticket médio/frequência), competitor products, share sheet, team visit history.

## Mobile implementation phases

### Phase 1 — Frontend (mocked) — v1, done

1. Refactor `ClinicDetailScreen` section order per v1 IA.
2. Add models: `AdministrativeProfessional`, `EstablishmentLocation`, `NearbyEstablishment`, `FacilityOrderSummary`, `PayerShare`.
3. Mock providers for each new section.
4. Build mini-map widget (Mapbox) with mock coordinate.
5. Build nearby full-screen map + radius slider with mock pins.
6. Build convênios stacked bar, pedidos list, admin professional cards, CRM doctor rows.
7. Hide deferred sections (health, products, signals).
8. Widget tests for new components.

### Phase 1b — Frontend redesign (mocked) — v2, done

1. Extend `EstablishmentDetailSections` with `FacilityStatusSignals`, `PhotoGallerySummary`, `ProductUsage`, `FacilityFieldNote`, `PayerMixSummary`, `VisitTimelineEntry`/`VisitStats`, and richer `NearbyEstablishment`/`FacilityCrmDoctor` fields (all mocked in `establishment_detail_mock.dart`).
2. Retire dead/duplicate fields on the legacy `ClinicDetail` model that are fully superseded by `EstablishmentDetailSections` (`ltv`, `avgTicket`, `avgPurchaseDays`, `payers`, `visits`, `clinicDoctors`, `nearbyClinics`, `signals`, `productPerformance`, `clientType`, `region`, `segment`, `fieldNotes`, `whatsapp`).
3. New widgets: `ClinicHeaderSection`, `ClinicStatusSignalsSection`, `ClinicPhotosSection`, `ClinicProductsSection`, `ClinicFieldNotesSection`, `ClinicVisitHistorySection`, `ClinicAdminInfoSection`, `EditableFieldRow`, `showEditSuggestionSheet`.
4. Redesign `ClinicLocationSection` (inline map + list, tap-through to existing full-screen map), `ClinicPayersBarSection` (donut), `ClinicCrmDoctorsSection` (horizontal cards), `ClinicOrdersSection` (richer cards + stats row), `ClinicContextSection` (tenure + região row).
5. Reorder `ClinicDetailScreen` per the v2 IA; restore "Adicionar à rota de hoje".

### Phase 1c — Frontend polish (mocked) — v3, done

1. Split `ClinicDetailScreen`'s body into a fixed `ClinicHeaderSection` (blue, outside the scroll) + a scrollable `ListView` for everything else; header now shows inline Sinais chips and the full address, drops "última interação" and the CNES chip row.
2. Remove the dedicated "Sinais" section card, "Produtos em uso", "Histórico de visitas", and the "Adicionar à rota de hoje" CTA from the scroll (models/widgets untouched, just unmounted).
3. `ClinicContextSection`: drop the "Território" row; move the whole section to the bottom of the list.
4. `ClinicAdminProfessionalsSection`: add a trailing chevron per row, navigating to a new `RepresentativeDetailScreen`.
5. `ClinicCrmDoctorsSection`: rebuild as a snapping `PageView`; add `phone`/`email` to `FacilityCrmDoctor`; simplify each card to essential contact fields + a dedicated badges area; add a count badge to the section header.
6. `ClinicPayersBarSection`: fix legend spacing (divider + symmetric row padding).
7. `ClinicOrdersSection`: rebuild as a snapping `PageView` mirroring the Médicos card layout; add a count badge to the section header.
8. Update/extend widget tests for the changed constructor signatures (`ClinicAdminProfessionalsSection.facilityName`).

### Phase 1d — Header alignment + relationship rating (mocked) — v4, done

1. Add a shared `RelationshipStars` widget (`Relacionamento:` label + 5 stars, 0–10 scale, faint-outline "undetermined" state for `null`); add `relationshipScore` (`int?`) to `AdministrativeProfessional` and `FacilityCrmDoctor`, plus mock values (including at least one `null` per section to exercise the undetermined state).
2. Rebuild `ClinicAdminProfessionalsSection` as a snapping `PageView` card carousel mirroring `ClinicCrmDoctorsSection`'s `_DoctorCard` structure (avatar/name/role header, contact-type badge, divider, always-present phone/e-mail rows, relationship stars, "Ver perfil completo" footer). Drop the old `ListTile`-based `_AdminProfessionalRow`.
3. Rebuild `AdministrativeProfessionalsListScreen` with its own compact row widget (mirrors `DoctorsListScreen`'s `_DoctorRow`) instead of reusing the (now horizontal-carousel) section widget for the "Ver todos" list.
4. Insert the relationship stars row into `ClinicCrmDoctorsSection`'s `_DoctorCard`, between the phone/e-mail rows and the "Ver perfil completo" footer; bump card/PageView height to fit.
5. Re-run `flutter analyze` + `flutter test` for the mobile app.

### Phase 1e — Header bugfix + photo viewer + pedidos items (mocked) — v5, done

1. Fix `ClinicSectionHeader`'s title/`Spacer` flex-sharing bug so the trailing "Ver todos"/"Editar" action always sits flush against the header's right edge, regardless of title length.
2. Add `ClinicPhotoViewerScreen` (full-screen swipeable `PageView`, page-dot indicator, close button); wire it to the header avatar's tap via `_openPhotos`; unmount the "Fotos da clínica" section header/card from the scroll (`ClinicPhotosSection` untouched, kept for a possible future entry point).
3. Add a `category` legend to `_SignalChip` (e.g. "Comercial: Ativa"); add a phone/e-mail row to `ClinicHeaderSection` using the existing `contact_actions.dart` helpers.
4. Add `FacilityOrderItemSummary` (`productName`, `quantity`, `unitPrice`, computed `lineTotal`) and an `items`/`itemsSubtotal` on `FacilityOrderSummary`; add a `type` field; redesign `_OrderCard` to move the status badge inline next to the date (plus a new order-type badge), drop both the item-count row and the separate total row, and add a full-width items table (name first, `qty×` right-aligned, capped at 2 rows + "+N itens") with "Subtotal:" as the only monetary line; retune `ClinicOrdersSection`'s `PageView` height so the tallest card has ~0px of slack above "Ver detalhes".
5. Harden the two new header widgets (`_HeaderContactAction`, `_SignalChip`) against overflow — wrap their text in `Flexible` + `maxLines: 1` + ellipsis, since `Wrap` still bounds each child to its own max width.
6. Re-run `flutter analyze` + `flutter test` for the mobile app.

### Phase 2 — Backend

1. Fix `lat`/`lng` extraction in `DrizzleFacilityRepository`.
2. Extend `serializeClinic` with contact fields + `commercialStatus`/`purchaseStatus`/`conformityStatus`/`taxIdType` + computed `lastPurchaseAt`.
3. Add `GET /facilities/:id/representatives` (use-case + route + integration tests).
4. Add `GET /facilities/:id/orders` with role-aware seller filter (or extend orders list with `facilityId`).
5. New `facility_notes` table + CRUD endpoints (F-014).
6. New `facility_photos` table + `profile_picture_id` column on `facilities` + upload endpoint (F-013).
7. New `education` column on `professionals` (F-015, Formação).
8. New suggestion-submission endpoint(s) for ad-hoc facility/professional field edits, extending the `registry-ingestion` suggestion review pipeline (F-015).
9. Design products-in-use aggregation from `orders`/`order_items` (F-012).
10. Design visit model enrichment (`sentiment`, `attendees`, `sampleGiven`, `linkedOrderId`) and visit stats aggregation, if the rich visit timeline (decision #12) is promoted from mock to real.
11. Integration tests: scope denied, REP seller filter, geo nearby from facility point.

### Phase 3 — Wire-up

1. Repositories + Riverpod providers on mobile.
2. Replace mocks; handle loading/error/empty per section.
3. Wire quick actions and navigation links.
4. Wire per-field suggestion sheet to the new suggestion-submission endpoint(s).
5. Map tab: benefit from coordinate fix (marker tap → detail optional follow-up).

## API contract additions (summary)

### `GET /facilities/:id/representatives` (new)

```
Permission: read FACILITY (resourceIdParam: id)

Response 200:
{
  "data": [
    {
      "id": "…",
      "representativeName": "…",
      "roleTitle": "Diretor administrativo",
      "email": "…",
      "phone": "…",
      "taxId": "…",
      "contactType": "DECISOR",
      "confirmedAt": "2026-01-15T…"
    }
  ]
}
```

### `GET /facilities/:id/orders` (new)

```
Permission: read FACILITY (resourceIdParam: id)
Query: page, limit, status (optional, comma-separated)

REP → WHERE facility_id = :id AND seller_id = :userId
Others → WHERE facility_id = :id (within scope)

Response: same shape as GET /orders list items
```

### `GET /facilities` (geo — behavior clarification)

When called for nearby establishments on detail, mobile passes **establishment** coordinates as `latitude`/`longitude`. Distance in response is from that point. Scope filter unchanged.

## Acceptance criteria

1. WHEN a REP opens an in-scope establishment THEN all v1 sections load with real data or purposeful empty states.
2. WHEN a REP opens Pedidos THEN only orders they sold at that establishment appear.
3. WHEN a MANAGER opens Pedidos THEN all orders at that establishment in scope appear.
4. WHEN establishment has coordinates THEN mini-map renders with correct pin.
5. WHEN user opens nearby map THEN slider refetches with establishment as origin; only scoped facilities appear.
6. WHEN establishment is out of scope THEN detail returns 404/403 (existing behavior).
7. WHEN administrative professionals exist in `facility_representatives` THEN they appear without calling registry endpoints.
8. WHEN CRM doctors are confirmed at facility THEN Médicos section lists them; unconfirmed/source-only do not appear.
9. WHEN healthcare provider shares exist THEN Convênios section shows names and percentages.
10. Saúde comercial (LTV, ticket médio, frequência) SHALL NOT render — stays deferred across v1 and v2.
11. WHEN the detail screen loads THEN Sinais SHALL show commercial/purchase/conformity status and last purchase, sourced from `EstablishmentDetailSections` (mocked in Phase 1, real DTO fields in Phase 2).
12. WHEN a user taps a field pencil THEN the suggestion sheet SHALL open and, on submit, show a confirmation without requiring a network call (Phase 1); Phase 2 SHALL persist the suggestion for review instead.
13. WHEN the inline map preview is tapped THEN the full-screen map SHALL open centered on the establishment with the existing 1–50 km slider (default 50 km).

## Out of scope

- Registry read/confirm flows on mobile detail
- Saúde comercial analytics (LTV, ticket médio, frequência) — stays deferred, not even mocked
- `facility_competitor_product_standards`
- Conformity record *management* from mobile (status is shown read-only in Sinais; editing conformity records is out of scope)
- Real photo upload / gallery viewer (F-013 is mocked-preview only until Phase 2)
- Real facility-notes persistence (F-014 is in-memory only until Phase 2)
- Real suggestion-review backend for per-field edits (F-015 is a mocked snackbar until Phase 2)
- Explore list filter fixes (separate task; noted as follow-up)
- Team-wide visit history (visits remain per authenticated user)

## Follow-up tasks (not blocking v1)

- Explore: refetch on filter apply; map `commercialStatus` filter values; product filter by catalog UUID
- Map tab: marker tap → establishment detail
- `GET /orders?facilityId=` for global orders screen filter
- Link “Ver todos” pedidos to filtered orders list

## Open questions (resolved)

| Question | Resolution |
|----------|------------|
| Administrative professionals source | `facility_representatives` CRM table |
| Nearby radius default | 50 km, centered on establishment (full-screen map) |
| Doctors view | CRM confirmed only |
| Convênios in v1? | Yes, via healthcare provider shares |
| Health/products/signals? | Saúde comercial deferred; Sinais (status signals) and Produtos em uso added in v2 (mocked); Pedidos section kept regardless |
| Persist spec? | This document |

## Open questions (resolved — v2 redesign)

| Question | Resolution |
|----------|------------|
| What are "Sinais"? | Concrete DB fields: `commercialStatus`, `purchaseStatus`, `conformityStatus`, computed `lastPurchaseAt` — not a narrative alerts engine |
| Nearby map style | Inline compact preview (~2.5 km) + scrollable list on the page; tap → existing full-screen slider map (both kept) |
| Pedidos presentation | Keep as its own section, redesigned richer (stats row + cards), not merged into visits |
| Visit history richness (sentiment, attendees, sample, linked order, summary) | Mocked only in v2; real visit schema unchanged |
| Per-field edit pattern | Suggestion-flow bottom sheet (mirrors `FACILITY_FIELD_UPDATE` review concept), mocked in v2 |
| Notas de campo / Fotos da clínica | Build both, mocked in v2; add `profile_picture_id` to `facilities` in Phase 2 |
| Saúde comercial / Produtos em uso | Saúde comercial stays fully deferred; Produtos em uso comes back, mocked in v2 |
| Map radius default (inline preview) | Small fixed preview radius, large full-screen default — `small_preview_large_fullscreen` |

## Open questions (resolved — v3 polish pass)

| Question | Resolution |
|----------|------------|
| Where do Sinais chips live now? | Inline in the fixed header; the standalone "Sinais" card is removed from the scroll |
| Does the header scroll with the page? | No — it is fixed above the scrollable `ListView`, blue background |
| Where does Consultor responsável go? | Bottom of the section list, right before Dados administrativos; "Território" row dropped |
| How does a rep row lead to a "full profile"? | Pushes a new `RepresentativeDetailScreen` built from already-loaded data (mocked, no new endpoint yet) |
| Médicos card content when simplified? | Phone/e-mail contact rows + one badges area (role badge + flags); personal fields dropped from this card |
| Produtos em uso / Histórico de visitas status | Unmounted from the screen pending a product call on whether they return; underlying code untouched |

## Open questions (resolved — v4 header alignment + relationship rating)

| Question | Resolution |
|----------|------------|
| Should Profissionais administrativos behave differently from Médicos? | No — identical `PageView` card structure, badge/header pattern, and contact-row behavior |
| How is "Relacionamento" scored/displayed? | 0–10 scale mapped to 5 stars (2 pts/star, half-star increments); amber filled, light-grey outline for real empty positions |
| How to distinguish "no score yet" from "a real low score"? | `null` renders all 5 stars as faint/reduced-opacity outlines; any non-null score (including 0) renders normal-opacity outlines for its empty positions |
| Backend field for relationship score? | Not yet — Phase 2 scope, mocked only in this pass |

## Open questions (resolved — v5 header bugfix, photo viewer, header contact/legend, pedidos items)

| Question | Resolution |
|----------|------------|
| Why was "Ver todos"/"Editar" drifting away from the right edge? | `ClinicSectionHeader`'s title (`Flexible`, flex 1) and its trailing `Spacer` (flex 1) split leftover space 50/50 instead of the spacer claiming all of it — fixed by wrapping title+badge in a single `Expanded` |
| Where does "Fotos da clínica" live now? | Tapping the header avatar opens a full-screen swipeable viewer; the old scrollable row/section stays in the codebase, unmounted |
| What shows in the photo viewer without real photo URLs? | One colored placeholder card per photo (`PhotoGallerySummary.thumbnailColors`, cycled if fewer colors than photos), with a page-dot indicator and "n / total" counter |
| How is each Sinais chip's meaning conveyed? | An inline category prefix inside the same pill ("Status: Ativa") rather than a separate legend/key; only Status + Compra chips are shown in the header (Conformidade dropped) |
| Where does the header's phone/e-mail come from? | A new mocked `EstablishmentDetailSections.phone`/`.email` (falling back to the live `ClinicDetail.phone`/`.email`), since the real API record for the test facility had none populated |
| Where does "Toque nos ícones…" live? | Bottom of the screen, below "Dados administrativos" — not above the first section |
| Does the header show clinic contact info? | Yes — phone and e-mail rows below the address, using the existing `contact_actions.dart` tap-to-call/e-mail helpers |
| How do Pedidos cards show items without growing? | A full-width items table (item-count row and separate total row both dropped as redundant): up to 2 item lines (name first, `qty×` right-aligned) + "Subtotal:" as the only monetary figure, with a "+N itens" row (not a bare "…") replacing anything beyond that; card height retuned so the tallest card has ~0px of slack above "Ver detalhes" |
| Where do the status/type badges live now? | Inline next to the order date, not on their own row — the type badge (Venda/Consignação/Doação/Outro) is new, styled neutral gray so it doesn't compete with the status color |
