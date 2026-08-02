# Spec 0005: Mobile Establishment Detail (Estabelecimento / Clínica)

**Status:** Approved for implementation — redesign addendum (v27)  
**Last Updated:** 2026-07-22  
**Domains:** `apps/mobile`, `apps/api` (additive contract changes)  
**Related:** [Spec 0002 — Facility and Professional CRM](../0002-clinic-doctor-crm/requirements.md), [Spec 0003 — Territory Management](../0003-territory-management/requirements.md), [Spec 0006 — Shared Territory Coverage & Clinic-Level Ownership](../0006-shared-territory-clinic-ownership/requirements.md) (deferred; may affect `regionZoneLabel` / ownership semantics later), [api-mobile integration guide](../../ai/integration-tasks/api-mobile.md)

> **Product deferral note (2026-08-02):** all user-facing order entry points are temporarily unmounted because the orders capability is reserved for future use. The main drawer no longer lists **Pedidos**, and the establishment detail no longer renders the **Pedido** quick action or **Histórico de pedidos** section. Routes, screens, repositories, models, and API integration remain in the codebase for later reactivation.

> **v2 note:** a visual reference (real product screenshots) prompted a redesign of the header, several new sections and a per-field edit pattern. Decisions 1, 3, 4 (representatives/CRM source) are unchanged. Decisions 2 and 5 below are **superseded** — see "Locked product decisions (v2)". Phase 1 (frontend, mocked) of the redesign has shipped; Phase 2 (backend) is documented but not yet implemented.

> **v3 note:** a review pass on the v2 build produced a second round of frontend-only polish — fixed blue header (no longer scrolls away), the four Sinais chips moved inline into the header (dedicated "Sinais" card removed), CNES service-code chips removed from below the header, full formatted address on the header, "Território" dropped from the consultor card (which also moved to the bottom of the section list), a chevron from each administrative professional row to a new (mocked) representative profile screen, Médicos switched to a snapping `PageView` with a doctor-count badge and essential contact fields (phone/email) instead of the personal-fields set, Convênios legend spacing tightened, Pedidos recentes redesigned to mirror the Médicos card layout (with its own count badge), and both Produtos em uso and Histórico de visitas — plus the "Adicionar à rota de hoje" CTA — removed from the screen (models/widgets kept, just unmounted) pending a product decision on whether they return.

> **v4 note:** a further alignment pass made "Ver todos"/"Editar" placement consistent across every section header (Médicos, Profissionais administrativos, Convênios, Pedidos recentes all now use the same header-trailing pattern), rebuilt "Profissionais administrativos" as a snapping `PageView` card carousel identical in structure to Médicos (was a plain `ListTile` column), and added a "Relacionamento" star rating (0–10 scale, 5 stars) to both the Médicos and Profissionais administrativos cards, rendered as faint/undetermined outline stars when no score exists yet.

> **v5 note:** fixed a real layout bug in `ClinicSectionHeader` (the title and the trailing `Spacer` shared flex equally instead of the spacer claiming all leftover space, which could strand "Ver todos"/"Editar" away from the right edge) and hardened two new header widgets against overflow at narrow widths/long text. "Fotos da clínica" is retired as a standalone scrollable section — tapping the header avatar now opens a full-screen, swipeable `ClinicPhotoViewerScreen` instead. The Sinais chips in the header gained an inline category legend ("Comercial:", "Compra:", "Conformidade:") so each pill's meaning is clear without a separate key, and the header now also shows the clinic's phone/e-mail (tap-to-call/e-mail). "Pedidos recentes" cards moved their status badge inline next to the date and added a new order-type badge there too, dropped both the redundant item-count row and the separate `R$ total` row, and gained a full-width item-preview table (product name first, `qty×` right-aligned, "+N itens" beyond 2 lines) with a computed "Subtotal:" as the card's only monetary figure — the `PageView` height was also retuned so the tallest card has ~0px of dead space above "Ver detalhes".

> **v6 note:** the v5 header phone/e-mail and legend work landed in code but the live network-backed `ClinicDetail.phone`/`.email` were null for the test facility, so nothing rendered — `EstablishmentDetailSections` now carries its own mocked `phone`/`email` (with `ClinicDetail`'s as fallback) so the header reliably shows contact info in Phase 1. The "Comercial" chip category label is renamed to "Status" (clearer than "Comercial" for what's really an overall standing signal), and the "Conformidade" chip is dropped from the header entirely (still tracked on `FacilityStatusSignals`, just not surfaced there). The header also gains an "Estabelecimento PF"/"Estabelecimento PJ" line under the specialties line, from the existing `taxIdType` mock field. Finally, the "Toque nos ícones…" edit-suggestion banner moved from the top of the scrollable content (above "Mapa e clínicas próximas") to the very bottom, below "Dados administrativos".

> **v7 note:** the full-screen nearby map (`ClinicNearbyMapScreen`) gets two interaction upgrades. The horizontal strip of plain `ActionChip`s below the radius slider is replaced with proper clinic cards (`_NearbyEstablishmentCard`: status dot, name, specialty, distance, chevron) — same tap-to-navigate behavior, now visually consistent with the rest of the screen's card language and highlighted when that establishment's pin callout is open. Tapping a **pin** (not the center establishment's own pin) now opens a floating callout/"info window" (`_PinCallout`) anchored above the pin with the clinic's name, status, specialty and distance, plus a "Ver detalhes" action and a close button; tapping empty map area or a different pin dismisses/replaces it. The callout re-anchors on `onMapIdleListener` (after pan/zoom settles) and is cleared whenever the radius slider changes (the previously-selected establishment may no longer be in range). Both features are frontend-only against the existing mocked `NearbyEstablishment` list — no API changes.

> **v8 note:** the v7 callout was a Flutter overlay manually re-anchored on map-idle, which visibly lagged behind its pin during pans/zooms and wasn't "really" attached to the map. It's now rasterized off-screen (`RepaintBoundary.toImage`) and added as a genuine Mapbox `PointAnnotation` (image + `IconAnchor.BOTTOM`), so it tracks the pin natively with zero Flutter-side re-positioning code — trade-off: the bubble is one tappable unit now (navigates to the establishment) instead of having separately-tappable close/"Ver detalhes" sub-widgets, since a rasterized image can't hit-test sub-regions; dismissal still works via tapping empty map, a different pin, or the same pin again (toggle), or the radius slider moving the establishment out of range. Separately, changing the radius slider used to key/remount the whole `MapWidget` (`ValueKey('nearby-map-$_radiusKm')`), which could race an in-flight annotation-manager call against the native view being torn down mid-drag and permanently strand the screen on the offline-placeholder fallback — the map now has a stable key and radius changes instead call `MapboxMap.easeTo` (zoom) plus a **debounced** pin resync (200 ms) so rapid dragging can't crash it. The radius slider itself is now continuous (no `divisions`/snapping — "moves freely" like a volume control) and uses a custom `SliderTheme` (thicker track, larger thumb) for that look. A lightly-shaded `PolygonAnnotation` circle (computed via the spherical destination-point formula, no new dependency) now renders under the pins and grows/shrinks live with every slider tick, showing the radius being searched.

> **v9 note:** three v8 rough edges fixed. (1) The callout bubble rendered visibly smaller than designed on retina devices — Mapbox draws point-annotation images 1 raw pixel : 1 device pixel with no notion of Flutter's logical density, so rasterizing at `pixelRatio: 1.0` handed it an image sized for logical pixels (a 2–3× undershoot on typical phones); it now captures at `MediaQuery.devicePixelRatio` so the bubble renders at its true designed size and stays crisp. (2) The radius slider was still visibly zooming the camera even after the explicit `MapboxMap.easeTo` call in `_onRadiusChanged` was removed, because `MapWidget.viewport` isn't purely an "initial" camera position in this package — it re-applies a transition any time the value changes across rebuilds, and the widget was recomputing `zoom: _zoomForRadius(_radiusKm)` on every slider tick. The zoom is now captured once into `_initialZoom` at first build and never recomputed, so the camera is fully static during slider use (pan/zoom gestures remain user-controlled) and only the `PolygonAnnotation` radius circle reacts. (3) Confirmed the radius circle's geographic radius already matches the slider value exactly (spherical destination-point formula driven directly by `_radiusKm`) — the earlier perceived mismatch was a side effect of (2), since the camera zooming alongside the radius masked the circle's true on-screen growth.

> **v10 note:** the nearby-clinic card strip and map pins are now cross-linked both ways — tapping a `_NearbyEstablishmentCard` pans the map to that clinic (`MapboxMap.easeTo`, center only, zoom untouched) and opens its callout, while tapping a pin (which already opened the callout) now also scrolls the card strip so that clinic's card is centered in the visible viewport (`ScrollController.animateTo`, offset computed from the card's fixed width/spacing). The callout's call-to-action was reworded from "Toque para ver detalhes" to "Ir para página da clínica" for clarity, since the whole bubble navigates on tap. Mapbox's built-in scale-bar ornament (the "0 / 5 km / 10 km" ruler) is now disabled — `ScaleBarSettings(enabled: false)` on `onMapCreated` — on both the full-screen radius map and the small map preview on the establishment detail screen, matching the pattern already used on the territory maps.

> **v11 note:** three more fixes. (1) The callout now has a real close ("X") badge — a second, permanently-cached `PointAnnotation` (rasterized once, since its look never changes) anchored to the same coordinate as the bubble but offset to straddle its top-right corner; both annotations share the callout's tap listener and are told apart via a `customData['action']` of `'open'`/`'close'`, so tapping the badge dismisses instead of navigating. (2) Tapping empty map space was silently resetting the camera to the screen's starting position — root cause was `MapWidget.viewport`: its `CameraViewportState` has no `==` override, so a fresh instance built on *every* rebuild (even with identical values) reads as "changed" to the package's internal diffing and re-triggers a camera transition, undoing any pan/zoom the moment any `setState` fired (e.g. `_dismissCallout`). Fixed by supplying `viewport` only once — `null` from `onMapCreated` onward — matching the pattern already used on the territory maps; all camera movement past first load now goes through imperative `MapboxMap.easeTo` calls instead of the declarative prop. (3) The radius slider's camera behavior was redesigned per product decision: instead of leaving the camera untouched (v9), changing the radius now always re-centers on the establishment the page belongs to and eases to a zoom computed from a Web-Mercator fit formula (given the radius and an estimate of the visible map area minus header/panel chrome), so the shaded radius circle stays fully visible — growing or shrinking on screen — however far the user has panned away.

> **v12 note:** the v11 auto-fit zoom formula visibly didn't match the circle's real size (a 19 km radius rendered as a circle far larger on screen than the chosen zoom implied) — the hand-rolled Web-Mercator math assumed a 256px-tile zoom convention that doesn't line up with the Mapbox SDK's own, and baking in a fixed height for the (at the time still overlapping) radius panel was an additional source of drift. Replaced entirely with `MapboxMap.cameraForCoordinatesPadding`, fed the radius circle's actual boundary points (`_circlePositions`) plus a flat 32px breathing-room padding — Mapbox computes the fit itself against the real device viewport, so there's no tile-size assumption to get wrong, and since the boundary is a perfect circle around the establishment, the fitted center comes back equal to it for free. Runs on every slider change and once more right after the style loads (correcting the coarse zoom bucket used for the very first, declarative viewport, before a live `MapboxMap` exists to query). Separately, the radius panel (slider + card strip) was moved out of the `Stack` entirely — it's no longer a floating, shadowed card positioned over the bottom of the map, but a plain white section *below* the map as a normal sibling in the screen's `Column`, separated by a hairline instead of elevation/rounding. This was the other half of the "circle looks wrong" complaint: with the panel no longer occluding roughly the bottom third of the map, the auto-fit calculation no longer needs to reserve space for it, and the whole circle is now genuinely within the visible, tappable map area.

> **v13 note:** split the inline map preview's two destinations apart, per product decision. "Expandir" and tapping the mini preview itself now push a brand-new, deliberately minimal `ClinicLocationMapScreen` — a full-screen map showing *only* this establishment's own pin, no nearby pins, no radius controls; the richer radius-slider experience (`ClinicNearbyMapScreen`) is reachable exclusively through the dedicated "Ver estabelecimentos próximos" button now. The inline "Clínicas no raio" list was converted from a vertical `ListTile` list to a horizontal card strip using the same card language as `ClinicNearbyMapScreen`'s own nearby-clinic strip (status dot, name, specialty, distance, chevron), and its radius tightened from 2.5 km to 5 km (`establishmentNearbyPreviewRadiusKm`) — anything beyond that is only reachable via the nearby-clinics map. Each inline card is a "Ver mais" affordance: tapping it opens `ClinicNearbyMapScreen` with a new `initialFocusId` param, which (once the style loads) eases the camera to a tight zoom on that specific establishment, opens its callout, and centers its card in that screen's own strip — reusing the same camera-pan/callout/scroll-to-card logic already built for tapping a card or pin inside the nearby map itself.

> **v14 note:** small polish pass on the "Clínicas no raio" inline section. The establishment's own full formatted address (already duplicated on the header since v3) was dropped from below the mini-map preview, and the redundant "`N` dentro de `X` km" row next to "Expandir" was folded into the section label itself, which now reads "CLÍNICAS NO RAIO DE `5` KM: `N`" (radius + live count in one place instead of two). `NearbyEstablishment` gained real address fields — `neighborhood` / `streetAddress` / `streetNumber` / `addressComplement`, mirroring the same columns already on `facilities` — plus a computed `shortAddress` getter (e.g. "Rua Augusta, 2200 - Conjunto 12 — Jardim Paulista") that both the inline card strip and `ClinicNearbyMapScreen`'s own `_NearbyEstablishmentCard` strip now render under the specialty line; both card strips grew taller (96→132px inline, 92→128px on the map screen) to fit the extra line without overflowing.

> **v15 note:** two top shortcut cards sit directly under the quick-actions strip (above "Mapa e clínicas próximas"), each shaped as `ícone · Título · Badge · >`. **Cadastro** opens a dedicated registration-documents screen (`ClinicRegistrationDocumentsScreen`) — mocked list of required docs (alvará, licença sanitária, CNPJ/contrato social, responsabilidade técnica, certificado CNES) with review statuses `missing`/`pending`/`approved`/`rejected`, camera/gallery upload that flips status to `pending` locally (no `facility_documents` table or upload API yet). **Dados administrativos** opens `ClinicAdminInfoScreen`, which reuses the same `ClinicAdminInfoSection` field list that used to live inline at the bottom of the detail scroll — that bottom section is removed from the main screen entirely. Both cards carry a completeness badge (`Completo` / `N pendentes`); Cadastro counts docs needing action (`missing`/`rejected`), Dados administrativos counts empty editable fields (tax ID, address, phone, email, website, responsible doctor, hours — "Cliente desde" excluded). iOS `Info.plist` gains `NSCameraUsageDescription` for the document photo flow.

> **v16 note:** Cadastro UX deepened around preview + non-image uploads. The list is now a compact summary (icon, title, file name / "nenhum arquivo", status pill, chevron) — tapping a row opens a dedicated `ClinicRegistrationDocumentDetailScreen` with status, reviewer note, a tappable attachment preview ("Ver completo"), and send/resend/replace actions. Preview opens `ClinicDocumentViewerScreen`: real pinch-zoom for images with a local path, and a full-screen file-type canvas for PDFs/mock attachments (native PDF render deferred until storage backend). Upload bottom sheet gains **Escolher arquivo** via `file_picker` (^8.1) alongside camera/gallery — PDF/DOC/images allowed; `EstablishmentDocument` stores `localPath` + `mimeType` for session preview. Substitute ("Substituir documento") is allowed only when the document is already `approved`; `pending` (em análise) is view-only; `rejected` can be resent after viewing the refused file.

> **v17 note:** ops-facing **Cadastros** approval queue. New drawer item + routes `/cadastros` (list) and `/cadastros/:id` (review). List filters Em análise / Aprovados / Rejeitados / Todos over a mocked in-memory queue (`cadastroReviewQueueProvider`). Review detail shows a clinic snapshot (name, specialty, CNPJ/CPF, address, phone, e-mail, consultor) beside the submitted document preview (reuse of `ClinicDocumentViewerScreen`) and a sticky **Rejeitar** / **Aprovar** bar for pending items — reject collects a mandatory reviewer note in a bottom sheet; approve confirms via dialog. Decisions mutate local mock state only (no API / `facility_documents` table yet).

> **v18 note:** "Ver todos" list screens for Médicos and Profissionais administrativos now reuse the Explorar table chrome: `SearchBarWidget` + tune filter button, `SortRow` with removable filter chips, result count, and hairline `DoctorRow`-style rows (distance hidden in facility context). Doctors filter by specialty (from the facility roster) + papel (Prescritor/Decisor/Comprador); administrativos by tipo (Decisor/Comprador/Profissional). Sort sheet uses a facility-people option set (Nome A–Z). Rows also show phone, relationship stars, and role badges beside specialty/cargo.

> **v19 note:** both Ver todos tables gain a lower-right **+** FAB that opens an associate modal (search bar + multi-select checklist of CRM candidates not yet on the facility). Footer actions: **Criar perfil…** (nested form sheet; on success the new profile is inserted into the modal pool and auto-selected) and **Associar (N)** (merges selection into the local facility list). Doctors and administrativos each have their own pool/form fields (CRM/specialty/papel vs cargo/contact type). Phase 1 mock only — no association API yet.

> **v20 note:** empty/offline fallbacks — Ver todos stays available with empty rosters; empty Médicos/Admin cards offer Associar CTA into the list+FAB flow; facility EmptyState copy points at +; shell load failure shows friendly offline copy + **Tentar novamente**; section error cards retry via invalidate. Associate modals guide to create-profile when the candidate pool is empty.

> **v21 note:** section formerly labeled **Convênios** is renamed **Fontes Pagadoras**. **Editar** opens a full-screen editor (`EditPayerSourcesScreen`): list of sources with ±5% steppers + numeric %, live sum chip (must total 100% to save, empty list allowed to clear), remove row, and **Adicionar** multi-select sheet over a mocked healthcare-provider catalog (search + exclude already-added). Save updates a local Riverpod override so the donut/legend refresh immediately (Phase 1 — no shares API write yet). Empty section offers **Cadastrar fontes**.
>
> **v22 note:** Médicos roster switches from `GET /facilities/:id/professionals?view=confirmed` to `view=all`. Imported CNES links are `source_active` with `confirmed_at` null everywhere in current demo data (0 confirmed rows), so `confirmed` left the strip empty while Explorar/Meili still listed the same doctors via `activeFacilityIds`. `view=all` matches that association set (source-active **or** confirmed). Decision v1 #3 and F-003 are superseded.
>
> **v23 note:** Facility DTO exposes `consultantSince` (`facility_consultant_assignments.started_at` of the active assignment). Equipe responsável prefers live `consultantName`/`consultantSince` from `GET /facilities/:id` over mock sections. Per-field edit pencils / suggestion sheet → PATCH remain deferred (UI stay mock-local).
>
> **v23b note:** `managerName` on the facility DTO is derived from the active consultor's `users.manager_id` (join to manager user). There is no `facility_manager_assignments` table and no `managerSince` — the card shows "gerente responsável" without tenure.
>
> **v24 note:** Remaining wire-up backlog (associate doctors/admins, `territoryName`→região, `facility_notes`, photos, field-suggestions/PATCH, verify payer writes). **Deferred by product:** Sinais chips stay mocked; remounting Produtos em uso / Histórico de visitas stays a product call. Fontes pagadoras GET/PUT already persist.
>
> **v25 note:** `facility_notes` (GET/POST) and `facility_photos` (list/upload/download; first upload sets `facilities.image_url` when null) are live. Mobile header avatar + `ClinicPhotoViewerScreen` load gallery via `GET /facilities/:id/photos` with bearer-auth `Image.network`. Associate doctors/admins + `territoryName`→região already wired. Field-suggestion/PATCH pencils remain deferred.
>
> **v26 note:** Avatar tap opens photo actions (ver fotos / tirar foto / escolher da galeria) and uploads via `POST /facilities/:id/photos` multipart.
>
> **v27 note — Facility Cadastro (PF/PJ docs + billing email):** Reuses `conformity_requirements` / `conformity_records` (no parallel `facility_documents` table). Schema adds `facilities.billing_email`, `conformity_requirements.applies_to_tax_id_type`, and file/reviewer columns on records. Seeded catalog: **PF** → Identidade, CRM, Comprovante de Endereço; **PJ** → Cartão de CNPJ, Licença Sanitária; plus required **Email Administrativo** (`billingEmail`). APIs: `GET /facilities/:id/cadastro`, `PUT …/billing-email`, multipart `POST …/cadastro/requirements/:requirementId/submit`, `GET /facilities/cadastro/files/*`, ops `POST …/cadastro/records/:recordId/approve|reject`, `GET /cadastro/submissions`. When all applicable file docs are `VALIDATED` and billing email is set → `conformityStatus=COMPLETE` and `commercialStatus=ACTIVE`. Facility DTO exposes `commercialStatus`, `conformityStatus`, `billingEmail`. Mobile Cadastro + ops Cadastros queue are live; header Sinais prefer live commercial/conformity (purchase still mocked).

## User Story

As a field rep or manager using the mobile app, I want a complete establishment detail screen with location, administrative contacts, clinical staff, payers, recent orders, and nearby establishments I am allowed to see — so I can plan visits, understand the account, and navigate the territory without switching tools.

## Terminology

| UI (pt-BR) | API / DB |
|------------|----------|
| Clínica / estabelecimento | `facilities` |
| Profissionais administrativos | `public.facility_representatives` |
| Médicos | `public.facility_professionals` + `public.professionals` (CRM, `view=all`) |
| Convênios | `healthcare_providers` + `facility_healthcare_provider_shares` |
| Pedidos | `orders` + `order_items` |
| Estabelecimentos próximos | `GET /facilities` geo query scoped to establishment coordinates |

## Locked product decisions (v1, unchanged)

| # | Decision |
|---|----------|
| 1 | **Administrative professionals** come from `public.facility_representatives` only. Do **not** use registry read endpoints (`/registry/professionals`, `/registry/representatives`) on mobile for this screen. |
| 3 | **Médicos** section shows CRM associations via `GET /facilities/:id/professionals?view=all` (source-active CNES **or** confirmed). **Superseded by v22** (was `view=confirmed`). |
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

## Locked product decisions (v7 — expanded-map cards + pin callout)

| # | Decision |
|---|----------|
| 33 | **The expanded (full-screen) nearby map shows a card per clinic**, not a chip strip. `_NearbyEstablishmentCard` (168×92) shows the status dot, name, specialty and distance, and highlights (blue border/tint) when that establishment's pin callout is currently open. Tapping a card still navigates straight to that establishment's detail (unchanged behavior — only the visual treatment changed). |
| 34 | **Tapping a pin on the expanded map opens a floating callout** with the establishment's name, status, specialty and distance, a "Ver detalhes" action, and a close (×) button. The current establishment's own (blue) pin is not tappable for a callout — only nearby (green) pins are. Tapping empty map area, tapping a different pin, or changing the radius slider dismisses/replaces the open callout. **Superseded by v8 #36** — the callout is now a real map annotation and the close/detail sub-widgets are gone in favor of one tappable bubble. |

## Locked product decisions (v8 — annotation-based callout, slider/radius-circle fixes)

| # | Decision |
|---|----------|
| 35 | **The radius slider is continuous** (no `divisions`, no value-label popup) and restyled via `SliderTheme` (5px track, 9px thumb) to read as a free-moving "volume slider" rather than a stepped one. **A lightly-shaded circle** (`PolygonAnnotation`, ~10% opacity blue fill + faint outline) renders under the pins showing the exact search radius, and its geometry updates on every slider tick (not debounced) so it visibly grows/shrinks as the user drags — this is what makes the radius tangible now that the map itself no longer re-centers/re-zooms jarringly on every tick. |
| 36 | **The pin callout is a real Mapbox `PointAnnotation`, not a Flutter overlay.** The callout content is rendered off-screen, captured via `RepaintBoundary.toImage`, and added to the map as an image-backed point annotation anchored to its bottom tip — it now tracks its pin through pans/zooms with zero Flutter-side re-positioning code (v7's `onMapIdleListener` re-anchoring hack is gone). Because a rasterized image can't hit-test sub-regions, the whole bubble is one tap target that navigates to the establishment; the standalone close (×) and "Ver detalhes" affordances from v7 are dropped — dismissal is tap-empty-map, tap-a-different-pin, tap-the-same-pin-again (toggle), or the establishment falling outside a changed radius. |
| 37 | **Changing the radius no longer remounts the map.** `MapWidget` now has a stable key; radius changes call `MapboxMap.easeTo` for the zoom and a **200 ms debounced** re-sync of the green pins, instead of the old `ValueKey('nearby-map-$_radiusKm')` scheme that tore down and recreated the whole native map/annotation-manager stack on every slider tick. That remount-per-tick was racing an in-flight annotation call against the native view being destroyed mid-drag, which could permanently strand the screen on the offline-placeholder fallback — this was a real, reproducible crash, not just a performance concern. |

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
| 6 | **Médicos** (CRM) — snapping `PageView`, count badge, essential contact fields, badges area | `/professionals?view=all` + associate/create API | wire (list + associate) |
| 7 | **Convênios** — donut chart | healthcare provider shares | mock → wire |
| 8 | **Pedidos recentes** — snapping `PageView` mirroring Médicos card, count badge | facility-scoped orders | mock → wire |
| 9 | **Notas de campo** | `GET/POST /facilities/:id/notes` (`facility_notes`, user-private) | wire |
| 10 | Consultor / gerente responsável (+ tenure, região) | `consultantName`/`consultantSince` live; `managerName` from consultor's `manager_id`; `territoryName` → região | wire |
| — | Sinais chips (header) | commercial/purchase status | deferred (mock) |
| — | Produtos em uso / Histórico de visitas | — | deferred (unmounted; product call) |
| 11 | Dados administrativos — per-field pencils | Facility DTO + representatives fallback for responsável | mock (pencils deferred) |

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
- `consultantSince` (ISO date of active `facility_consultant_assignments.started_at`, omitted when none)
- `managerName` (active consultor's manager via `users.manager_id`; null when no consultor or no manager)
- `services[]` (already on detail)

WHEN a facility has no `location` THEN `lat`/`lng` SHALL be omitted or `null` and the mobile mini-map SHALL show an empty state with address text only.

### F-002 — Administrative professionals

WHEN `GET /facilities/:id/representatives` is called by a user with read access to the facility THEN the system SHALL return active CRM representatives:

- Filter: `ended_at IS NULL`
- Sort: `representative_name ASC`
- Fields per row: `id`, `representativeName`, `roleTitle`, `email`, `phone`, `taxId`, `contactType` (legacy), role flags (`isPartner`, `isAdministrator`, `isDecisionMaker`, `isBuyer`, `isBiller`, `isSecretary`), `relationshipLevel` (caller’s 1–10 from `user_representative_relationships`, optional), `confirmedAt`, `sourceProvider` (optional badge)

WHEN there are no active representatives THEN the mobile UI SHALL show an empty state (“Nenhum contato administrativo cadastrado”).

**Explicit exclusion:** no reads from `registry.facility_representatives` or `/registry/representatives` on this screen. There is **no** global “associate from pool” search for administrativos — create in place via `POST /facilities/:id/representatives`.

**Create / edit:**
- Mobile FAB / empty CTA opens **Criar perfil** directly (no empty associate search sheet).
- `POST /facilities/:id/representatives` accepts role flags; `contactType` is derived on write (`isDecisionMaker` → `DECISOR`, else `isBuyer` → `COMPRADOR`, else `PROFESSIONAL`).
- `PATCH /facilities/:id/representatives/:repId` updates fields, role flags, and optional `relationshipLevel` (null clears the caller’s score).

**Relationship:** per-user 1–10 on `user_representative_relationships`, same privacy model as doctors (`user_professional_relationships`). Editable on the representative profile (5-star UI). UI chips come from role flags (Sócio / Administrador / Decisor / Comprador / Faturista / Secretária), not from `contactType`.

**v3 addition:** each row is tappable and opens a representative profile screen (name, role chips, contact, parent facility, editable relationship).

### F-003 — Médicos (CRM associations)

WHEN the mobile app loads doctors for an establishment THEN it SHALL call `GET /facilities/:id/professionals?view=all` (source-active and/or confirmed; not ended).

Each row SHALL display: display name, specialty, CRM (council/number/state when present), role flags (prescriber, buyer, decision-maker, partner) as subtle chips.

WHEN the user taps role chips (or “Definir papel”) on the Médicos card, or the edit-papel control on Ver todos, THEN the app SHALL open a bottom sheet to toggle facility-scoped flags and persist via `PATCH /facilities/:id/professionals/:professionalId` (`isPrescriber` / `isDecisionMaker` / `isBuyer` / `isPartner`). Editing is clinic-context only — not on the global doctor person record.

WHEN a row is tapped THEN the app SHALL navigate to `/workspace/doctor/:professionalId`. When opened from a facility roster, the app SHALL pass `facilityId` as a query param so the doctor profile can load/edit the caller’s `relationshipLevel` via `PATCH /facilities/:id/professionals/:professionalId`. Without `facilityId`, relationship editing is hidden.

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
- Pin tap → floating callout (a real `PointAnnotation`, see decision #36) with name/status/specialty/distance; tapping the callout (or the card strip's card) navigates to that establishment's detail
- Exclude current establishment from pin list (client-side or `excludeId` query param)
- Establishments within radius also render as a horizontal strip of cards (see decision #33) beneath the radius slider, not plain chips
- A lightly-shaded circle (see decision #35) renders under the pins showing the current search radius, live-updating as the slider moves

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

- `commercialStatus` (`UNREGISTERED` \| `REGISTERED` \| `SUSPENDED` \| `CLOSED`) — pt-BR label + color (Pré-cadastro / Operante / Suspensa / Encerrada), also drives the header status chip and avatar ring color.
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

WHEN the user taps the header avatar THEN a full-screen, swipeable photo viewer (`ClinicPhotoViewerScreen`) SHALL open, showing one photo at a time with a page-dot indicator, an "n / total" counter and a close action; if there are no photos, a "Nenhuma foto cadastrada" snackbar SHALL show instead (**v5**: superseded by decision #25 — this is no longer a standalone scrollable section).

**Shipped (v25/v26):** `facility_photos` table + `GET/POST /facilities/:id/photos` + authenticated `GET /facilities/photos/*` download. Profile image uses `facilities.image_url` (set on first upload when null). Mobile loads gallery via `facilityPhotosProvider` and renders real images with bearer-auth headers. Avatar tap opens a sheet: ver fotos / tirar foto / escolher da galeria (multipart upload). `ClinicPhotosSection` stays unmounted for a future manage-photos entry point.

### F-014 — Notas de campo

WHEN a user opens the "Notas de campo" section THEN they SHALL see a private, facility-scoped, numbered list of notes visible only to them, with a button to add a new one.

**Shipped (v25):** `facility_notes` table + `GET/POST /facilities/:id/notes` (user-private, mirrors professional notes). Mobile `ClinicFieldNotesSection` persists via API.

### F-015 — Per-field suggestion flow

WHEN a user taps the pencil icon next to any editable field (facility admin data: CNPJ, endereço, telefone, e-mail, site, horário; or médico personal fields: Formação, Aniversário, Time, Interesses) THEN a bottom sheet SHALL open showing the field label, current value and a text input to propose a new value.

WHEN the user submits a suggestion THEN the system SHALL create a reviewable, **user-submitted** suggestion for ops review (accept/reject). This is unrelated to CNES registry suggestions.

Empty fields SHALL show a "+ Completar" affordance instead of "—".

**Phase 1 (this redesign):** mocked — submitting shows a "Sugestão enviada para revisão" snackbar; no network call.

**Phase 2 (facility / Não Conformidades):** specified in [Spec 0007](../0007-nao-conformidades/requirements.md) — `public.field_suggestions` + `/field-suggestions` API (user-only; no CNES coupling). Covers administrative field edits + deactivation; supersedes older pending on resubmit; address accept MUST geocode `facilities.location`. `commercialStatus` editing is a separate flow. Professional personal-field suggestions remain deferred beyond 0007 v1.

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
8. Facility Não Conformidades backend per [Spec 0007](../0007-nao-conformidades/requirements.md) (F-015 Phase 2). Professional personal-field suggestions remain deferred.
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
