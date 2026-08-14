# Plan: Warn reps about CPF clinics with a missing or invalid CPF

## What we agreed

**What the warning is about.** A clinic registered under a person's CPF rather
than a company's CNPJ (`legal_document_type = 'CPF'`) whose `legal_document` is
either absent or not a real CPF. `legal_document_type` is `NOT NULL` and
`legal_document` is nullable, so "missing" is the ordinary case in the data.

| decision | resolution |
|---|---|
| what "missing" means | `legal_document IS NULL` **or** blank after trimming — a blank imported string is the same problem to a rep, and it matches what `displayTaxIdentifier` already treats as absent |
| invalid CPF | counted and listed **separately** from missing, not merged |
| whose clinics | the dashboard's existing scope: reps/managers see their `facilityIds`, ADMIN sees all — so the number agrees with the donut and territory card beside it |
| Linha selector | the counts follow it, like `purchaseStatus` does |
| zero state | the card is hidden entirely when both counts are zero |
| validity check | both sides — mobile for instant feedback, `validateProposedValue` on the server as the authority |
| how validity is computed in SQL | an `IMMUTABLE` `is_valid_cpf(text)` function added by migration, shared by the count and the list filter |
| list shape | one screen, one route; the filter parameter decides whether it shows missing or invalid |
| how the list is served | `GET /api/v1/facilities` with a new query parameter, reusing scope, paging, sort and search |
| where the filter is reachable | dashboard drill-down only, not the Explorar filter sheet |
| detail warning action | deep-links to *dados administrativos*, where `legalDocument` is already a suggestable field |

**The defect this uncovered.** `validateLegalDocument` — a complete módulo-11
implementation — already exists in `facility-tax-id.utils.ts` and runs when a
field suggestion is *applied*. It does not run when one is *submitted*:
`validateProposedValue` treats `legalDocument` as any non-empty string. So a rep
can file `123` as a CPF, it is accepted into the review queue, and it throws in
the reviewer's face at approval time. Task 2 closes that.

## Task breakdown

1. **`is_valid_cpf` SQL function**
   `packages/database/drizzle/0104_is_valid_cpf.sql`, plus the generated
   snapshot and `_journal.json` entry.
   Adds an `IMMUTABLE` function performing the same módulo-11 check as
   `isValidCpfDigits` — length 11, not all-same-digit, both check digits. Being
   immutable, it can back a partial index later if `facilities` grows.

2. **Validate a suggested CPF on submit**
   `apps/api/src/modules/field-suggestions/application/services/field-suggestion-apply.service.ts`.
   `validateProposedValue` calls the existing `validateLegalDocument` for
   `legalDocument` instead of only `asNonEmptyString`, so an invalid value is
   refused when it is filed rather than when it is approved. The type is not
   known at submit time for a `legalDocument` suggestion, so the facility's
   current `legalDocumentType` decides which checksum applies.

3. **List filter for the two states**
   `apps/api/src/modules/facility/application/list-facilities-query.ts`,
   `.../interfaces/facility.repository.interface.ts`,
   `.../drizzle/drizzle-facility.repository.ts`.
   Adds `cpfStatus=missing|invalid`, validated like the other enum params
   (present-but-unparseable is a 400, absent stays absent). `missing` becomes
   `type = 'CPF' AND (legal_document IS NULL OR btrim(legal_document) = '')`;
   `invalid` becomes `type = 'CPF' AND legal_document IS NOT NULL AND
   btrim(legal_document) <> '' AND NOT is_valid_cpf(legal_document)`.

4. **Dashboard counts**
   `apps/api/src/modules/dashboard/infrastructure/repositories/drizzle-dashboard.repository.ts`,
   `.../application/get-dashboard-summary.use-case.ts`.
   One aggregate returning `{ missing, invalid }`, taking the same
   `verticalIds` / `facilityIds` arguments as `countPurchaseBuckets` so it
   cannot drift from the scope the rest of the summary uses. Added to the
   existing `Promise.all`, so no extra round trip and no extra request.

5. **Mobile: summary model**
   `apps/mobile/lib/features/dashboard/data/models/dashboard_summary.dart`.
   Adds a `cpfIssues` block with both counts, defaulting to zero when the key
   is absent so an older client against a newer API does not crash.

6. **Mobile: the warning card**
   `apps/mobile/lib/features/dashboard/presentation/widgets/cpf_warning_card.dart` (new),
   wired into `.../screens/dashboard_screen.dart`.
   Renders nothing when both counts are zero. Shows a row per non-zero count,
   each tapping through to the list with the matching filter.

7. **Mobile: the drill-down list**
   `apps/mobile/lib/features/dashboard/presentation/screens/cpf_issue_facilities_screen.dart` (new),
   `.../providers/cpf_issue_facilities_provider.dart` (new),
   route in `apps/mobile/lib/router/routes.dart`.
   Modelled directly on `PurchaseBucketFacilitiesScreen`, which is already
   "Explorar list, filtered, reached from the dashboard": same search bar, sort
   row, skeletons and empty state. Row tap pushes the clinic detail.

8. **Mobile: the clinic-detail warning**
   `apps/mobile/lib/features/explore/presentation/widgets/clinic_detail/` — a
   banner widget, shown from the detail screen.
   Uses `Facility.legalDocumentType` / `legalDocument`, which the detail
   response already carries, so this needs no API change. Distinguishes missing
   from invalid, and taps through to *dados administrativos*.

9. **Mobile: validate before suggesting**
   `apps/mobile/lib/features/explore/presentation/tax_identifier.dart` (or a
   sibling validator), used by the suggestion sheet for `legalDocument`.
   Ports the same módulo-11 rule so the rep sees the error as they type rather
   than after a round trip. The server remains the authority.

10. **Tests, and one shared checksum fixture**
    `packages/database/fixtures/cpf-checksum-cases.json` (new), read by the
    TypeScript, Dart and SQL suites; plus tests alongside each unit above.

    The checksum is implemented three times on purpose and **all three stay**:

    | where | why it cannot be dropped |
    |---|---|
    | Dart | tells the rep as they type, with no round trip — the point of Task 9 |
    | TypeScript | the server is the authority; the API is reachable by any client |
    | SQL | only the database can say *which* rows have an invalid CPF, for the count and for a paginated list |

    What is shared is the **fixture, not the code**: one list of
    `(input, expected)` cases — valid, wrong check digit, all-same-digits, wrong
    length, punctuation, blank — asserted by all three suites. Left to
    themselves each suite tests whatever its author thought of, and a fix
    applied to one implementation and not the others passes everywhere. This is
    the same drift that put `unitTypeIds` in an interface but not its
    implementation, and the Meili exclusion on a different field from its SQL
    condition.

    Also: a db-test that `cpfStatus` filters what it claims; a use-case test
    that the dashboard counts follow scope and Linha; a widget test that the
    card hides at zero and routes to the right filter.

## Blocking relationships

- Task 3 blocked by Task 1 (`invalid` filter calls the function)
- Task 4 blocked by Task 1 (same)
- Task 5 blocked by Task 4 (needs the response shape)
- Task 6 blocked by Task 5
- Task 7 blocked by Task 3 and Task 6 (needs the API param and an entry point)
- Tasks 1, 2 and 9 each implement the checksum and all three read Task 10's
  shared fixture, so whichever lands first should add the fixture file
- Tasks 2, 8 have no blockers and can start immediately
- Task 10 tracks whichever unit it covers

## Deferred questions

- **Invalid CNPJ.** The same gap exists for CNPJ clinics, and Task 2 fixes the
  submit-time hole for both. The warning and the list stay CPF-only as asked;
  extending them is a filter value away if you want it later.
- **Indexing.** The existing partial indexes are `WHERE legal_document IS NOT
  NULL`, so neither serves these queries. Default: ship without a new index —
  `facilities` looks to be in the low thousands, and the dashboard already scans
  it for `countPurchaseBuckets`. Revisit if the count shows up in timings.
- **Meili.** `cpfStatus` is not an indexed attribute, so searching *inside* the
  drill-down list falls back to SQL. Default: accept it — the list is small and
  reps are unlikely to search it. Indexing a `hasValidCpf` boolean is the fix if
  it matters, and it would need a facilities rebuild.
- **Duplicate CPFs.** Only CNPJ has a uniqueness index; two clinics may share a
  CPF today. Out of scope, and not flagged by this feature.
