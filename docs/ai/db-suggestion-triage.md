# DB suggestion triage — decisions log

Living log for the external “9/10 DB” suggestion list + related hygiene decided in chat.
**Update this file on every locked answer before continuing.** Do not rely on chat memory.

**See also (execution merge with person ADR):** [`docs/ai/db-overhaul-merged-p0.md`](db-overhaul-merged-p0.md) — clash resolutions + P0 slice order. This triage file stays the placement log for #1–#40.

Source chat: agent transcript `a2cfb2fd-d35b-4a0b-b0f5-eae9469226c1` (suggestion triage from ~#1 onward).

---

## Locked process constraints

| Constraint | Detail |
|---|---|
| Empty DB blast | Always assume **no CRM data** when estimating blast. Blast = schema/app surface only, not cleanup/backfill. (User: 2026-08-06) |
| Display names | Prefer **JOIN** mun/state (and similar) for display — do **not** maintain denormalized text. |
| Ingest `source_*` | Strip leftover **ingest/provenance** `source_*` columns. **Keep** non-ingest uses: `purchase_interval_source`, `brasindice_*`, permission/audit `resource_id` / CASL `resource`. |
| Placement tags | `DONE` · `P0` (overhaul / integrity wave) · `P1` (before launch / after P0) · `Later phase` (backlog, not dropped) · `SKIP` · `pending` (not decided) |
| Metrics scale | Blast / Effort = **S / M / L / XL** (from point-by-point analysis; re-rated under empty-DB where noted) |
| Protocol | One suggestion at a time → user places → **write here** → next # |

---

## Executive status (locked only)

| # | Topic | Placement | Blast | Effort |
|---|---|---|---|---|
| 1 | Dup facility vs profile commercial | **DONE** | S | S |
| 2 | Composite cross-vertical FKs | **P0** | M* | L |
| 3 | Missing FKs | **P0** | S–M* | M |
| 4 | Facility identity | **P0** (revised) | S* | S–M |
| 5 | Canonical facility–vertical model | **DONE** | S | S |
| 6 | GiST location/boundary | **P0** | S | S |
| 7 | Cached geom bbox/area | **DONE** (DROPPED) | S | S |
| 8 | Territory hierarchy | **Split** (see below) | — | — |
| 9 | Overlap enforce harden (`block_sibling_overlap`) | **Later phase** | S | S–M |
| 10 | UTA history periods | **Later phase** | M | M |
| 11 | Bad column types (full scan pack) | **P0** | M | M |
| 12 | Timestamps | **Split:** date **P0** / timestamptz **P1** | — | — |
| 13 | `updated_at` auto-bump | **P0** | S | S |
| 14 | Case-insensitive identities | **P0** | S* | S–M |
| 15 | Order-state consistency CHECKs | **Later phase** | S* | M |
| 16 | Numeric order constraints | **SKIP** | S | S |
| 17 | `order_item` + Emultec ids | **P0** (revised — see detail) | S | S–M |
| 18 | Invitation status validation | **P1** | S | S |
| 19 | Session lifecycle validation | **P1** | S | S |
| 20 | Relationship lifecycle dates | **P0** | S | S |
| 21 | File/upload number CHECKs | **SKIP** | S | S |
| 22 | Normalize product pricing | **Later phase** | XL | XL |
| 23 | Preserve historical prices | **Later phase** | XL | L |
| 24 | Competitor same price model | **Later phase** | L | L |
| 25 | Consolidate file-storage models | **SKIP** | M | M |
| 26 | No permanent signed URLs | **SKIP** | S | S |
| 27 | File-ID arrays → relational | **SKIP** | S | S |
| 28 | Centralize vertical access control | **P1** | M | M |
| 29 | PostgreSQL RLS | **Later phase** | XL | XL |
| 30 | Permission unique + NULLS | **P0** | S | S |
| 31 | Permission action/resource registry | **Later phase** | S | M |
| 32 | 2FA secret protection (KMS upgrade) | **Later phase** | S | — |
| 33 | General audit trail | **Later phase** | M | L |
| 34 | Sensitive-entity audit | **Later phase** | M | M |
| 35 | Source vs CRM truth | **SKIP** | S | — |
| 36 | Drop exact duplicate indexes | **P0** | S | S |
| 37 | Left-prefix index review | **Later phase** | S | S |
| 38 | Low-cardinality indexes | **Later phase** | S | S |
| 39 | `pg_trgm` name search | **SKIP** | S | S |
| 40 | Measure indexes after traffic | **Later phase** | — | S |

\*Empty-DB re-rate (was higher when dirty-data cleanup assumed).

---

## Locked decisions (detail)

Each item: **Situation now** (as of triage close) · **Problem** · placement / scope already decided.

### #1 — Remove duplicated vertical-specific facility fields

| | |
|---|---|
| **Situation now** | Commercial / purchase / funnel live only on `facility_vertical_profiles`. `facilities` no longer stores those rollup cols. API `serializeFacility` emits them only on `verticalProfiles[]` (top-level projection killed). Mobile/web read from profiles. |
| **Problem** | Was: same commercial facts duplicated on facility + profile → wrong SoT when Linhas differ; clients trusted a single facility-level status. **Resolved** for DB+DTO. |
| **Placement** | **DONE** |
| **Blast / Effort** | S / S |

### #2 — Composite FKs for cross-vertical consistency

| | |
|---|---|
| **Situation now** | Territories PK = `id` only. Uniques = `(vertical_id, slug)` / `(vertical_id, code)`. Profile `manager_zone_id` → `territories.id` is a **single-column** FK. Orders / consultant assignments / UTAs similarly tie to ids without proving same `vertical_id`. |
| **Problem** | App can point a Dermatologia profile at an Ortopedia zone (or order at wrong vertical’s territory). Silent cross-Linha corruption — DB never rejects it. Multi-vertical product needs composite uniqueness + composite FKs. |
| **Placement** | **P0** |
| **Scope** | Unique `(id, vertical_id)` on territories; composite FKs from profiles / consultants / orders / UTAs as needed. |
| **Blast / Effort** | M* / L (empty DB) |
| **Note** | #8 same-vertical parent lands **with** this. |

### #3 — Add missing foreign keys

| | |
|---|---|
| **Situation now** | Many “looks like FK” cols are bare integers/bigints. Notable: `territories.manager_territory_id` has index + Drizzle relation but **no** SQL `.references()`. Similar gaps on approval/invite/session/catalog refs. Services FKs N/A — replaced by clinical focuses. |
| **Problem** | Orphan ids and invalid parent links can exist; integrity depends entirely on app discipline. Empty DB makes adding FKs cheap now. |
| **Placement** | **P0** (bundle with/after #2) |
| **Scope** | `manager_territory_id`, approval `facility_id` / `superseded_by`, invite/session refs, occupation→`occupations`, type/deactivation catalogs (with seed). #8 FK + no-self CHECK here. |
| **Blast / Effort** | S–M / M |

### #4 — Facility identity reliable

| | |
|---|---|
| **Situation now** | Have `legal_document` + `legal_document_type` (CNPJ/CPF), mod11 in app, active `cnes_code` unique, `state_id`/`municipality_id` NOT NULL FKs. Non-unique partial index on active `(legal_document_type, legal_document)` — **shared CNPJ/CPF across facilities is intentional** (branches). Still have writable `facilities.city` / `facilities.state` **text** beside FKs. |
| **Problem** | Dual SoT for place names (text vs IBGE FKs) invites drift. Mun/state mismatch possible. Display should JOIN `municipalities`/`states`, not denorm text. |
| **Placement** | **P0** (geo integrity only; tax-doc uniqueness closed) |
| **Still to do** | mun∈state; JOIN display; **DROP** city/state text. |
| **Rejected** | Unique active legal doc (product 2026-08-08 — duplicates allowed); denorm sync P1; `source_*` rename for geo text. |
| **Blast / Effort** | S / S–M |

### #5 — Canonical facility–vertical model

| | |
|---|---|
| **Situation now** | Per-Linha profile owns `manager_zone_id` + commercial/funnel. REP ownership = `facility_vertical_rep_assignments` under the profile (ADR 0005). Facility-level territory status/source already dropped. |
| **Problem** | Was unclear whether consultant “owns” geometry vs routing. Model is settled: geo membership on profile; consultant overrides routing, not polygons. **No further schema needed.** |
| **Placement** | **DONE** (optional ADR note only) |
| **Blast / Effort** | S / S |

### #6 — PostGIS GiST indexes

| | |
|---|---|
| **Situation now** | `facilities.location` and `territories.boundary` exist as PostGIS geometry. **No** GiST (or other spatial) indexes in schema. Admin geography tables already have GiST. |
| **Problem** | Nearby/radius, containment, overlap queries degrade to seq scans as data grows. Additive indexes; empty DB = free. |
| **Placement** | **P0** |
| **Scope** | Partial GiST WHERE NOT NULL on location + boundary. |
| **Blast / Effort** | S / S |

### #7 — Protect cached geometric values (bbox/area)

| | |
|---|---|
| **Situation now** | Bbox/area cache cols **removed** from territories + states/municipalities/neighborhoods (`0090`/`0091`). `updateBoundaryMetadata` gone. Only live `boundary` remains. |
| **Problem** | Was: denorm bbox/area could drift from `boundary`; unused by readers anyway. Protecting unused cache was wrong fix — **drop** was right. |
| **Placement** | **DONE** (DROP, not protect) |
| **Rule** | Derive bbox/area from `boundary` via PostGIS when needed. |
| **Blast / Effort** | S / S |

### #8 — Enforce territory hierarchy rules

| | |
|---|---|
| **Situation now** | Hierarchy = manager zone → patches via `manager_territory_id`. App containment/resolution sets parent. No DB FK, no self-ref CHECK, no same-vertical guarantee, no cycle/type-pair constraints. Tree is effectively 2-level today. |
| **Problem** | Bad parent ids, self-links, or cross-vertical parents can be written. Type-pair mistakes (patch under patch) possible if app bugs. Deep cycles not a real model today. |
| **Placement** | **Split:** FK + no-self **P0 w/ #3**; same-vertical **P0 w/ #2**; cycles + type pairs **Later phase** |
| **Blast / Effort** | — |

### #9 — Enforce territory-overlap policies

| | |
|---|---|
| **Situation now** | `territory_types.block_sibling_overlap` exists. API spatial path enforces non-overlap when flag set (zones). Patches may overlap (Spec 0006). No advisory locks / DB `EXCLUDE`. |
| **Problem** | Concurrent boundary edits could race past app checks. Flag-without-enforce was the old bug (fixed in app). Remaining risk = concurrency harden, not greenfield enforce. |
| **Placement** | **Later phase** |
| **Scope** | Harden races; no DB EXCLUDE now. |
| **Blast / Effort** | S / S–M |

### #10 — Historical periods on `user_territory_assignments`

| | |
|---|---|
| **Situation now** | UTA = current user↔territory link (create/delete). No `started_at`/`ended_at`/`end_reason` history. Contrast: `facility_vertical_rep_assignments` **does** soft-end history and app uses it. |
| **Problem** | Cannot answer “who owned this patch last year” from UTA. Fine for access-scope-now; weak for historical reporting/audit. Consultant history exists because clinic ownership continuity matters more. |
| **Placement** | **Later phase** |
| **Blast / Effort** | M / M |

### #11 — Fix inappropriate data types

| | |
|---|---|
| **Situation now** | Known mismatches still in schema: `share_percent` text; occupation flags text + `reference_year` text; `json` (not jsonb) on users/permissions/territory payloads/audit; IPs as text; birth dates as `timestamp`; `flagged_file_asset_ids` as `text[]`; currency/storage_provider free text. |
| **Problem** | Wrong types block CHECKs/indexes, force string parsing, allow invalid values, weaken queryability. Full pack A–I locked P0. |
| **Placement** | **P0** (all A–I) |
| **Blast / Effort** | M / M |

#### #11 scan pack (all P0)

| ID | Column(s) | Now → Suggest | Situation / problem |
|---|---|---|---|
| A | `share_percent` | `text` → `numeric(5,2)` | Stored as strings like `"20"`; API already number — type lie |
| B | metadata/conditions/payload/audit | `json` → `jsonb` | Can’t index/query JSON efficiently; jsonb is PG norm |
| C | occupation health/regulated flags | `text` → `boolean` | Boolean-named cols hold CNES S/N text |
| D | `reference_year` | `text` → `smallint` | Year as free text |
| E | `orders.currency` | `text` → `char(3)`/enum | Always BRL in practice; open text |
| F | `storage_provider` | `text` → enum | Default s3; open text |
| G | session/reset/audit IPs | `text` → `inet` | No IP validation at DB |
| H | birth dates | `timestamp` → `date` | Calendar-only stored as time |
| I | `flagged_file_asset_ids` | `text[]` → `bigint[]` | IDs stored as text array; join table skipped (#27) |

### #12 — Standardize timestamps

| | |
|---|---|
| **Situation now** | Almost all event cols are Drizzle `timestamp` → PG `timestamp without time zone`. Birth dates also `timestamp`. New tables follow same habit. |
| **Problem** | TZ ambiguity for events; calendar dates shouldn’t carry time. Full `timestamptz` sweep is noisy/XL; birth→`date` is the cheap correctness fix. |
| **Placement** | **Split:** date **P0** (w/ #11 H); timestamptz sweep **P1** |
| **Blast / Effort** | — |

### #13 — `updated_at` actually updates

| | |
|---|---|
| **Situation now** | Widespread `updated_at … defaultNow()` on insert. No PG triggers, no Drizzle `$onUpdate`. Some repos set `updatedAt: new Date()`, many paths miss. |
| **Problem** | Column claims “last change time” but often stays at insert time → lying audit signal, bad cache/invalidation, misleading ops. |
| **Placement** | **P0** |
| **Scope** | One strategy: trigger or `$onUpdate` on CRM tables. |
| **Blast / Effort** | S / S |

### #14 — Case-insensitive identities

| | |
|---|---|
| **Situation now** | `users.email` unique on raw string (plus redundant btree). No `lower(email)` / citext. Phone storage not standardized to E.164 at DB. |
| **Problem** | `a@x.com` and `A@x.com` can both exist → duplicate accounts / broken login. Same class of bug for invites if unique on email. |
| **Placement** | **P0** |
| **Scope** | `UNIQUE (lower(email))` or citext; phone normalize in app (+ optional CHECK). |
| **Blast / Effort** | S / S–M |

### #15 — Order-state consistency checks

| | |
|---|---|
| **Situation now** | Orders have status enum + many lifecycle cols (`finalized_*`, `rejected_*`, `no_billing_*`, …). Integrity mostly app-side; few/no DB CHECKs tying status to meta. |
| **Problem** | Contradictory rows possible (rejected without reason, finalized_at without finalized status, etc.) if a bug or script writes bad state. |
| **Placement** | **Later phase** |
| **Blast / Effort** | S / M |

### #16 — Numeric order constraints

| | |
|---|---|
| **Situation now** | Freight/weights/qty/prices are `numeric` with defaults; no CHECK ≥ 0 or net≤gross. |
| **Problem** | Negative quantities/prices theoretically storable. User chose not to invest in DB CHECKs here — app validation remains SoT. |
| **Placement** | **SKIP** |
| **Blast / Effort** | S / S |

### #17 — `order_item` integrity + Emultec ids (revised)

| | |
|---|---|
| **Situation now** | `order_items.line_number` exists (set as 1..n on create; used only for sort). Vague `legacy_id` / `legacy_product_id` on orders/items/products; competitor `legacy_id` too. Display uses `PED-{legacyId}`. |
| **Problem** | `line_number` adds no domain value. `legacy_*` hides which Emultec entity the id is. Competitor legacy id unwanted. Need specific Emultec names (see inventory). |
| **Placement** | **P0** |
| **Scope** | DROP `line_number`; rename L1–L4; DROP L5 competitor `legacy_id`. |
| **Blast / Effort** | S / S–M |

### #18 — Validate invitations by status

| | |
|---|---|
| **Situation now** | Invitations have status + email/phone + accept/revoke fields. Rules mostly in app; DB does not force “accepted ⇒ accepted_at + user” etc. |
| **Problem** | Terminal states can disagree with metadata → stuck/ambiguous invites, security confusion on accept. |
| **Placement** | **P1** |
| **Blast / Effort** | S / S |

### #19 — Validate session lifecycle

| | |
|---|---|
| **Situation now** | Sessions have `revoked_at`, `revoked_reason`, `revoked_by_user_id`, expiry, refresh fields. `revoked_by_user_id` may lack FK. Consistency app-driven. |
| **Problem** | Partial revoke metadata / replaced-session inconsistencies can leave “zombie” or ambiguous sessions if writers skip fields. |
| **Placement** | **P1** |
| **Blast / Effort** | S / S |

### #20 — Validate relationship lifecycle dates

| | |
|---|---|
| **Situation now** | Soft-end tables (consultants, pros, reps, …) have `started_at`/`ended_at`/`end_reason`. App sets them; DB generally does not CHECK `ended_at >= started_at`. |
| **Problem** | Impossible intervals (end before start) can be stored by bug/script. Cheap CHECK closes that class. |
| **Placement** | **P0** |
| **Blast / Effort** | S / S |

### #21 — Validate file and upload numbers

| | |
|---|---|
| **Situation now** | Cadastro/file upload stack has sizes, part numbers, bytes expected. CHECKs for ≥0 / >0 not systematically applied. |
| **Problem** | Negative sizes / zero parts possible at DB. User deferred entire upload design review to another day. |
| **Placement** | **SKIP** (file-upload review day) |
| **Blast / Effort** | S / S |

### #22 — Normalize product pricing

| | |
|---|---|
| **Situation now** | `products` (and competitor products) carry wide cols `price`, `price_17`, `price_18`, `price_20`. No price history table. |
| **Problem** | Tax/rate matrix doesn’t scale; overwrites lose history; Brasíndice/source evolution painful. Needs normalized price rows — XL product+API change. |
| **Placement** | **Later phase** (bundle #23–#24) |
| **Blast / Effort** | XL / XL |

### #23 — Preserve historical prices

| | |
|---|---|
| **Situation now** | Prices overwritten in place on product row. Order lines store `unit_price` snapshot at line level, but catalog history is gone. |
| **Problem** | Can’t answer “what was list price on date X / from source Y” for catalog. Bundle with #22. |
| **Placement** | **Later phase** |
| **Blast / Effort** | XL / L |

### #24 — Same price model for competitor products

| | |
|---|---|
| **Situation now** | Competitor products mirror hard-coded `price_17/18/20` style cols, separate from a shared history model. |
| **Problem** | Two pricing shapes to maintain; competitor vs own catalog diverge. Same wave as #22–#23. |
| **Placement** | **Later phase** |
| **Blast / Effort** | L / L |

### #25 — Consolidate duplicate file-storage models

| | |
|---|---|
| **Situation now** | Cadastro largely on `file_assets`. Other surfaces (photos/conformity/etc.) may still store URL/key/mime on their own tables. |
| **Problem** | Multiple storage SoTs → harder cleanup, signed-URL bugs, inconsistent metadata. Deferred to file-upload review day. |
| **Placement** | **SKIP** |
| **Blast / Effort** | M / M |

### #26 — Avoid storing temporary signed URLs permanently

| | |
|---|---|
| **Situation now** | Canonical `file_assets` prefers bucket/key/provider. Risk remains if any table still persists signed URLs. |
| **Problem** | Stored signed URLs expire / leak capability. Generate on read. Deferred with upload review. |
| **Placement** | **SKIP** |
| **Blast / Effort** | S / S |

### #27 — Replace file-ID arrays with relational tables

| | |
|---|---|
| **Situation now** | `review_decisions.flagged_file_asset_ids` is `text[]`. No join table. #11 I will move to `bigint[]` (P0) without join. |
| **Problem** | `text[]` of ids = no FK integrity, awkward queries. Full join table skipped; typed array is interim fix. |
| **Placement** | **SKIP** (join); #11 I still P0 |
| **Blast / Effort** | S / S |

### #28 — Centralize vertical access control

| | |
|---|---|
| **Situation now** | CASL + `requirePermission` + `getScope()` + vertical header/assignments. Each module must remember to filter. Not one DB gate. |
| **Problem** | Missed vertical filter on one endpoint = cross-Linha data leak. Needs shared helpers + tests, continuous hardening — not a single migrate. |
| **Placement** | **P1** |
| **Blast / Effort** | M / M |

### #29 — PostgreSQL RLS

| | |
|---|---|
| **Situation now** | No RLS policies on CRM tables. App is the authorization boundary. |
| **Problem** | Suggestion: defense-in-depth for vertical scope. Cost: every connection/migration/test must set role context. Overkill until multi-tenant shared DB or untrusted SQL. |
| **Placement** | **Later phase** |
| **Blast / Effort** | XL / XL |

### #30 — Fix nullable permission uniqueness

| | |
|---|---|
| **Situation now** | Unique `(user_id, resource, resource_id, action)`. `resource_id` nullable text. PG treats NULLs as distinct → multiple “global” grants allowed. |
| **Problem** | Duplicate type-level permissions → confusing CASL merges, hard-to-debug access. Tiny fix: `NULLS NOT DISTINCT` or partial uniques. |
| **Placement** | **P0** |
| **Blast / Effort** | S / S |

### #31 — Control permission resource/action values

| | |
|---|---|
| **Situation now** | `permissions.resource` / `action` are free-form text. CASL subjects live in code. |
| **Problem** | Typos create grants that never match real checks (or silent dead grants). Enums/registry would typo-proof — couples to CASL list. |
| **Placement** | **Later phase** |
| **Blast / Effort** | S / M |

### #32 — Protect 2FA secrets properly

| | |
|---|---|
| **Situation now** | TOTP secrets encrypted with AES-GCM in app (not plaintext, not hashed). |
| **Problem** | Suggestion’s remaining gap = enterprise KMS / key separation for compliance. Current encryption is acceptable; KMS is upgrade path. |
| **Placement** | **Later phase** (KMS); keep AES-GCM |
| **Blast / Effort** | S / — |

### #33 — Add a general audit trail

| | |
|---|---|
| **Situation now** | `created_at`/`updated_at` everywhere; `audit` schema + `field_suggestions` for some flows. Not full field-level CDC who/old/new. |
| **Problem** | Hard to answer “who changed this facility field and from what.” Full CDC expensive; scoped audit later. |
| **Placement** | **Later phase** |
| **Blast / Effort** | M / L |

### #34 — Audit especially sensitive domain changes

| | |
|---|---|
| **Situation now** | Same as #33 — no prioritized entity audit pipeline beyond existing audit/suggestions. |
| **Problem** | High-impact entities (facilities, territories, perms, prices, orders, person links) need who/when trail before broad CDC. Bundle with #33. |
| **Placement** | **Later phase** |
| **Blast / Effort** | M / M |

### #35 — Source vs CRM truth / provenance

| | |
|---|---|
| **Situation now** | Ingest provenance mostly stripped; registry schema dropped; `field_suggestions` for proposed vs current. CRM is SoT. |
| **Problem** | Original worry = feed values mixed with approved CRM. Direction already correct; no rebuild of registry for provenance. |
| **Placement** | **SKIP** |
| **Blast / Effort** | S / — |

### #36 — Drop exact duplicate indexes

| | |
|---|---|
| **Situation now** | Example class: `users.email` has UNIQUE plus separate btree `users_email_idx` — unique already covers lookups. Similar patterns may exist elsewhere. |
| **Problem** | Redundant indexes waste write I/O and storage without helping reads. Easy audit+drop. |
| **Placement** | **P0** |
| **Blast / Effort** | S / S |

### #37 — Left-prefix index review

| | |
|---|---|
| **Situation now** | Many composite btree indexes. No systematic left-prefix / unused leading-col review against `pg_stat_user_indexes`. |
| **Problem** | Overlapping composites or useless leading columns add write cost. Blind drops can hurt hot queries — needs stats. |
| **Placement** | **Later phase** |
| **Blast / Effort** | S / S |

### #38 — Low-cardinality indexes

| | |
|---|---|
| **Situation now** | Indexes exist on booleans / small enums in places. Usage not measured in prod-like traffic. |
| **Problem** | Low-selectivity indexes often unused yet still maintained on write. Drop only after stats prove waste. |
| **Placement** | **Later phase** (w/ #37) |
| **Blast / Effort** | S / S |

### #39 — `pg_trgm` for name search

| | |
|---|---|
| **Situation now** | Facility search goes through Meilisearch. No `pg_trgm` indexes for CRM name ILIKE. |
| **Problem** | Trigram helps PG fuzzy search — redundant while Meili owns search. Only revisit if PG name path becomes hot. |
| **Placement** | **SKIP** |
| **Blast / Effort** | S / S |

### #40 — Measure indexes after traffic

| | |
|---|---|
| **Situation now** | Index set is schema-designed / migrated, not yet tuned from production `pg_stat` / slow-query evidence. |
| **Problem** | Inventing more indexes from vibes causes bloat. Need a post-traffic ritual to measure before adding/dropping (beyond obvious dups in #36). |
| **Placement** | **Later phase** (process) |
| **Blast / Effort** | — / S |

---

## Triage complete — execution rolls

### P0 (do in overhaul wave)

| # | Work |
|---|---|
| 2 | Composite cross-vertical FKs |
| 3 | Missing FKs (+ #8 FK/self-CHECK) |
| 4 | Facility identity (unique legal doc, mun∈state, JOIN display, DROP city/state text) |
| 6 | GiST on `facilities.location` + `territories.boundary` |
| 8 | Hierarchy: same-vertical w/ #2; FK+no-self w/ #3 |
| 11 | Type pack A–I |
| 12 | Calendar → `date` (w/ #11 H) |
| 13 | `updated_at` auto-bump |
| 14 | Case-insensitive email/phone |
| 17 | DROP `line_number`; Emultec renames L1–L4; DROP competitor `legacy_id` |
| 20 | `ended_at >= started_at` CHECKs |
| 30 | Permission unique NULLS |
| 36 | Drop exact duplicate indexes |

### P1

| # | Work |
|---|---|
| 12 | `timestamptz` sweep |
| 18 | Invitation status validation |
| 19 | Session lifecycle validation |
| 28 | Harden vertical access helpers |

### Later phase

| # | Work |
|---|---|
| 8 | Cycles + allowed type pairs |
| 9 | Overlap race harden |
| 10 | UTA history |
| 15 | Order-state CHECKs |
| 22–24 | Pricing normalize + history + competitor |
| 29 | RLS |
| 31 | Perm action/resource registry |
| 32 | 2FA KMS |
| 33–34 | Audit trail |
| 37–38 | Index gardening (stats) |
| 40 | Measure indexes after traffic |

### SKIP / DONE (no work or already shipped)

| # | Note |
|---|---|
| 1, 5, 7 | DONE |
| 16 | SKIP numeric order CHECKs |
| 21, 25–27 | SKIP — file-upload review day |
| 35 | SKIP — direction OK |
| 39 | SKIP — Meili |

---

## Legacy ID inventory (rename pass — **LOCKED**)

Vague `legacy_*` → specific Emultec names. Same P0 wave as #17 (`line_number` drop). Wire: DB `snake_case` → TS camelCase → API/mobile DTO keys (break `legacyId` wire).

| # | Table | Column now | **New column** | TS (suggested) | Action |
|---|---|---|---|---|---|
| L1 | `orders` | `legacy_id` | `id_avulsa_emultec` | `idAvulsaEmultec` | RENAME + keep unique |
| L2 | `order_items` | `legacy_id` | `id_avulsa_item_emultec` | `idAvulsaItemEmultec` | RENAME + keep unique |
| L3 | `order_items` | `legacy_product_id` | `id_produto_emultec` | `idProdutoEmultec` | RENAME (denorm Emultec product id on line) |
| L4 | `products` | `legacy_id` | `id_produto_emultec` | `idProdutoEmultec` | RENAME + keep unique |
| L5 | `competitor_products` | `legacy_id` | — | — | **DROP** |

Also (#17): **DROP** `order_items.line_number`.

Mobile display today `PED-{legacyId}` → `PED-{idAvulsaEmultec}` (or keep display helper, new field).

---

## Side decisions (not numbered in original list)

| Topic | Placement | Detail |
|---|---|---|
| Remaining ingest `source_*` on shares + competitor standards | **DONE** | User: “remove everything related to source_*” (ingest sense) → “yes. Lets do that”. Migrations `0088`/`0089`. Dropped share `source` + enum; competitor `source` / `source_first_seen_at` / `source_last_seen_at`. Kept interval/Brasíndice/permission naming. |
| Clinical focuses rewrite | **DONE** | Replaced CNES services model; `0086`/`0087`; API `clinicalFocuses` / `clinicalFocusIds`; mobile filters. |
| Documentation | **DONE** | This file created after user called out missing persistence; must stay current. |

---

## Related work already done (branch / session context)

- Clinical focuses: `0086` / `0087`
- Drop remaining ingest `source_*`: `0088` / `0089`
- Drop boundary bbox/area caches: `0090` / `0091`
- Top-level commercial DTO projection killed (#1)
- Assoc ingest meta strip / registry schema drop (earlier)
- TOTP AES-GCM in place; #32 later = KMS upgrade only
- Overlap enforcement in app (#9 base — harden later)

Also see plan: `.cursor/plans/db_column_review_01ef32ea.plan.md`  
(`backlog-professional-types-occupations`, cadastro dual-path, manual-edit guard, retire legacy CNES worker, …).

---

## Outside-list track (not placed in this triage)

| Item | Initial rec (not locked here) | Blast | Effort |
|---|---|---|---|
| Person / professional / representative redesign | Must — separate major | XL | XL |
| `backlog-cadastro-dual-path` | Product decide | M | L |
| `backlog-manual-edit-guard` | Defer until ingest returns | S | M |
| `backlog-retire-legacy-cnes-worker` | Ops post-deploy | S | S |

---

## Suggestion placements (#13–#40) — locked

| # | Topic | Initial rec (historical) | Blast | Effort | Placement |
|---|---|---|---|---|---|
| **13** | `updated_at` actually updates | — | S | S | **LOCKED → P0** (see detail above) |
| **14** | Case-insensitive email / phone norm | — | S | S–M | **LOCKED → P0** |
| **15** | Order-state consistency CHECKs | — | S | M | **LOCKED → Later phase** |
| **16** | Numeric order constraints | — | S | S | **LOCKED → SKIP** |
| **17** | `order_item` + Emultec ids | — | S | S–M | **LOCKED → P0:** DROP `line_number`; L1–L4 rename; L5 DROP |
| **18** | Invitation status validation | — | S | S | **LOCKED → P1** |
| **19** | Session lifecycle validation | — | S | S | **LOCKED → P1** |
| **20** | Relationship lifecycle dates (`ended_at >= started_at`) | — | S | S | **LOCKED → P0** |
| **21** | File/upload number CHECKs | — | S | S | **LOCKED → SKIP** (file-upload review another day) |
| **22** | Normalize product pricing (kill `price_17/18/20`) | — | XL | XL | **LOCKED → Later phase** |
| **23** | Preserve historical prices | — | XL | L | **LOCKED → Later phase** (w/ #22) |
| **24** | Competitor same price model | — | L | L | **LOCKED → Later phase** (w/ #22–#23) |
| **25** | Consolidate file-storage → `file_asset` | — | M | M | **LOCKED → SKIP** (file-upload day) |
| **26** | No permanent signed URLs | — | S | S | **LOCKED → SKIP** (file-upload day) |
| **27** | File-ID arrays → relational | — | S | S | **LOCKED → SKIP**; #11 I `bigint[]` still P0 |
| **28** | Centralize vertical access control | — | M | M | **LOCKED → P1** |
| **29** | PostgreSQL RLS | — | XL | XL | **LOCKED → Later phase** |
| **30** | Permission unique + NULLS NOT DISTINCT | — | S | S | **LOCKED → P0** |
| **31** | Enum/registry for perm action/resource | — | S | M | **LOCKED → Later phase** |
| **32** | 2FA secret encryption | — | S | — | **LOCKED → Later phase** (KMS); AES-GCM stays now |
| **33** | General audit trail | — | M | L | **LOCKED → Later phase** |
| **34** | Sensitive-entity audit | — | M | M | **LOCKED → Later phase** (w/ #33) |
| **35** | Source vs CRM truth | — | S | — | **LOCKED → SKIP** |
| **36** | Drop exact duplicate indexes | — | S | S | **LOCKED → P0** |
| **37** | Left-prefix index review | — | S | S | **LOCKED → Later phase** |
| **38** | Low-cardinality indexes | — | S | S | **LOCKED → Later phase** (w/ #37) |
| **39** | `pg_trgm` | — | S | S | **LOCKED → SKIP** |
| **40** | Measure indexes after traffic | — | — | S | **LOCKED → Later phase** |

---

## Chronological decision log

| When (approx) | Decision |
|---|---|
| Start | Point-by-point triage; file after placements |
| #1 | User wants DTO kill **now** → implemented → **DONE** |
| Constraint | **Always empty DB** for blast |
| #2 | User “your rec” → **P0** (blast re-rated M) |
| #3 | “ok i like that” → **P0** bundle w/ #2; catalog FKs w/ seed |
| #4 first | Rec split P0 uniqueness + P1 denorm sync |
| #4 revise | User: join mun/state, don’t keep denorm → **P0 DROP city/state text** |
| `source_*` | User: remove ingest `source_*` → implemented **DONE** (`0088`/`0089`) |
| #4 lock | **P0** revised (join + drop text) |
| #5 | **DONE** (ADR optional) |
| #6 | **P0** GiST |
| #7 | Unused → **DROP** (territories + admin geo) → **DONE** (`0090`/`0091`) |
| #8 | Split: FK/self w/ #3, same-vertical w/ #2, cycles/types **later phase** |
| #9 | **Later phase** |
| #10 | **Later phase** (+ consultant history explanation recorded) |
| #11 | Scan cheap wins → user “Do all now” then **Place all on P0** (full A–I; overrides thinner rec) |
| #12 | date **P0**, timestamptz **P1** |
| Meta | User: persist decisions → this file; keep updating |
| #13 | **P0** (user override of P1 rec) |
| #14 | **P0** |
| #15 | **Later phase** |
| #16 | **SKIP** |
| #17 | **P0:** DROP `line_number`; L1 `id_avulsa_emultec`; L2 `id_avulsa_item_emultec`; L3/L4 `id_produto_emultec`; L5 DROP competitor `legacy_id` |
| #18 | **P1** |
| #19 | **P1** |
| #20 | **P0** |
| #21 | **SKIP** — full file-upload review another day |
| #22 | **Later phase** (bundle w/ #23–#24 when pricing starts) |
| #23 | **Later phase** (w/ #22) |
| #24 | **Later phase** (w/ #22–#23) |
| #25 | **SKIP** (file-upload day w/ #21) |
| #26 | **SKIP** (file-upload day) |
| #27 | **SKIP** (join table; #11 I bigint[] remains P0) |
| #28 | **P1** |
| #29 | **Later phase** |
| #30 | **P0** |
| #31 | **Later phase** |
| #32 | **Later phase** (KMS; AES-GCM already) |
| #33 | **Later phase** |
| #34 | **Later phase** (w/ #33) |
| #35 | **SKIP** |
| #36 | **P0** |
| #37 | **Later phase** |
| #38 | **Later phase** (w/ #37) |
| #39 | **SKIP** |
| #40 | **Later phase** |
| — | **Triage #1–#40 COMPLETE** |

---

## Scope note (honesty)

This file is the **suggestion-list triage** log (#1–#40 + side decisions from that thread).

It is **not** a full dump of the earlier multi-hour DB column review (facilities section-by-section, clinical focuses rewrite product model, specialty≠CBO, Meili vertical scope, legal_document rename, UTA slug-only flags, funnel rollup drop, etc.). Those live primarily in:

- `.cursor/plans/db_column_review_01ef32ea.plan.md`
- git history / migrations on this branch

If you want **one** master decisions doc merging column-review + this triage, say so — that is a separate consolidate pass.

---

## Decision protocol (mandatory)

1. Present one suggestion (#N) with analysis + rec + blast/effort.
2. User answers → **immediately** update this file (placement, notes, chronology row).
3. Announce lock in chat + continue next pending #.
4. Triage **#1–#40 COMPLETE** (2026-08-06). Execution rolls in § “Triage complete — execution rolls”. Next: implement P0 wave.
