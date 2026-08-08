# ADR 0004: Unified Person + Facility Affiliation Model

## Status

**Accepted — schema + API/mobile wave landed** (Slice C `0051` + after-schema STEPs + role seed `0054`).  
§10 questions resolved. This file remains the design SoT; path freezes in §6.2 / §6.4 match as-built routes.

**Living document:** update when decisions change.  
**Legend:** `LOCKED` = decided · §6.2/§6.4 freezes = shipped in this wave.

**See also (P0 wave merge with DB triage):** [`docs/ai/db-overhaul-merged-p0.md`](../../ai/db-overhaul-merged-p0.md) — clash resolutions + slice order with triage P0. Person shape still owned here.

**ID / blast (via merge doc M11/M12):** CRM PKs = `bigint` identity; hard wipe OK (app not live). In-wave apps = database + api + mobile; web deferred.

Last updated: 2026-08-07 (docs retarget — status reflects as-built)

---

## 1. Context

### 1.1 Problems in current schema

| Current | Issue |
|---|---|
| `professionals` | Mixes identity + healthcare (CRM, CNES id, specialty, primary occupation) |
| `facility_professionals` | Association + fake CBO (`LEGACY`/`MED`) + commercial booleans; unique includes `occupation_code` ⇒ multi-CBO multi-rows |
| `facility_representatives` | Duplicated person fields; no shared identity FK; role booleans + `contact_type` |
| Notes / relationship tables | Split across professional vs representative |

FE needs two sections (Médicos / Administrativos). Same human can exist twice.

### 1.2 Constraints

- Empty CRM DB → hard cut OK  
- Correct scalable model preferred over lean shortcuts  
- Semantic column types; no blind columns  
- No catalog **data** seeds until post-overhaul (exception: two classification codes — §6.5)  
- Feature docs retargeted to as-built person model; **this ADR** remains design SoT  

### 1.3 Separated concepts

| Concept | Meaning |
|---|---|
| Person | One real human (`persons`) |
| Healthcare profile | Optional qualification (`person_healthcare_profiles`) |
| Specialty | Healthcare specialty on **profile** (≠ CBO) |
| Registration | Council registration on **profile** (CRM/CRO/…) |
| Person–facility | One active affiliation (`person_facilities`) |
| Occupation (CBO) | Work performed **at a facility** |
| Classification | FE section at a facility (healthcare vs administrative) |
| Role | AtlasMed responsibility at a facility (prescriber, buyer, …) |

CNES ingest mapping (when/if reintroduced): many CNES rows → one person → one active `person_facilities` per facility → many occupations under that link.

---

## 2. Locked architecture decisions (D1–D21)

| ID | Lock | Detail |
|---|---|---|
| D1 | Unify identity | All external humans → `persons` |
| D2 | Name `person` | Not `user` / `contact` / keep `professional` |
| D3 | Plural tables | `persons`, `person_facilities`, … — no full-DB singular rename |
| D4 | Healthcare profile 1:1 | Registrations hang off profile |
| D5 | One active affiliation | Unique `(facility_id, person_id)` WHERE `ended_at IS NULL` |
| D6 | Classification catalog + assignments | Not flags/array |
| D7 | Role catalog + assignments | No role seed data in overhaul |
| D8 | Remake `occupations` + `person_facility_occupations` | No `LEGACY`/`MED` as CBO |
| D9 | Catalog name `occupations` | Not `facility_occupations` |
| D10 | Registrations + council + type catalogs | Catalogs empty until later |
| D11 | `person_notes` + `user_person_relationships` | User-scoped privacy; notes have **no** `facility_id` — `facility_notes` stays separate |
| D12 | Separate projection APIs | Not one sparse `/people` resource |
| D13 | CASL `PERSON` | Replaces `PROFESSIONAL` |
| D14 | Hard cut | Old tables removed; notes/relationships rewired to person |
| D15 | FKs → `persons` | `orders.person_id`, `field_suggestions.person_id` |
| D16 | Meili healthcare-only | Index people with healthcare profile |
| D17 | Inventory + structural (+ explicit catalogs) | Specialties catalog is an explicit exception |
| D18 | Person module owns domain | Facility HTTP may adapt; no person persistence in facility module |
| D19 | ADR before code | This document |
| D20 | Two classification codes only when API wires | No other catalog seeds |
| D21 | Drop `contact_type` | Roles replace it |

### 2.1 Rejected (do not revive without new decision)

Dual identity; hybrid reps; whole-DB singular; person-subgraph singular only; single `/people` sparse API; facility owns affiliations; long dual-write; seed all catalogs in overhaul; name CBO catalog `facility_occupations`; keep `contact_type`.

### 2.2 Standing rules

1. Semantic types always.  
2. No blind columns.  
3. No full catalog seeds until post-overhaul (D20 exception).  
4. Soft-delete via `persons.deleted_at`; hard delete cascades.  
5. Patch this ADR on every answer.

---

## 3. Explicitly out of scope (this overhaul)

Do **not** add unless a new decision lands:

- Weekly hour fields on occupations  
- Rich `source_provider` / `external_source_key` / `source_*` on affiliations (links are always manual — Q21)  
- Formal RQE / separate specialty model beyond `healthcare_specialties`  
- Employment-type **catalog** (free-text `employment_type_code` may remain — §5.8)  
- Identity-resolution merge UI / fuzzy match engine (empty DB; document future order only — §9)  
- CNS as separate field from `cnes_professional_id` (not in current schema as distinct)  
- Renaming entire existing schema to singular  
- Reintroducing CNES registry warehouse  

---

## 4. Drop / keep / rename

### Drop

`professionals`, `facility_professionals`, `facility_representatives`, `professional_notes`, `user_professional_relationships`, `user_representative_relationships`, `contact_type` enum, old `occupations` PK-as-code shape.

### Keep unchanged

`facility_notes` (user × facility).

### FK renames

| Table | Change |
|---|---|
| `orders` | `professional_id` → `person_id` **FK → `persons.id`** |
| `field_suggestions` | `professional_id` → `person_id` **FK → `persons.id`** |

---

## 5. Complete schema design

All §5 tables below are **LOCKED** for schema work.

### 5.1 `persons` — LOCKED

| Column | Type | Null | Keys | Notes |
|---|---|---|---|---|
| `id` | `bigint` identity | NO | **PK** | |
| `first_name` | `text` | NO | | |
| `last_name` | `text` | NO | | No `full_name` |
| `social_name` | `text` | YES | | |
| `cpf` | `char(11)` | YES | partial **UNIQUE** WHERE `cpf IS NOT NULL AND deleted_at IS NULL`; **CHECK** `cpf IS NULL OR cpf ~ '^[0-9]{11}$'` | **Q13 = A.** Renamed from `tax_id`. Digits only; not integer (leading zeros) |
| `birth_date` | `date` | YES | | |
| `mobile_phone` | `text` | YES | | |
| `landline_phone` | `text` | YES | | Ambiguous single phone → mobile |
| `email` | `text` | YES | | |
| `website_url` | `text` | YES | | |
| `image_url` | `text` | YES | | |
| `image_blurhash` | `text` | YES | | |
| `favorite_team` | `text` | YES | | |
| `favorite_sport` | `text` | YES | | |
| `languages` | `text` | YES | | |
| `hobbies` | `text` | YES | | |
| `deleted_at` | `timestamp` | YES | idx | |
| `created_at` | `timestamp` | NO | | default now |
| `updated_at` | `timestamp` | NO | | default now |

Indexes: `(last_name, first_name)`, phones/email as needed for search later.

---

### 5.2 `person_healthcare_profiles` — LOCKED (Q14 sanity note remains)

| Column | Type | Null | Keys | Notes |
|---|---|---|---|---|
| `person_id` | `bigint` | NO | **PK**, **FK → `persons.id`** ON DELETE CASCADE | |
| `cnes_professional_id` | `bigint` | YES | **UNIQUE** WHERE NOT NULL | **Q7 = B, Q8 = A:** soft-deleted person still reserves CNES id |
| `created_at` | `timestamp` | NO | | |
| `updated_at` | `timestamp` | NO | | |

Absent: primary occupation, free-text specialty, CRM triple.

**Q14 = C:** keep `bigint` for schema now; **mandatory re-verify** against real CNES `CO_PROFISSIONAL_SUS` samples before first import. If non-numeric or leading zeros appear → migrate column to `text`/`varchar` before loading data.

---

### 5.3 `healthcare_specialties` — LOCKED (catalog extras Q15)

| Column | Type | Null | Keys | Notes |
|---|---|---|---|---|
| `id` | `bigint` identity | NO | **PK** | |
| `cnes_id` | `bigint` | NO | **UNIQUE** | **Q9 = A** |
| `name` | `text` | NO | | |
| `is_active` | `boolean` | NO | | default true; **Q15 = A** minimal catalogs |
| `created_at` | `timestamp` | NO | | |
| `updated_at` | `timestamp` | NO | | |

**Q12 = A:** table name `healthcare_specialties`. Empty until seeded.

---

### 5.4 `person_healthcare_profile_specialties` — LOCKED

| Column | Type | Null | Keys | Notes |
|---|---|---|---|---|
| `person_id` | `bigint` | NO | **PK**, **FK → `person_healthcare_profiles.person_id`** CASCADE | |
| `specialty_id` | `bigint` | NO | **PK**, **FK → `healthcare_specialties.id`** | |
| `is_primary` | `boolean` | NO | partial **UNIQUE** `(person_id)` WHERE `is_primary` | **Q10 = A**; default false |
| `created_at` | `timestamp` | NO | | |

---

### 5.5 `person_professional_registration_councils` — LOCKED

Minimal seed: `CRM` (`0058_seed_crm_registration_council`). Full council catalog later (D10). **Q15 = A** minimal catalog pattern.

| Column | Type | Null | Keys | Notes |
|---|---|---|---|---|
| `code` | `text` | NO | **PK** | e.g. CRM, CRO — immutable in app |
| `name` | `text` | NO | | |
| `is_active` | `boolean` | NO | | default true |
| `created_at` | `timestamp` | NO | | |
| `updated_at` | `timestamp` | NO | | |

No `description` / `display_order` (Q15).

---

### 5.6 `person_professional_registration_types` — LOCKED

Same shape as councils (`code`, `name`, `is_active`, timestamps). Empty.

---

### 5.7 `person_professional_registrations` — LOCKED (Q17–Q19)

From `crm_council`, `crm_number`, `crm_state`.

| Column | Type | Null | Keys | Notes |
|---|---|---|---|---|
| `id` | `bigint` identity | NO | **PK** | |
| `person_id` | `bigint` | NO | **FK → `person_healthcare_profiles.person_id`** CASCADE | idx |
| `council_code` | `text` | NO | **FK → councils.code** | |
| `state_code` | `char(2)` | NO | | UF, uppercase |
| `registration_number` | `text` | NO | | **Q17 = A** — not int (formatting/leading zeros) |
| `registration_type_code` | `text` | YES | **FK → types.code** | Empty catalog; nullable until used |
| `is_primary` | `boolean` | NO | **Q18 = A** — partial unique per person WHERE true | default false |
| `is_active` | `boolean` | NO | | default true |
| `created_at` | `timestamp` | NO | | |
| `updated_at` | `timestamp` | NO | | |

**Q19 = A:** `UNIQUE (council_code, state_code, registration_number)` global.  
No `registered_at` / `valid_until` / source columns (not in current schema).

---

### 5.8 `person_facilities` — LOCKED (Q16, Q20–Q22)

Canonical person ↔ facility link.

| Column | Type | Null | Keys | Notes |
|---|---|---|---|---|
| `id` | `bigint` identity | NO | **PK** | |
| `person_id` | `bigint` | NO | **FK → `persons.id`** CASCADE | idx |
| `facility_id` | `bigint` | NO | **FK → `facilities.id`** CASCADE | idx |
| `role_title` | `text` | YES | | from representatives |
| `notes` | `text` | YES | | association notes (both) |
| ~~`specialty_label`~~ | — | — | — | **Q11 = A:** dropped; not on this table |
| ~~`employment_type_code`~~ | — | — | — | **Q20 = B:** dropped; CBO via `person_facility_occupations` |
| `confirmed_at` | `timestamp` | YES | | |
| `confirmed_by_user_id` | `bigint` | YES | **FK → `users.id`** SET NULL | |
| `ended_at` | `timestamp` | YES | | set when ending |
| `ended_by_user_id` | `bigint` | YES | **FK → `users.id`** SET NULL | required when ending (Q22) |
| ~~`end_reason`~~ | — | — | — | **Q22:** omitted |
| `created_at` | `timestamp` | NO | | |
| `updated_at` | `timestamp` | NO | | |

**LOCKED intent (D5):**  
`UNIQUE (facility_id, person_id) WHERE ended_at IS NULL`

**Q21 = A:** no `started_at` / `manually_edited_at` / source_*. Person–facility links are **always manual** — no CNES/import auto-assignment.  
**Q22:** end = `ended_at` + `ended_by_user_id` (both required together); no `end_reason`. Enforce: `(ended_at IS NULL) = (ended_by_user_id IS NULL)` (CHECK or app).

Absent: role booleans, `occupation_code`, `contact_type`.

---

### 5.9 `person_facility_classifications` — LOCKED (id-PK reshape 2026-08-08)

Occupation-shaped catalog (matches `occupations` / `unit_types`):

| Column | Type | Null | Keys | Notes |
|---|---|---|---|---|
| `id` | `bigint` identity | NO | **PK** | |
| `code` | `text` | NO | **UNIQUE** | Stable wire/discriminator key |
| `name` | `text` | NO | | pt-BR label |
| `is_active` | `boolean` | NO | | default true |
| `created_at` / `updated_at` | `timestamp` | NO | | |

Migrations: `0063` drop code-PK → `0064` recreate → `0065` re-seed.

### 5.10 `person_facility_classification_assignments` — LOCKED (id-PK reshape 2026-08-08)

| Column | Type | Null | Keys | Notes |
|---|---|---|---|---|
| `person_facility_id` | `bigint` | NO | **PK**, **FK → `person_facilities.id`** CASCADE | |
| `classification_id` | `bigint` | NO | **PK**, **FK → classifications.id** RESTRICT | |
| `created_at` | `timestamp` | NO | | |

**Q23 = A:** no `created_by_user_id` on assignments.

**D20 seed:**

| code | name (pt-BR label) |
|---|---|
| `HEALTHCARE_PROFESSIONAL` | Profissional de saúde |
| `ADMINISTRATIVE_CONTACT` | Contato administrativo |

---

### 5.11 `person_facility_roles` — LOCKED (dynamic admin catalog 2026-08-08)

Admin-managed toggles — **not** fixed enums. No migration seed. Empty catalog valid until admin creates rows (CRUD UI later).

| Column | Type | Null | Keys | Notes |
|---|---|---|---|---|
| `id` | `bigint` identity | NO | **PK** | Wire / FK identity |
| `name` | `text` | NO | **UNIQUE** via `lower(trim(name))` | Display label (pt-BR) |
| `is_active` | `boolean` | NO | | default true; deactivate hides from toggles |
| `created_at` / `updated_at` | `timestamp` | NO | | |

**No `code` column.** Migrations: `0066` drop code-era roles → `0067` recreate dynamic shape.

### 5.12 `person_facility_role_assignments` — LOCKED (dynamic roles 2026-08-08)

| Column | Type | Null | Keys | Notes |
|---|---|---|---|---|
| `person_facility_id` | `bigint` | NO | **PK**, **FK → `person_facilities.id`** CASCADE | |
| `role_id` | `bigint` | NO | **PK**, **FK → roles.id** RESTRICT | |
| `created_at` | `timestamp` | NO | | |

**Role assignment validation:** `PUT …/roles` accepts any **active** catalog **id**. Catalog: `GET /api/v1/person-facility-roles` → `{ id, name, isActive }[]`. Mobile Papel filter/badges are catalog-driven by id (no hardcoded role identities).

---

### 5.13 `occupations` (remake) — LOCKED (Q24–Q26, M10)

| Column | Type | Null | Keys | Notes |
|---|---|---|---|---|
| `id` | `bigint` identity | NO | **PK** | Our id |
| `cnes_id` | `text` | NO | **UNIQUE** | **Q24 = A** — CBO code; was `occupation_code` |
| `name` | `text` | NO | | was `occupation_name` |
| ~~`professional_classification`~~ | — | — | — | **M10 = B:** dropped (unused CNES metadata) |
| `is_health_occupation` | `boolean` | YES | | **Q25 = A** — was `text` (S/N) |
| `is_regulated` | `boolean` | YES | | **Q25 = A** — was `text` (S/N) |
| ~~`reference_year`~~ | — | — | — | **Q26 = C:** dropped |
| `created_at` / `updated_at` | `timestamp` | NO | | |

Empty until CBO data loaded post-overhaul. Never insert `LEGACY`/`MED`.

---

### 5.14 `person_facility_occupations` — LOCKED (Q27)

| Column | Type | Null | Keys | Notes |
|---|---|---|---|---|
| `id` | `bigint` identity | NO | **PK** | |
| `person_facility_id` | `bigint` | NO | **FK → `person_facilities.id`** CASCADE | |
| `occupation_id` | `bigint` | NO | **FK → `occupations.id`** | |
| `is_primary` | `boolean` | NO | | **Q27 = B** — multiple primaries OK; no partial unique |
| `created_at` / `updated_at` | `timestamp` | NO | | |

**UNIQUE** `(person_facility_id, occupation_id)`.

---

### 5.15 `person_notes` — LOCKED (Q28)

| Column | Type | Null | Keys | Notes |
|---|---|---|---|---|
| `id` | `bigint` identity | NO | **PK** | |
| `user_id` | `bigint` | NO | **FK → `users.id`** CASCADE | |
| `person_id` | `bigint` | NO | **FK → `persons.id`** CASCADE | |
| ~~`facility_id`~~ | — | — | — | **Q28 = A:** omitted; use `facility_notes` for facility |
| `note` | `text` | NO | | |
| `created_at` / `updated_at` | `timestamp` | NO | | |

Privacy: list/filter always `user_id = caller`. Index `(person_id, user_id, created_at)`.  
`facility_notes` unchanged (user × facility) — not part of person redesign.

---

### 5.16 `user_person_relationships` — LOCKED (Q29)

| Column | Type | Null | Keys | Notes |
|---|---|---|---|---|
| `id` | `bigint` identity | NO | **PK** | |
| `user_id` | `bigint` | NO | **FK → `users.id`** CASCADE | |
| `person_id` | `bigint` | NO | **FK → `persons.id`** CASCADE | |
| `relationship_level` | `smallint` | NO | | **Q29 = A** — CHECK `(1–10)` |
| `created_at` / `updated_at` | `timestamp` | NO | | |

**UNIQUE** `(user_id, person_id)`. Private per user.

---

## 6. API / module design (Q30 = C — shape locked, paths provisional)

### 6.1 Module

`apps/api/src/modules/person/` owns all tables in §5 and use-cases.  
Facility routes may mount projections but call person ports only.

### 6.2 Projection surface (D12) — **Q30 = C**

**Locked shape (not exact URL strings):**
- Facility-scoped **healthcare** projection (list/create/detail; filter `HEALTHCARE_PROFESSIONAL`)
- Facility-scoped **administrative** projection (list/create/detail; filter `ADMINISTRATIVE_CONTACT`)
- Global healthcare Explorar (Meili, D16)
- Person identity + profile (`persons` by id)
- User-scoped notes + relationship score on person

**Frozen facility projection paths** (Q30 API PR — 2026-08-07):

| Method | Path | Classification filter |
|---|---|---|
| GET/POST | `/api/v1/facilities/:facilityId/healthcare-professionals` | `HEALTHCARE_PROFESSIONAL`; POST optional `crmNumber`+`crmState` → primary CRM registration |
| GET/PATCH/DELETE | `/api/v1/facilities/:facilityId/healthcare-professionals/:personFacilityId` | DELETE = soft-end (`ended_at` + `ended_by_user_id`); `update` PERSON |
| GET/POST | `/api/v1/facilities/:facilityId/administrative-contacts` | `ADMINISTRATIVE_CONTACT` |
| GET/PATCH/DELETE | `/api/v1/facilities/:facilityId/administrative-contacts/:personFacilityId` | DELETE = soft-end; same auth as healthcare |

**Frozen role-assignment paths** (STEP 4 — 2026-08-07):

| Method | Path | Notes |
|---|---|---|
| PUT | `/api/v1/facilities/:facilityId/healthcare-professionals/:personFacilityId/roles` | Body `{ roleIds: number[] }`; replace-set; any active catalog id |
| PUT | `/api/v1/facilities/:facilityId/administrative-contacts/:personFacilityId/roles` | Body `{ roleIds: number[] }`; replace-set; any active catalog id |
| GET | `/api/v1/person-facility-roles` | Active catalog `{ data: { id, name, isActive }[] }` (`read` PERSON) |

Projection DTOs include `roleIds: number[]` and `classificationIds: number[]` (codes remain internal/route discriminators only).

**Frozen notes / relationship / Explorar / identity paths** (STEP 3 — 2026-08-07):

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/v1/persons/:personId/notes` | User-scoped; caller-owned rows only |
| PATCH/DELETE | `/api/v1/persons/:personId/notes/:noteId` | Caller-owned hard update/delete; `update` PERSON |
| GET | `/api/v1/persons/:personId/relationship` | `{ relationshipLevel: number \| null }` |
| PUT/PATCH | `/api/v1/persons/:personId/relationship` | Body `{ relationshipLevel: 1..10 }`; returns `{ personId, relationshipLevel }` |
| GET/PATCH | `/api/v1/persons/:personId` | Identity + profile; soft-deleted → 404; PATCH partial identity fields; response includes `cpf` + temporary `taxId` alias (**COMPAT(remove)** when mobile DTO field → `cpf`) + `facilityIds` + `hasHealthcareProfile` |
| GET | `/api/v1/healthcare-professionals` | Global/Meili Explorar (D16 / Q31) |
| GET | `/api/v1/healthcare-professionals/specialties` | Distinct active specialty names used by non-deleted persons (`{ data: string[] }`) |

DTOs differ per projection (healthcare includes specialties/registrations/occupations; admin includes roles/role_title). Same underlying ids. Nested registration/occupation routes — define when wiring API. End affiliation + note update/delete frozen above.

### 6.3 CASL

Subject: `PERSON` (D13). Resource scoping via facility/territory as today for professionals.

### 6.4 Meilisearch (D16)

Index uid = `persons`. Document id = `persons.id` (string). Documents only for persons **with** `person_healthcare_profiles` and `deleted_at IS NULL`.

**Q31 frozen field list** (STEP 3 — 2026-08-07; also in `apps/workers/temporal/src/search/rebuild.ts`):

| Field | Source |
|---|---|
| `id` | `persons.id` (string) |
| `name` | `firstName + " " + lastName` |
| `socialName` | `persons.social_name` |
| `cpf` | `persons.cpf` |
| `specialty` / `specialtyNormalized` | primary `healthcare_specialties.name` via `person_healthcare_profile_specialties` |
| `activeFacilityIds` | `person_facilities` where `ended_at IS NULL` (+ active facility) |
| `activeTerritoryIds` | `facility_vertical_profiles.manager_zone_id` for those facilities (active profiles) |
| `crmCouncil` / `crmNumber` / `crmState` | primary `person_professional_registrations` (`council_code`, `registration_number`, `state_code`) |

### 6.5 Classification seed

Only when projection API lands: two rows in §5.9. Nothing else.

---

## 7. Old → new field map

| Old | New |
|---|---|
| `professionals.*` identity fields | `persons.*` (no `full_name`; `birth_date`→`date`; `tax_id`→`cpf char(11)`) |
| `professionals.cnes_professional_id` | `person_healthcare_profiles.cnes_professional_id` |
| `professionals.primary_specialty_label` | **Dropped (Q11)** → specialties M2M only |
| `professionals.primary_occupation_code` | Drop → `person_facility_occupations.is_primary` |
| `professionals.crm_*` | `person_professional_registrations` |
| `facility_professionals` row | `person_facilities` + classification HEALTHCARE + role assignments + occupation row(s) |
| `facility_professionals.occupation_code` LEGACY/MED | **Discard** (not CBO) |
| `facility_professionals.specialty_label` | **Dropped (Q11)** |
| `facility_professionals.employment_type_code` | **Dropped (Q20)** |
| `facility_professionals` booleans | `person_facility_role_assignments` (codes seeded `0054`) |
| `facility_representatives` identity | `persons` (+ create/link); `tax_id` → `cpf` |
| `facility_representatives` link fields | `person_facilities` + classification ADMINISTRATIVE + roles |
| `facility_representatives.contact_type` | Drop |
| `facility_representatives.phone` | `persons.mobile_phone` |
| `facility_representatives.representative_name` | split → `first_name`/`last_name` |
| `professional_notes` | `person_notes` |
| `user_professional_relationships` | `user_person_relationships` |
| `user_representative_relationships` | `user_person_relationships` |
| `occupations.occupation_code` | `occupations.cnes_id` |
| `occupations.occupation_name` | `occupations.name` |

---

## 8. Future identity matching (import) — policy sketch

Not built now. When importing people later:

1. Normalized CPF (`cpf`)  
2. Registration `(council, state, number)`  
3. Verified `cnes_professional_id`  
4. Trusted external source key (if added later)  
5. Weak signals → possible-match warning, no auto-merge  
6. Else create person  

---

## 9. Implementation steps

1. ~~Resolve §10 OPEN questions~~ **done**  
2. Schema hard cut + migrate  
3. `packages/access` → `PERSON`  
4. API `person` module (freeze paths — Q30)  
5. Projection HTTP  
6. Search rebuild (freeze Meili fields — Q31)  
7. Web  
8. Mobile  
9. Retarget current-state docs  
10. Catalog **data** later  

---

## 10. Master questions (all LOCKED)

Historical decision log. No open items.

### Healthcare / specialties / CNES (active now)

| ID | Question | Recommendation |
|---|---|---|
| **Q7** | ~~`cnes_professional_id` width~~ | **LOCKED: `bigint`** |
| **Q8** | ~~Soft-delete vs CNES unique~~ | **LOCKED: A** — reserved while soft-deleted |
| **Q9** | ~~Specialty `cnes_id`~~ | **LOCKED: A** — `bigint NOT NULL` + UNIQUE |
| **Q10** | ~~One primary specialty~~ | **LOCKED: A** — partial unique |
| **Q11** | ~~Drop free-text specialty labels~~ | **LOCKED: A** — catalog only; no `primary_specialty_label` / `specialty_label` |
| **Q12** | ~~Specialty catalog table name~~ | **LOCKED: A** — `healthcare_specialties` |
| **Q14** | ~~CNES id numeric vs text~~ | **LOCKED: C** — `bigint` now; re-verify before import |

### Cross-cutting

| ID | Question | Recommendation |
|---|---|---|
| **Q13** | ~~CPF column / CHECK~~ | **LOCKED: A** — column `cpf` `char(11)` + CHECK 11 digits; not integer |
| **Q15** | ~~Catalog columns~~ | **LOCKED: A** — minimal: code/name (or id), `is_active`, timestamps; no description/display_order |
| **Q23** | ~~created_by on assignments~~ | **LOCKED: A** — no `created_by_user_id` |

### Affiliations / occupations / notes

| ID | Question | Recommendation |
|---|---|---|
| **Q16** | ~~Keep `specialty_label` on affiliation~~ | **LOCKED via Q11 = A** — dropped |
| **Q20** | ~~employment_type_code~~ | **LOCKED: B** — dropped; occupation (CBO) is enough for v1 |
| **Q21** | ~~started_at / source_*~~ | **LOCKED: A** — omit; affiliations always **manual** (no CNES/import assignment) |
| **Q22** | ~~end metadata~~ | **LOCKED** — `ended_at` + `ended_by_user_id` (paired); no `end_reason` |
| **Q17** | ~~registration_number type~~ | **LOCKED: A** — `text` |
| **Q18** | ~~primary registration~~ | **LOCKED: A** — at most one primary per person |
| **Q19** | ~~unique council+state+number~~ | **LOCKED: A** — global unique |
| **Q24** | ~~occupation cnes_id~~ | **LOCKED: A** — `text` UNIQUE |
| **Q25** | ~~health/regulated flags~~ | **LOCKED: A** — both `boolean` nullable |
| **Q26** | ~~reference_year~~ | **LOCKED: C** — drop column |
| **Q27** | ~~primary occupation~~ | **LOCKED: B** — multiple primaries OK; keep `is_primary` |
| **Q28** | ~~person notes vs facility notes~~ | **LOCKED: A** — no `facility_id` on `person_notes`; keep `facility_notes` |
| **Q29** | ~~relationship_level~~ | **LOCKED: A** — `smallint` + CHECK 1–10 |
| **Q30** | ~~API paths~~ | **LOCKED: C** — shape locked; exact paths freeze in API PR |
| **Q31** | ~~Meili document fields~~ | **LOCKED: B** — finalize at search implementation |

---

## 11. Consequences

- One human id across facilities, notes, orders, search.  
- UI dual sections via classifications + separate projection APIs.  
- Roles/classifications evolve without boolean migrations.  
- Occupation ≠ specialty ≠ role ≠ classification.  
- Schema implementation unblocked. Exact API paths (Q30) and Meili fields (Q31) freeze in later PRs.
