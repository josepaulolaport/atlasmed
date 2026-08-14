# Spec 0015 — Importing clinics from the CNES registry

**Status:** Draft (2026-08-13, revised 2026-08-14) · **Depends on:** spec 0012 (registry schema,
professional associations), ADR 0009 (ingestion worker, run ledger), spec 0010 (verticals and
profiles), spec 0009 (territory & clinic ownership — R5, the geometric model)

**Already built** on `chore/remove-facility-without-cnes-20260813`:

- `0105` removed the one facility with no CNES code (recorded in the migration header).
- `0106` made `facilities.cnes_code` **NOT NULL** and `facilities_cnes_code_uidx` **total**, so
  "every facility came from CNES" and "one CNES code, one facility" are database invariants rather
  than conventions.
- `CreateFacilityUseCase` requires a `cnesCode` and checks it resolves in `registry.facilities`.
  `POST /facilities` is no longer a general create endpoint.

Everything below §4 is still to build.

---

## 1. Problem

A rep who knows a clinic exists cannot put it in AtlasMed unless somebody types it in by hand.
CNES describes **631 973 establishments**, **494 273 of them active**, with name, address,
município, telephone, unit type and coordinates — and we mirror **1 423** of them, because the
loader keeps only what we already operate:

```ts
// packages/cnes-ingestion/src/load/load-registry.ts:394
const atlasmedId = atlasIdByCnes.get(cnesId);
if (atlasmedId === undefined) continue;
```

So the registry can answer "which doctors does CNES place at *our* clinics" and cannot answer
"does this clinic exist at all". A rep standing outside a clinic we have never heard of has no
path that ends in a correct record.

## 2. Scope

**In:** mirroring every CNES establishment into `registry`, the catalogues a facility record needs
(unit type, unit subtype, deactivation reason), and a user-driven flow that promotes one registry
facility into `public.facilities` with a vertical profile.

**Out:** the professional pipeline's scope. Vínculos, professionals and their occupations stay
gated on `atlasmed_id IS NOT NULL` exactly as today — mirroring 380 000 establishments must not
drag 7.7 M workload rows in behind them. A facility acquires its doctors only after it is
imported, through the flow spec 0012 already built.

**Data scope changes** from spec 0012 §2 ("only facilities we already operate. Not the national
CNES set") — this spec supersedes that sentence for `registry.facilities` and its catalogues only.

## 3. What the export actually offers

Measured against `BASE_DE_DADOS_CNES_202607.ZIP` (109 entries, 734 781 715 B), sampling 184 359
establishment rows. These numbers are the reason the design is shaped as it is.

| field | source column | fill |
|---|---|---|
| trade / legal name | `NO_FANTASIA` / `NO_RAZAO_SOCIAL` | 100 % |
| legal person type | `TP_PFPJ` | 100 % |
| CNPJ | `NU_CNPJ` | 48.2 % |
| CPF | `NU_CPF` | 30.1 % |
| município / UF | `CO_MUNICIPIO_GESTOR` / `CO_ESTADO_GESTOR` | 100 % |
| street, CEP | `NO_LOGRADOURO`, `CO_CEP` | 100 % |
| telephone | `NU_TELEFONE` | 78.0 % |
| e-mail | `NO_EMAIL` | 53.6 % |
| website | `NO_URL` | 2.1 % |
| unit type | `TP_UNIDADE` | 100 % |
| **coordinates** | `NU_LATITUDE` / `NU_LONGITUDE` | **88.5 % overall** |
| deactivation reason | `CO_MOTIVO_DESAB` | 26.0 % |

**Coordinates are not the problem they look like.** Counted over the whole file: among the
**494 273** establishments with no `CO_MOTIVO_DESAB` — the ones this spec will offer — only
**272 (0.06 %)** lack a point. The gap is almost entirely deactivated units, which are never
offered.

`CO_CNES` is unique across all 631 973 rows, so it is safe as the registry's primary key.

**`CO_TIPO_UNIDADE` on the establishment record is filled on 0.1 % of rows and must be ignored.**
`TP_UNIDADE` is the real column; it is what joins to `tbTipoUnidade.CO_TIPO_UNIDADE`.

**Exactly one subtype per establishment.** `rlEstabSubTipo` carries 134 640 rows and every one of
its 134 640 establishments appears once, so `public.facilities.unit_subtype_id` being a single
column matches the source rather than flattening it.

### 3.1 Our catalogues already mirror CNES

No catalogue needs rebuilding — they are already exact:

| public table | rows | CNES source | rows |
|---|---|---|---|
| `unit_types` | 39 | `tbTipoUnidade` | 39 — identical code set |
| `unit_subtypes` | 91 | `tbSubTipo` | 91 |
| `deactivation_reasons` | 14 | `tbMotivoDesativacao` | 14 |

`facilities.unit_type_id` agreed with CNES on **1 414 of 1 423** bridged facilities. An earlier
draft of this spec recorded the nine divergences as deliberate corrections that must not be
overwritten. **That was wrong.** All 1 442 facilities were created in a single seed on 2026-08-09 —
nine hand-corrections is not what one seed on one day produces — and in most cases our value was
the worse of the two:

| id | facility | ours | CNES |
|---|---|---|---|
| 516 | Acceb **Clínica Popular** | 77 Home Care | 36 Clínica |
| 547 | URSA | 60 Cooperativa | 36 Clínica |
| 1070 | Ares **Hospital Dia** LTDA | 05 Hospital Geral | 62 Hospital/Dia |
| 433 | Hospital Real | 05 Hospital Geral | 62 Hospital/Dia |
| 394 | Ortoclin | 22 Consultório | 36 Clínica |
| 536 | Unigastro Pará | 36 Clínica | 62 Hospital/Dia |
| 1052 | Paranamed | 36 Clínica | 62 Hospital/Dia |

**Migration `0107` realigned all seven.** The rule it applies, and the one any later backfill must
follow: **CNES is authoritative for unit type wherever CNES supplies a resolvable code.** Where it
does not, ours is kept — `722 Itor` and `906 IOB` carry CNES code `16`, which is defined in no
catalogue (§4.3), and our `36` beats no type at all. 906 is our highest-order divergent facility
with 14 orders, so keeping it mattered.

Two consequences fall out of this:

- **`unit_type_id` is descriptive plus a search facet, nothing more.** Nothing commercial reads it
  — not potential, not the funnel, not territory. It is a Meili filter field, so a correction is
  invisible to Explorar's filters until the search index is rebuilt.
- **Nothing keeps it aligned going forward.** `0107` is a one-shot repair; the loader this spec
  introduces is what must maintain the rule, or the divergence returns with the next seed or
  import.

## 3.2 Which establishments we import at all

**The catalogue bridge is the allowlist.** `registry.unit_types` mirrors all 39 CNES types
faithfully; `atlasmed_id` being set is the decision to import that kind. Unmapped means
mirrored-but-never-offered, extending the set is one `UPDATE` with no deploy, and it fails closed —
a type CNES invents next year is invisible until somebody looks at it.

It cannot be "the type exists in `public.unit_types`": that table already holds all 39, so every
type would pass. The decision has to live on the bridge.

Junk falls out for free. The export contains `16` (293 active), `00` (80) and two rows where a
**date** landed in `TP_UNIDADE` (`30-set-2025`, `12-fev-2029`) — column misalignment at source.
None can ever be mapped, so none is ever offered, with no special case.

### The set — places a rep physically visits to sell

| type | active | ours |
|---|---|---|
| 22 Consultório Isolado | 225 950 | 505 |
| 36 Clínica/Centro de Especialidade | 92 302 | 571 |
| 39 SADT Isolado | 31 830 | 8 |
| 04 Policlínica | 12 670 | 180 |
| 05 Hospital Geral | 5 550 | 143 |
| 73 Pronto Atendimento | 1 760 | 2 |
| 62 Hospital/Dia Isolado | 1 090 | 10 |
| 07 Hospital Especializado | 1 058 | 11 |
| 15 Unidade Mista | 495 | 1 |
| 20 Pronto Socorro Geral | 254 | — |
| 21 Pronto Socorro Especializado | 64 | — |

97 % of our own base is four types: 36, 22, 04, 05.

**Excluded as not a sales site:** 43 Farmácia (29 894), 84 Central de Abastecimento (2 329 — the
warehouse case), 68 Central de Gestão (6 538), 64/76/81/82 centrais de regulação e notificação,
40/42/32 unidades móveis (no fixed address), 75 Telessaúde, 50 Vigilância, 67/80 laboratórios
públicos, 74 Polo Academia, 83 Polo Prevenção, 85 Centro de Imunização, 78 Regime Residencial.
**Excluded as public primary care:** 01 Posto, 02 UBS, 69/70/71/72.

**79 Oficina Ortopédica and 77 Home Care are excluded** (decided 2026-08-14). The deciding evidence
is what we sell: the catalogue is **viscosupplementation** — intra-articular hyaluronic acid
(Osteonil, Monovisc, Euflexxa) — injected by a physician into a joint, in a consulting room or day
clinic. There is one vertical, ORTOPEDIA.

- **79** makes and fits orthoses and prostheses. No physician, no joint injection. It shares the
  word *ortopédica* with our vertical and nothing else. 57 active, none ours.
- **77** delivers nursing at the patient's home; the injection is an aseptic clinic procedure.
  2 083 active. Our apparent counter-example evaporated on inspection: facility 516 was our only
  type 77, and CNES classifies it as **36** — it is *Acceb Clínica Popular*, misfiled by the seed
  and corrected by migration `0107` (§3.1). The evidence for including Home Care is zero examples,
  not one weak one.

Both stay mirrored and are never offered. Reversing either is one `UPDATE` on
`registry.unit_types.atlasmed_id`, with no deploy — which is the whole reason the allowlist lives
on the bridge.

### Why 60 (cooperativa) and 68 (central de gestão) are excluded

Not by intuition — they were tested as possible duplicate registrations of a clinical site:

| | type 60 | type 68 |
|---|---|---|
| active | 1 394 | 6 538 |
| **shares a CNPJ with a clinical row** | **0** | **0** |
| shares an address with a clinical row | 309 (22 %) | 922 (14 %) |

Zero CNPJ overlap means a cooperativa is a **distinct legal entity**, not a second registration of a
hospital. The address matches are unrelated businesses in one building — `UNIMED NOROESTE RS` at the
same address as `VIONE DEBONI S S LTDA`. Where the operator really is the same, the clinical row
exists *separately* and is already offered on its own.

Corroborated by our own data: **all 1 131 orders come from clinical types** (759 clínica, 161
consultório, 117 policlínica, 62 hospital geral, 20 hospital especializado, 12 UBS) and **none from
60 or 68**. The nine type-60 facilities we hold have **zero orders between them**.

**UNIMED is an owner, not a place.** 1 610 active establishments across 21 unit types — hospitals,
clinics, labs, pharmacies and admin offices. Type is the right axis precisely because the brand is
orthogonal to it: their clinics come in under 36/05/04, their central de gestão and farmácias do
not.

## 4. Model

### 4.1 New registry catalogues

Same shape as the registry mirrors spec 0012 established — natural CNES key as the primary key,
nullable `atlasmed_id` bridging to `public`, unique where set, never a hard FK across schemas.

```
registry.unit_types            PK cnes_id (CO_TIPO_UNIDADE)   ← tbTipoUnidade
registry.unit_subtypes         PK (unit_type_cnes_id, cnes_id) ← tbSubTipo
registry.deactivation_reasons  PK cnes_id (CD_MOTIVO_DESAB)   ← tbMotivoDesativacao
```

`unit_subtypes` is keyed on the pair because **subtype codes are not globally unique** — CNES
scopes them by unit type, and `public.unit_subtypes_unit_type_id_cnes_id_key` already says so.

### 4.2 New columns on `registry.facilities`

```
latitude                      NU_LATITUDE          numeric, nullable
longitude                     NU_LONGITUDE         numeric, nullable
unit_subtype_code             rlEstabSubTipo       text, nullable
legal_person_type             TP_PFPJ              text, not null once loaded
managing_municipality_cnes_id CO_MUNICIPIO_GESTOR  text, nullable — see §4.4
deactivation_reason_code      CO_MOTIVO_DESAB      — column exists, never populated
```

`municipality_cnes_id` keeps its name and gains the resolution rule of §4.4; the raw gestor moves
to its own column so the two facts stay separable.

`unit_type_name` and `unit_subtype_name` exist today and are **empty on all 1 423 rows**. With
`registry.unit_types` and `registry.unit_subtypes` carrying the names, both denormalised columns
are redundant and should be dropped rather than filled.

### 4.3 `TP_UNIDADE` normalisation

CNES ships the code both zero-padded and not: in the sample, 68 rows of 184 359 use a single
character (`"1"` × 66, `"2"` × 2) where the catalogue uses `01` / `02`. **The loader must
`lpad(code, 2, '0')` before storing or joining.** Skipping this creates a second catalogue row for
the same type and silently splits every lookup.

**Code `16` is an orphan.** It appears on establishments — including 2 of our own bridged rows —
and is defined neither in `tbTipoUnidade` nor in our catalogue. The loader must not invent a
catalogue entry for it: store the code, leave `atlasmed_id` unresolved, and let the import flow
ask the rep to pick the type (§6.2). Inventing a type reads as authoritative and would be wrong;
refusing the import over a code CNES itself does not document would be worse.

### 4.4 Which município an establishment is in

`tbEstabelecimento` carries no standalone `CO_MUNICIPIO` column. It does not follow that
`CO_MUNICIPIO_GESTOR` is the only município on offer — **the establishment's own município is
embedded in `CO_UNIDADE`**, and that is the better source.

Measured over 184 351 rows of the 202607 dump:

| observation | count |
|---|---|
| `CO_UNIDADE` == município(6) + `CO_CNES`(7) | 184 301 (99.97 %) |
| prefix == `CO_MUNICIPIO_GESTOR` | 184 133 |
| **prefix ≠ `CO_MUNICIPIO_GESTOR`** | **218 (0.12 %)** |

Where they disagree, the *gestor* column is usually the broken one — it holds a two-digit **state**
code (`35`, `31`, `41`) where a six-digit município belongs, with `CO_ESTADO_GESTOR` equally
malformed. The remaining disagreements are the ~50 rows that still use the old 30-character
`CO_UNIDADE` (`MG00170000000000000000000105686`), whose prefix is not a município code at all.

**Both codes are stored; neither is treated as the answer.** The registry keeps what CNES said —
the `CO_UNIDADE` prefix in `municipality_cnes_id`, the gestor in `managing_municipality_cnes_id` —
and the import *suggests* a município from the first that resolves, preferring the prefix. The rep
confirms it like every other field.

That is the whole rule. No provenance flag, no disagreement report, no escalation path: the rep
reviews the record either way, so a suggestion they can correct is worth more than a resolution
rule that is right 99.88 % of the time and silent about the rest. The 0.12 % simply arrive with a
suggestion that is wrong, and get fixed in the same gesture as everything else.

On our own 1 423 clinics the two agree on **1 423 of 1 423** and never differ, which is why spec
0012 could accept the gestor column unexamined. That guarantee was a property of our scope, not of
the data.

`rlEstabEndCompl` *does* carry a real `CO_MUNICIPIO`, but it describes **complementary addresses**
— secondary sites such as a município's vigilância sanitária or zoonoses centre — and covers only
7 765 rows. It is not the establishment's own address and must not be used as one.

### 4.5 Geography bridge

`public.states.cnes_code` and `public.municipalities.cnes_code` **already exist and are 100 %
populated** (27/27 and 5 571/5 571), and they join `registry.municipalities.cnes_id` on
**5 571 of 5 571**. No code arithmetic is needed; earlier drafts of this analysis proposed
truncating the IBGE check digit, which is unnecessary.

What is missing is only the registry-side pointer: `registry.states.atlasmed_id` and
`registry.municipalities.atlasmed_id` are **null on every row**. They are backfilled from
`cnes_code` and then maintained by the loader.

**Missing municípios are created.** The registry carries 5 604 municípios against public's 5 571.
When an import needs a município we do not have, the import creates it from
`registry.municipalities` (name, código, parent state) rather than refusing — a real clinic in a
real município is not a data error to reject.

### 4.5 CNPJ and CPF

`TP_PFPJ` has exactly two values and maps cleanly: **`1` = pessoa física** (170 204 rows, 26.9 %)
and **`3` = pessoa jurídica** (461 769, 73.1 %). Cross-tabulated against the document columns it is
consistent on 99.9 % of rows — PF carries `NU_CPF`, PJ carries `NU_CNPJ`.

The exception is large and matters:

| shape | rows | share |
|---|---|---|
| PJ with its own CNPJ | 339 340 | 53.7 % |
| PF with a CPF | 170 132 | 26.9 % |
| **PJ with no CNPJ, only `NU_CNPJ_MANTENEDORA`** | **119 385** | **18.9 %** |

That third row is the municipal and state units — a health post has no CNPJ of its own, only the
prefeitura's. They are legitimately `legal_document_type = 'CNPJ'` with `legal_document = NULL`.

The two documents are not interchangeable:

- **A CNPJ CNES supplied is read-only.** It is the legal identity of the establishment,
  `public.facilities` enforces uniqueness among active CNPJ facilities, and a rep retyping it is
  how two clinics collide.
- **A PJ with no CNPJ is not a missing value.** The 119 415 establishments in that shape are
  public-sector units: **99 391 have natureza jurídica `1244 MUNICIPIO`**, and with the órgãos
  públicos, autarquias and fundações beside them the group is ~99 % public administration — 46 872
  UBS, 10 448 postos de saúde, plus CAPS, vigilância and SAMU units. A UBS genuinely has no CNPJ
  of its own; it operates under the prefeitura's, which is exactly what `NU_CNPJ_MANTENEDORA`
  holds. Asking a rep to supply one invites them to invent it.

  So: store `NU_CNPJ_MANTENEDORA` as `maintainer_tax_id` on the registry row, leave
  `legal_document` null, and neither ask for nor accept a CNPJ for these. The field is empty
  because the establishment has none, and that is the accurate record.
- **CPF is optional and the user's to fill.** CNES ships it on 30.1 % of rows, unmasked (unlike
  the professional file, where it is redacted). Where CNES has one it is prefilled and editable;
  where it does not, the user may supply it. CPF is deliberately **not** unique among facilities —
  one person may own several clinics.

The import writes `legal_document_type` from `TP_PFPJ`, never from a guess about which of the two
columns happened to be filled.

## 5. The ingestion workflow, as changed

Current order is preserved; the gate at step 4 is what moves.

1. **Catalogues** — `tbEstado`, `tbMunicipio`, `tbAtividadeProfissional`, and now `tbTipoUnidade`,
   `tbSubTipo`, `tbMotivoDesativacao`. Councils remain hand-seeded and never ingested (ADR 0009).
2. **Geography bridge** — resolve `registry.states.atlasmed_id` and
   `registry.municipalities.atlasmed_id` through `public.*.cnes_code`.
3. **Establishments** — `tbEstabelecimento`, **every row**, no `atlasmed_id` gate. Roughly 380 000
   upserts against today's 1 423. Existing `atlasmed_id` values are preserved on conflict; the
   loader never clears a bridge a user established.
4. **Subtypes** — `rlEstabSubTipo`, joined on `CO_UNIDADE`, one row per establishment.
5. **Vínculos, professionals, occupations** — unchanged, and still scoped to establishments with
   `atlasmed_id IS NOT NULL`. This is what keeps the load bounded.
6. **Bridge, prune, promote** — unchanged.

**`municipality_cnes_id` stops meaning "the gestor".** It holds the `CO_UNIDADE` prefix — the
establishment's own município, which is what the column's name always implied and what every
reader already assumed. `CO_MUNICIPIO_GESTOR` moves to `managing_municipality_cnes_id` rather than
being discarded: for state- and federally-managed units the two are genuinely different facts, and
conflating them is what made the old column ambiguous.

Neither is authoritative for an import. Both are stored, one is suggested, the rep confirms (§4.4).

**Import validation** (`judgeImport`) gains a rule for the new scale: an establishment count that
resolves to zero, or catalogues that come back empty, is a failed run rather than a thin one.

## 6. The import flow

```
CNES ingestion  →  every establishment in registry  →  candidates index
                        ↓
        user searches Explorar, does not find the clinic
                        ↓
        opens the CNES list (manager/admin, §6.0)
                        ↓
        ┌─────────────── two cases, two writes ───────────────┐
        ↓                                                     ↓
  no atlasmed_id                                    ours, not in my vertical
        ↓                                                     ↓
  import wizard — confirm and complete            one confirmation, no editing
        ↓                                                     ↓
  facility + profile + bridge                       vertical profile only
        └──────────────── candidates index upserted ──────────┘
```

### 6.0 The entry point

**Explorar shows only our facilities and must keep doing so.** The Meili facility index is built
`.from(facilities)`; `registry.facilities` is read today by exactly three things — the professional
suggestion query, the `cnesCode` existence check, and the import repository — and none of them
lists registry clinics. That separation is deliberate and stays: a rep's clinic list is their
*working set*, and folding ~373 000 national rows into a list of ~1 442 would destroy the primary
use to serve an occasional one.

The CNES list is therefore **its own surface, behind a deliberate action** in Explorar → Clínicas,
placed in two spots:

- persistently in the Clínicas tab, and
- in the **no-results state** of a search, which is the exact moment §6 describes: *rep searches,
  does not find the clinic*.

It must read as **search CNES**, never as *add clinic*. Hand-typing is gone (§6.5), so a generic
"+" would promise an action that no longer exists.

**Who may open it: managers and admins only, for now** (decided 2026-08-14). Not a permanent rule —
it is the interim answer to "may a rep import outside their patch" (§9.5), pending a team
discussion. Bounding the list by territory was considered and rejected: too much of the geometry is
wrong today for a territory bound to be a correctness gate rather than an obstacle.

**Name the two wizards apart.** `apps/mobile/lib/features/explore/presentation/screens/`
`cnes_import_wizard.dart` already exists and imports a **professional** into a facility (spec
0012). A facility-import wizard named anything close to it will be confused with it on every future
read. Both get names that say which entity they import.

### 6.1 What is offered

Only establishments that are **active** — no `CO_MOTIVO_DESAB`. A deactivated unit stays mirrored
(deactivation is information, and units reactivate) but is never offered.

The list is exactly two things:

- **registry rows with no `atlasmed_id`** — never imported by anybody, and
- **facilities we hold that have no profile for the user's vertical** — ours, but invisible to them.

Three cases, and they end in different writes:

| case | condition | what import does |
|---|---|---|
| **new to us** | no `atlasmed_id` | create the facility, create the profile, set the bridge |
| **ours already, invisible to this rep** | `atlasmed_id` set, facility has no profile for any vertical the rep holds | **create only the vertical profile.** Never a second facility |
| **ours and visible** | profile exists for the rep's vertical | not offered — it is already in their list |

**Why the second case must be routed differently, and it is not about confusing the rep.** The
outcome they want — the clinic in their list — is reached either way. The reason is that **a
facility record is shared across verticals**: `location`, name, CNPJ, address and unit type live on
`facilities`, not on the profile. Running the full wizard for case 2 would let this rep overwrite
another vertical's curated record with raw CNES values, and re-placing the pin would move the
clinic for *every* vertical, re-triggering territory assignment on profiles that are not theirs.

So case 2 is **not a wizard**. It is a single confirmation — *add to my vertical* — with no field
editing, because the facility already exists and is not this rep's to rewrite. The list needs to
know which case a row is in only in order to route it; no label is required.

### 6.1.1 The candidates index

The list is served by **a Meili index over `registry.facilities`**, not by the existing facility
index and not by SQL.

One index covers both halves, with no union and no merged pagination, because **`registry` is a
complete superset of `public`**: `0106` makes `cnes_code` NOT NULL on every facility, and this spec
mirrors every establishment. (It is not a superset *today* — 19 facilities have no registry row,
all 19 deactivated, because the loader scopes to `deactivated_at IS NULL`. Removing that gate fixes
them; it is an artifact, not bad data.)

Denormalise the linked facility's `verticalIds` onto the registry document and the whole list is
one filter:

```
atlasmedId NOT EXISTS            → never imported
OR verticalIds NOT IN [my verticals] → ours, but not in my vertical
```

**Membership rule:** a document exists when *(the unit type is allowlisted AND the establishment is
active)* **OR** *`atlasmed_id` is set*. The second clause is load-bearing — without it our nine
type-60 facilities would be unreachable for a rep who legitimately needs a profile on one.

| | |
|---|---|
| size | ~373 000 documents — the allowlist, not the 494 273 active |
| searchable | trade name, legal name, CNES code, legal document digits, município, bairro, logradouro |
| filterable | `unitTypeId`, `legalDocumentType`, `municipalityId`, `stateId`, `active`, `atlasmedId`, `verticalIds`, `_geo` |
| sortable | name, distance |

Geosearch earns its place: "a rep standing outside a clinic we have never heard of" is the
motivating case in §1.

**Freshness is the part most likely to be got wrong.** Two writers, and only one is obvious:

1. **The monthly ingestion** — rebuilds the index wholesale.
2. **An import** — the row must leave the list *immediately*. `atlasmed_id` is set, or `verticalIds`
   gains the rep's vertical, and the document must be upserted in the same operation.

If the second is missed, the rep imports a clinic, still sees it as importable, taps again, and
hits a bare unique-index violation on `cnes_code` with no explanation. This is the same drift that
migration `0107` exposed on `unit_type_id` — the index is maintained only by writers that go
through the application — except here it is user-facing and reproducible on the first use.

### 6.2 What the rep confirms

CNES data is a **starting point that the rep verifies**, not a record to trust wholesale. The
wizard prefills from the registry and requires confirmation of what the model depends on:

- **name** — `NO_FANTASIA`, editable
- **CNPJ** — read-only when CNES has one; the field the whole identity rests on
- **CPF** — prefilled when CNES has one, editable, optional
- **município and UF** — **suggested**, not asserted (§4.4). Editable like everything else, with
  the street and CEP beside it as the corroborating evidence
- **address, CEP, telephone, e-mail** — prefilled, editable
- **unit type / subtype** — prefilled from the catalogues. A code the catalogue cannot resolve
  (§4.3) is **asked rather than refused**: the rep picks the type, and the import proceeds.
- **coordinates** — prefilled from CNES when present. When CNES has none, **the rep places the
  point** and the import proceeds. `location` is NOT NULL by deliberate design (spec 0009 R5), and
  the rule that follows from that is "the point must exist", not "CNES must have supplied it".
  This affects 0.1 % of active units, so it is a rare screen, but it is the difference between a
  clinic we can add and one we cannot.

  **The point is load-bearing, and the rep should be told so.** Territory ownership is geometric:
  the pin decides which manager zone the clinic falls in and whether it sits inside a rep's patch
  (spec 0009). A pin dropped on the wrong side of a street is not a cosmetic error. The map should
  open centred on the município and the address, not on the rep's own location.
- **vertical profile** — see §6.3

### 6.3 Vertical profiles

Every one of our 1 443 facilities has at least one profile, and a facility without one is
invisible to everybody. So the import always creates one.

- the rep holds **one** vertical → the profile is created for it, no question asked
- the rep holds **several** → the rep chooses which, and may choose more than one

### 6.4 Duplicate prevention

- `facilities_cnes_code_uidx` — unique on `cnes_code` among active facilities — already makes two
  rows for one establishment impossible. The flow resolves to the existing facility instead of
  attempting an insert, exactly as the professional import resolves a held registration (0012 §6).
- `facilities_active_legal_document_cnpj_uidx` means a CNPJ we already hold under a *different*
  CNES code is a genuine conflict: two establishments claiming one legal entity. The flow reports
  it with the facility that holds it rather than failing on a constraint error.
- `registry_facilities_atlasmed_id_uidx` keeps one registry row per facility.

### 6.5 Matching before creating

**Importing from CNES is the only way a facility comes into existence.** There is no hand-typed
clinic, so from here on every facility carries a `cnes_code` and the unique index below is a
complete defence rather than a partial one.

`POST /facilities` therefore stops being a general create endpoint. It already does the right
thing for profiles — its own summary reads *"always creates the vertical profile; verticalId
required unless the caller has a single vertical"* — so the change is to **require a registry
reference** rather than to replace it. Creating a facility without one becomes impossible through
the API, not merely absent from the UI.

Two consequences worth accepting deliberately:

- **A clinic CNES does not know cannot be added at all.** CNES is the national registry and a
  functioning clinic is required to be in it, so this is close to a tautology — but a brand-new
  clinic can exist for weeks before it appears in a monthly export, and during that window the rep
  cannot record it. That is the cost of the rule.
- **One existing facility has no `cnes_code`** (1 of 1 443). It needs linking by hand or it stays
  unreachable by any CNES-driven path.

Before creating, the flow still looks for a facility we may already have — now only as
**adoption**, since nothing can have been typed in:

1. **CNES code** — resolves to the existing facility, no insert (§6.1).
2. **CNPJ**, when CNES supplied one — a hit is a genuine conflict between two establishments
   claiming one legal entity. The flow shows the facility that holds it and refuses rather than
   guessing.

**One CNES code, one facility, forever.** The unique index is currently **partial on
`deactivated_at IS NULL`**, so a deactivated facility holding a code does not block a fresh import
of it — which would leave two rows for one establishment and a bridge that can only point at one.

The index must become **total**: unique on `cnes_code` regardless of `deactivated_at`. Importing a
code held by a deactivated facility then **reactivates that facility** rather than creating a
second, because the database makes the alternative impossible rather than merely discouraged.

Safe to apply: of 1 443 facilities, 19 are deactivated and **no `cnes_code` is duplicated today**.

## 6.6 What this means for the Emultec order import

The order import already behaves correctly and needs no change — verified in
`apps/workers/temporal/src/emultec/`, which is where it lives (not in `apps/api`).

`resolveEmultecFacility` matches on `id_cliente_emultec`, then CNPJ, then CPF, and returns one of
four refusals — `no_match`, `ambiguous`, `no_document`, `id_cliente_not_cnes_eligible`. The importer
answers a refusal with `skip`, counts it, and **creates nothing**. There is exactly one production
insert into `facilities` in the entire repository, behind `CreateFacilityUseCase`.

Two properties of that resolver matter to this spec:

- **It already filters candidates on `cnesCode IS NOT NULL` and non-blank.** Migration 0106 made
  explicit what this code was quietly assuming.
- **It refuses ambiguity rather than picking.** Correct for the 101 CNPJs nationwide that name more
  than one establishment, and for CPF, which is deliberately not unique among facilities.

**CNPJ is a sound key for a place.** Of 276 148 distinct CNPJs on active establishments, **276 047
(100.0 %) identify exactly one site**. The 101 exceptions are fleets and branch networks — one
carries 51 `UNIDADE MOVEL TIPO B` rows — and only **3** are all-clinical.

So an invoice carrying a payer's CNPJ (a cooperativa, a plan) simply fails to match and is skipped
with a reason. **Nothing must ever create a facility from a billing CNPJ**: that row would be a
facility that is not a place, with no CNES code, which migration 0106 now rejects outright. If
payer-level billing turns out to be common, the answer is a separate payer concept, not a facility
wearing the wrong hat — today's evidence says it is not common.

Excluding cooperativas is safe because a skip is not permanent: skipped orders recover through the
re-check queue, so a genuinely missing clinic can be imported later and its orders linked then.

## 7. Invariants

1. A CNES establishment maps to **at most one** `public.facilities` row, enforced by
   `facilities_cnes_code_uidx` and `registry_facilities_atlasmed_id_uidx`.
2. A facility that exists is **visible to somebody**: every imported facility gets at least one
   vertical profile in the same transaction.
3. `legal_document_type` comes from `TP_PFPJ`, and a CNES-supplied CNPJ is never client-writable.
4. The loader **never clears** an `atlasmed_id`, on any table.
5. Vínculo ingestion stays gated on `atlasmed_id IS NOT NULL`.
6. An unresolvable unit-type code is stored and surfaced, never invented.
7. **Nothing CNES fails to supply blocks an import.** Where the model requires a value the export
   lacks — a point, a resolvable unit type, a município we do not hold — the flow collects it from
   the rep or creates it. What the model requires is that the value *exists*, not that CNES
   provided it.

## 8. Consequences worth stating

- `registry.facilities` grows from 1 423 rows to **631 973** — a factor of 444. Everything that
  reads it was written against the small table: the `cnes-suggestions` query joins it, and the
  prune step and `judgeImport`'s thresholds were both written when "every row is ours" was true.
  All three need re-reading against the new size, not just re-running.
- The establishment file is already read in full every run (298 MB uncompressed); dropping the
  gate changes what is *written*, not what is *read*, so the load's runtime cost is upserts rather
  than I/O.
- Every clinic in Brazil becomes an import candidate. Scope isolation applies to what a user may
  *read of our data*, not to what CNES publishes — but the list is still a facility-creation
  surface, which is why it is searched rather than browsed (§6.1.1) and, for now, restricted to
  managers and admins (§6.0).
- **Importing decides territory.** Ownership is geometric (spec 0009): the point places the clinic
  in a manager zone and inside or outside a rep's patch. A rep can therefore import a clinic that
  immediately belongs to somebody else — and, if territory scoping hides it, one they cannot see
  afterwards. Whether that is acceptable, or whether the offer list should be bounded by the rep's
  own patch, is unresolved (§9.6).

## 9. Open questions

1. ~~**Search shape.**~~ **Resolved** (§6.0, §6.1.1) — its own surface behind a deliberate action in
   Explorar, served by a Meili index over the registry, with geosearch. Still to settle in build:
   ranking between name relevance and distance.
2. **Reactivation.** A CNES establishment that gains a `CO_MOTIVO_DESAB` after we imported it —
   does the facility deactivate, or does it only stop being offered? Today nothing reads
   `deactivation_reason_code`.
3. ~~**The nine divergences.**~~ **Resolved** — migration `0107` realigned the seven where CNES
   supplies a resolvable code and kept the two where it does not (§3.1). What remains open is who
   *keeps* them aligned: `0107` is a one-shot repair and the loader must own the rule from here.
4. **`NU_CNPJ_MANTENEDORA`** — the maintaining organisation's CNPJ, unexamined here. It may be the
   right answer for clinic chains, which the model has no concept of yet.
5. **Can a rep import outside their patch?** **Deferred, with an interim answer** (2026-08-14): the
   list is **not** bounded by territory — too much of the geometry is wrong today for that bound to
   be a correctness gate rather than an obstacle — and it is **open to managers and admins only**
   until the team has discussed it. What stays open is whether reps get it, and on what terms. §8
   still holds: the geometry decides ownership, so an import can hand a clinic to another rep, or
   to nobody the importer can see.
6. **Provenance of a rep-placed point.** `facilities.location` records no source, so a pin the rep
   dropped is indistinguishable from CNES's own. That matters if a later export supplies
   coordinates for the same establishment: overwriting a rep's correction would be wrong,
   and keeping a worse value would also be wrong. Deciding this needs no column today — nothing
   backfills `location` — but it must be decided before anything does.
