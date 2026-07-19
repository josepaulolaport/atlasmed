# Spec 0005 — Frontend inventory & backend gap tracker

**Status:** Part A inventory done · §0 plan approved · **implementation frozen** pending API architecture review  
**Branch:** `feature/establishment-detail-backend-20260719` (inventory) → follow-on architecture branch  
**Related:** [requirements.md](./requirements.md), PR #95 (merged to `main`)  
**UI language:** pt-BR · **This document:** English  

## Purpose

Track what the mobile establishment-detail experience does today (mostly Phase 1 mocks), then — **after approval of each section** — compare with API/DB, design contracts, implement backend, and wire the app.

We work **one section at a time**. Do not start Part B (backend/DB) for a section until that section’s Part A is approved.

## Process (locked)

1. **Part A — Frontend inventory** (this document, below) — what the UI shows/does and where data comes from today.  
2. **Review** — approve section order and any product clarifications.  
3. **Part B — Backend/DB comparison** — per section, against existing schema and routes (prefer fit; change only when necessary). Align create/associate flows to the DB model.  
4. **Part C — Design + implement backend** — case-by-case endpoints/DTOs; SOLID-friendly module layout; leave room for authz later (do not block on roles now).  
5. **Part D — Wire mobile** — replace mocks; keep pt-BR UI.  

Auth/permissions: note “authz later” hooks; do not design full CASL matrices in this pass unless a section cannot ship without them.

## Current data split (global)

| Provider / path | Source today |
|-----------------|--------------|
| `clinicDetailProvider` → `GET /api/v1/facilities/:id` | **Real API** (shell identity + partial contact) |
| `establishmentDetailSectionsProvider` → `establishment_detail_mock.dart` | **Mock** (400 ms delay; `:empty` suffix → empty fixture) |
| `facilityPayersOverrideProvider` | **Local session** override after Fontes Pagadoras edit |
| `clinicVisitsProvider` → `GET/POST …/facilities/:id/visits` | **Real API** (quick action “Visita”; rich visit timeline UI is unmounted) |
| Cadastros ops queue / associate lists / field notes / Cadastro docs | **Local mock / in-memory** |

Entry route: `/workspace/clinic/:id` → `ClinicDetailScreen`.

---

## Proposed work order

Ordered for dependency and sequential delivery (can be reordered after review):

| # | Section | Why this order |
|---|---------|----------------|
| 0 | Shell & providers | Foundation; kills dual mock/API sources |
| 1 | Header | Depends on enriched facility DTO + signals/photos |
| 2 | Quick actions | Mostly wire; Visita already real |
| 3 | Top shortcuts (Cadastro + Dados administrativos) | Depends on docs API + enriched facility fields |
| 4 | Mapa e clínicas próximas | Needs coords + geo list |
| 5 | Profissionais administrativos | Representatives CRUD/associate; DB-aligned |
| 6 | Médicos (CRM) | Facility↔professional links; DB-aligned create |
| 7 | Fontes Pagadoras | Shares + catalog |
| 8 | Pedidos recentes | Facility-scoped orders |
| 9 | Notas de campo | Likely new table |
| 10 | Consultor responsável | Assignment / consultant fields |
| 11 | Suggest-edit / Dados administrativos detail | Suggestion pipeline |
| 12 | Cadastro documents (rep flow) | Upload + storage |
| 13 | Ops Cadastros queue | Review workflow (may share tables with §12) |
| — | Unmounted / deferred | Product decision only |

---

# Part A — Frontend inventory

For each section: UI, fields, source, mutations, empty/error, open questions.

---

## §0 — Shell & providers

**Paths**

- `apps/mobile/lib/features/explore/presentation/screens/clinic_detail_screen.dart`
- `…/providers/explore_provider.dart` (`clinicDetailProvider`, visits)
- `…/providers/establishment_detail_provider.dart`
- `…/data/clinic_detail.dart`, `establishment_detail_models.dart`, `establishment_detail_mock.dart`

**UI / actions (pt-BR)**

- Loading: blue header shimmer + skeleton cards  
- Error: “Não foi possível carregar o estabelecimento” + “Tentar novamente” / “Voltar”  
- Pull-to-refresh: invalidates shell + sections + visits  

**Fields from API shell (`ClinicDetail`)**

Mapped today: `id`, `name`, `city`(+state), `distanceKm`, `doctorCount`←`professionalCount`, `phone`, `email`, `website`, `streetAddress`, `taxIdType`, `cnpj`, `cpf`.

Model also has (often unused / not mapped from API): `consultantName`, `responsibleDoctor`, `openingHours`, `registeredSince`, `neighborhood`, etc.

**Mutations:** none on load.

**Decisions (2026-07-19)**

- [x] Single source of truth: facility DTO for identity/contact/address/coords; drop mock dual-source for those fields.  
- [x] Per-section providers/endpoints (not a composite sections bundle).  
- [x] §0 = enrich `GET /facilities/:id` (+ mapping) only; section lists later.  

**Approval:** ☐ (see Part B §0 plan below)

---

## §1 — Header (fixed blue)

**Paths:** `clinic_header_section.dart`, `clinic_photo_viewer_screen.dart`

**UI / actions**

- Back; bookmark → snack “Favoritos — em breve”  
- Avatar tap → photo viewer, or snack “Nenhuma foto cadastrada”  
- “Estabelecimento PF” / “Estabelecimento PJ”  
- Chips: **Status:** / **Compra:** (Conformidade not shown)  
- Specialty line (from doctors), full address, tappable phone/email  

**Fields:** hybrid — API identity + mock `statusSignals`, `taxIdType`, `specialtiesLabel`, `location.formattedAddress`, `phone`/`email`, `photos`.

**Mutations:** none.

**Empty:** if sections still loading/null, degrades to name + status chip.

**Open questions**

- [ ] Ship Favoritos in this program or leave deferred?  
- [ ] Photo gallery: facility photos table + `profile_picture_id` as in Spec F notes?

**Approval:** ☐  

---

## §2 — Quick actions

**Path:** `_QuickActions` in `clinic_detail_screen.dart`

| Action (pt-BR) | Behavior today | Persist |
|----------------|----------------|---------|
| Ligar | `tel:` from `detail.phone` | — |
| WhatsApp | wa.me from phone | — |
| Rota | snack — needs coordinates integration | no |
| Visita | `POST …/facilities/:id/visits` | **yes (API)** |
| Pedido | navigate `/pedidos/novo` | order module |

**Open questions**

- [ ] Rota: Maps deep-link only, or in-app routing later?  
- [ ] Pedido: must pre-fill `facilityId` when wiring?

**Approval:** ☐  

---

## §3 — Top shortcuts

**Path:** `clinic_top_shortcuts_section.dart`

| Card | Badge | Opens |
|------|-------|-------|
| **Cadastro** | Completo / `N pendentes` | `ClinicRegistrationDocumentsScreen` (§12) |
| **Dados administrativos** | Completo / `N pendentes` | `ClinicAdminInfoScreen` (§11) |

Cadastro badge counts docs in `missing`/`rejected`. Admin badge counts empty tax/address/phone/email/website/responsável/horário (“Cliente desde” excluded).

**Approval:** ☐ (detail in §11–§12)  

---

## §4 — Mapa e clínicas próximas

**Paths:** `clinic_location_section.dart`, `clinic_location_map_screen.dart`, `clinic_nearby_map_screen.dart`

**UI / actions**

- Section “Mapa e clínicas próximas”  
- Mini-map; **Expandir** → own-pin-only full map  
- Strip “CLÍNICAS NO RAIO DE 5 KM: N”; empty copy when none  
- **Ver estabelecimentos próximos** → radius map (1–50 km, default 50), cards, pin callouts, navigate to other clinics  

**Fields:** `EstablishmentLocation{latitude,longitude,formattedAddress}`; `NearbyEstablishment{id,name,lat,lng,distanceKm,specialtyLabel,status,address fields,shortAddress}`.

**Source:** 100% mock nearby list around hashed lat/lng. Mapbox for render only.

**Mutations:** none.

**Open questions**

- [ ] Confirm preview radius stays 5 km and full map default 50 km.  
- [ ] Nearby list: reuse existing `GET /facilities?latitude&longitude&radiusKm` (user-centered today) with facility center?

**Approval:** ☐  

---

## §5 — Profissionais administrativos

**Mounted:** `clinic_admin_professionals_section.dart`  
**Satellites:** `administrative_professionals_list_screen.dart`, `associate_professionals_sheet.dart`, `create_admin_professional_sheet.dart`, `representative_detail_screen.dart`, `facility_associate_mock.dart`

**UI / actions**

- Section + count + **Ver todos**  
- Cards: phone, email, Relacionamento stars, contact-type badge, **Ver perfil completo**  
- Empty: **Associar profissionais**  
- List FAB **+**: search, multi-select, **Criar perfil…**, **Associar (N)**  

**Fields:** `AdministrativeProfessional{id,name,roleTitle,email,phone,contactType,relationshipScore}` — Decisor / Comprador / Profissional.

**Source:** mock sections; associate/create merge into **list-screen local state only** (not provider, not API).

**Open questions (critical for DB alignment)**

- [ ] Confirm target table(s): `facility_representatives` (and fields).  
- [ ] Create profile: insert representative row only, or also a global person entity if one exists?  
- [ ] `relationshipScore`: persist now, later, or drop from API v1?

**Approval:** ☐  

---

## §6 — Médicos (CRM)

**Mounted:** `clinic_crm_doctors_section.dart`  
**Satellites:** `doctors_list_screen.dart`, `associate_doctors_sheet.dart`, `create_doctor_profile_sheet.dart`, `facility_roster_filter_sheet.dart`  
**Nav:** `/workspace/doctor/:id` (doctor detail uses **real** `GET /professionals/:id` — separate from facility roster mock)

**UI / actions**

- Section + count + **Ver todos**  
- Cards: specialty, CRM, phone/email, Prescritor/Comprador/Decisor + roleBadge, Relacionamento, **Ver perfil completo**  
- Empty: **Associar médicos**  
- Filters: Especialidade / Papel; FAB associate + create (Nome, Especialidade, CRM, Telefone, E-mail, papel chips)  

**Fields:** `FacilityCrmDoctor` (+ personal fields mocked but not on card: education, birthday, team, interests, noteText).

**Source:** mock roster. Spec target: `GET /facilities/:id/professionals?view=confirmed`.

**Writes:** associate/create local to list screen only.

**Open questions (critical for DB alignment)**

- [ ] Create = insert `professionals` + facility link (confirm table/join name)?  
- [ ] Associate = link existing professional to facility only?  
- [ ] Flags (prescriber/buyer/decision-maker): which columns exist today?

**Approval:** ☐  

---

## §7 — Fontes Pagadoras

**Mounted:** `clinic_payers_bar_section.dart`  
**Editor:** `edit_payer_sources_screen.dart`, catalog `payer_catalog_mock.dart`

**UI / actions**

- Section renamed from Convênios; **Editar** always available  
- Donut + principal fonte + legend  
- Empty: **Cadastrar fontes**  
- Editor: ±5% / numeric %, sum must be 100% (empty save clears), **Adicionar** multi-select catalog, **Salvar**  

**Fields:** `PayerShare{id,name,sharePercent}`; `PayerMixSummary{…}`; catalog ~15 names.

**Source:** mock; after save → `facilityPayersOverrideProvider` (session only).

**Open questions**

- [ ] Confirm existing shares API/table names and write contract (replace-all vs patch).  
- [ ] Catalog: existing healthcare-providers endpoint or new?

**Approval:** ☐  

---

## §8 — Pedidos recentes

**Path:** `clinic_orders_section.dart`

**UI / actions**

- Count + **Ver todos** → `/pedidos`  
- Cards: status + type badges, date, up to 2 line items + “+N itens”, **Subtotal:**, **Ver detalhes** → `/pedidos/:id`  
- Empty: **Criar pedido** → `/pedidos/novo`  

**Fields:** `FacilityOrderSummary` + `FacilityOrderItemSummary{productName,quantity,unitPrice}`.

**Source:** mock. Spec: facility-scoped orders; REP sees own sales.

**Mutations:** none on section (navigation only).

**Open questions**

- [ ] `GET /facilities/:id/orders` vs `facilityId` query on existing list?  
- [ ] Items preview: embed in list DTO or N+1 detail fetches?

**Approval:** ☐  

---

## §9 — Notas de campo

**Path:** `clinic_field_notes_section.dart`

**UI:** “Adicionar nota”; sheet “Nova nota de campo” / privacy copy “Só você verá…”; local list.

**Fields:** `FacilityFieldNote{id,text,createdAt}`.

**Source/writes:** mock seed + local `State` (lost on leave). No API.

**Open questions**

- [ ] Private per-user vs shared facility notes?  
- [ ] Confirm new `facility_notes` (or reuse something existing)?

**Approval:** ☐  

---

## §10 — Consultor responsável

**Path:** `clinic_context_section.dart`

**UI:** name; “consultor responsável · desde …”; Região (city · zone). Territory row removed.

**Fields:** mock `consultantName`, `consultantSince`, `regionZoneLabel` (+ `detail.city`). `territoryLabel` mocked but not shown.

**Open questions**

- [ ] Source: consultant-assignments API vs fields on facility DTO?

**Approval:** ☐  

---

## §11 — Suggest-edit & Dados administrativos

**Paths:** banner in `clinic_detail_screen.dart`; `clinic_admin_info_screen.dart`, `clinic_admin_info_section.dart`, `editable_field_row.dart`, `edit_suggestion_sheet.dart`

**UI:** bottom banner; field rows CNPJ|CPF, Endereço, Telefone, E-mail, Site, Responsável, Horário, Cliente desde; “+ Completar” / pencil → “Sugerir alteração” → snack only.

**Source:** API `ClinicDetail` (often sparse → high “pendentes”).

**Open questions**

- [ ] Suggestion pipeline (`FACILITY_FIELD_UPDATE` or equivalent) in scope for first backend slice?  
- [ ] Or read-only admin fields until suggestions exist?

**Approval:** ☐  

---

## §12 — Cadastro documents (rep)

**Paths:** `clinic_registration_documents_screen.dart`, `clinic_registration_document_detail_screen.dart`, `clinic_document_viewer_screen.dart`, `registration_document_pick.dart`

**Statuses (pt-BR):** Não enviado / Em análise / Aprovado / Rejeitado  

**Actions:** Enviar / Reenviar / Substituir (approved only); camera / gallery / file; preview.

**Writes:** local → `pending` + `localPath`/`mimeType`/`fileName`. No upload API.

**Open questions**

- [ ] Document types fixed enum vs configurable checklist?  
- [ ] Storage: S3/compatible, and which service owns upload URLs?

**Approval:** ☐  

---

## §13 — Ops Cadastros queue

**Paths:** `apps/mobile/lib/features/cadastros/…` — routes `/cadastros`, `/cadastros/:id`  
**Data:** `cadastro_review_mock.dart`, `cadastroReviewQueueProvider`

**UI:** filters Em análise / Aprovados / Rejeitados / Todos; approve / reject with note; clinic snapshot + doc preview.

**Writes:** in-memory only. **Not synced** with facility Cadastro shortcut state.

**Open questions**

- [ ] Same tables as §12?  
- [ ] Who may access queue (authz later — note roles when we get there)?

**Approval:** ☐  

---

## Unmounted / deferred (no backend work unless product reopens)

| UI | Status |
|----|--------|
| Produtos em uso | Widget + mock data kept; unmounted |
| Histórico de visitas (rich timeline) | Unmounted; distinct from real simple visits API |
| Fotos as scroll section | Unmounted; viewer still from header avatar |
| Dedicated Sinais card / CNES chips | Removed from IA |
| Saúde comercial (LTV/ticket/freq) | Never mocked |
| Adicionar à rota de hoje | Removed |
| Favoritos | Snack only |

**Product decision needed before any backend for these.**

---

# Part B — Backend / DB comparison

Template for later sections:

```
### §N — <name>
- Existing tables / columns:
- Existing API routes / DTOs:
- Fit assessment: reuse | extend | new | remove
- Proposed contract (DTOs, verbs):
- Authz placeholder:
- Mobile wire tasks:
- Open questions:
```

---

## Part B — §0 Shell & facility DTO (draft for review)

### Existing tables / columns (`facilities`)

Already in DB (no migration needed for these):

| Column | Notes |
|--------|--------|
| `name` (displayName), `legal_name`, `trade_name` | identity |
| `tax_id_type`, `cnpj`, `cpf` | PF/PJ |
| `country`, `state`, `city`, `neighborhood`, `street_address`, `street_number`, `address_complement`, `postal_code` | address |
| `location` (PostGIS point) | coords — **not extracted today** |
| `phone_number`, `email`, `website_url`, `fax_number` | contact |
| `commercial_status`, `purchase_status`, `conformity_status` | sinais |
| `image_url` | avatar until photo gallery (§ later) |
| `territory_id`, assignment status/source | territory |
| `created_at`, `updated_at`, `deactivated_at` | lifecycle |
| `facility_services` | already returned as `services[]` on detail |

Related but **out of §0**: representatives, professionals, shares, consultant assignments, conformity_records, orders, notes, photos table (none yet).

### Existing API

- `GET /api/v1/facilities/:id` — `GetFacilityUseCase` → `serializeClinic`
- Repository `mapFacility` **hardcodes `lat`/`lng` to `null`** and **omits** phone/email/website/street fields and status enums from `FacilityRecord`
- Mobile `Clinic` / `_fetchClinicDetail` already *expects* `phone`, `email`, `website`, `streetAddress`, `taxIdType`, `cnpj`, `cpf` — but API does not send them, so they stay null and the UI falls back to mock sections

### Fit assessment

**Extend** existing facility read path. No new tables. No new routes.

### Proposed DTO additions on `GET /facilities/:id` (and keep list lean)

Expose on detail (and optionally on list where cheap):

```ts
{
  // existing…
  id, name, neighborhood, city, state, taxIdType, cnpj, cpf,
  lat, lng,                    // from ST_Y/ST_X(location); null if no geometry
  territoryId, territoryAssignmentStatus,
  professionalCount,           // detail: compute or 0; list already has it
  consultantName,              // defer join to §10 unless already easy on findById
  services[],
  createdAt, updatedAt,

  // NEW from existing columns:
  phone,                       // ← phone_number
  email,
  website,                     // ← website_url
  streetAddress,               // ← street_address
  streetNumber,
  addressComplement,
  postalCode,
  commercialStatus,            // header "Status:"
  purchaseStatus,              // header "Compra:"
  // conformityStatus — optional; header does not show it today (leave out of §0 unless you want it)
  imageUrl,                    // header avatar
}
```

**Naming:** keep mobile-friendly JSON (`phone`, `website`) mapped from DB `phone_number` / `website_url` in the serializer (same pattern as `name` ← `displayName`).

**Not in §0 DTO** (no column or wrong layer):

| UI field today | Why deferred |
|----------------|--------------|
| `openingHours`, `responsibleDoctor` | not on `facilities` — §11 / suggestions |
| `specialtiesLabel` | derived from médicos — §6 |
| `formattedAddress` | compose client-side from parts (or small server helper later) |
| `photos[]` gallery | no table yet — later; `imageUrl` enough for avatar |
| Consultant tenure / zone | §10 (`facility_consultant_assignments` + territory) |
| Section lists | per-section endpoints later |

### Backend tasks (§0)

1. Extend `FacilityRecord` (+ list record if needed) with contact/address/status/`imageUrl`.  
2. `mapFacility` / `findById` select: map columns; extract `lat`/`lng` via PostGIS (`ST_Y`, `ST_X`) when `location` present.  
3. Extend `serializeClinic` to emit the new fields (detail path; list can omit heavy ones if we want — **proposal: include contact/status on detail only**, coords OK on both).  
4. Tests: repository mapping + get-by-id HTTP contract; null location → null lat/lng.  
5. Authz: keep existing `read` + `FACILITY` + scope — no change. Leave comment/hook for finer grants later.

### Mobile tasks (§0)

1. Extend `Clinic` API type with `lat`/`lng`, address parts, `commercialStatus`, `purchaseStatus`, `imageUrl`.  
2. Map into `ClinicDetail` (status chips from commercial/purchase; address line from parts; avatar from `imageUrl`).  
3. Header: prefer **facility DTO only** for phone/email/address/PF-PJ/status chips; stop reading mock `sections.phone/email/taxIdType/statusSignals` for those.  
4. Keep `establishmentDetailSectionsProvider` mock for **other sections** until each section is wired (do not delete mock wholesale in §0).  
5. Document architecture note: new sections = dedicated providers, not growing the mock mega-bundle.

### Explicitly excluded from §0 (suggestions)

- New endpoints / composite “sections” API  
- Schema migrations  
- Favoritos  
- Photos gallery / `facility_photos`  
- Consultant card data  
- Any write/PATCH expansion beyond what already exists  
- Changing web admin unless types break (prefer additive DTO so web ignores unknown fields)

### Decisions locked (2026-07-19)

1. **List vs detail:** contact/status/`imageUrl` on **detail only**; derived `lat`/`lng` on **both** (read-time from PostGIS `location`, not separate columns).  
2. **`conformityStatus`:** omit from §0 DTO; leave for later.  
3. **`consultantName` on detail:** wait until §10.  
4. **§0 plan approved** — but **implementation paused** until the API architecture review section below is approved.

**§0 plan approval:** ☑ (implement after architecture review)  

**Note on lat/lng:** DB stores only `location` (geometry). API exposes `lat`/`lng` as derived JSON for clients (Mapbox). Not a second persisted column.

---

# Part C / D — Implementation log

| Section | Backend PR | Mobile wire PR | Notes |
|---------|------------|----------------|-------|
| | | | |

---

## Document history

| Date | Change |
|------|--------|
| 2026-07-19 | Part A frontend inventory created (post–PR #95 merge). |
| 2026-07-19 | §0 decisions locked; Part B §0 draft plan added. |
| 2026-07-19 | §0 implementation frozen pending API architecture review; incomplete API WIP reverted. |
