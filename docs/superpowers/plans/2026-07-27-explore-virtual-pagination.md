# Explore Virtual Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace imperative Explore fetching and accumulated result lists with a virtual `ListView.builder` backed by reactive, query-keyed repository pages retained for a short TTL.

**Architecture:** `ExploreNotifier` owns only user query intent and location. Derived query providers create page-one clinic/professional queries; row widgets calculate their page and offset from the global list index and watch a shared `StreamProvider.family` for that page. Page providers bridge the existing reactive repositories into Riverpod and keep each page alive for two minutes after its last listener is removed.

**Tech Stack:** Flutter, flutter_riverpod 2.6, existing `BaseRepository`/`Repository` streams, Flutter widget tests.

---

## File map

- Modify `apps/mobile/lib/features/explore/presentation/providers/clinic_providers.dart`: add query copying and the reactive page provider with TTL.
- Modify `apps/mobile/lib/features/explore/presentation/providers/doctor_list_providers.dart`: add query copying and the reactive page provider with TTL.
- Create `apps/mobile/lib/features/explore/presentation/providers/explore_query_providers.dart`: convert `ExploreState` plus vertical/location inputs into typed base queries.
- Modify `apps/mobile/lib/features/explore/presentation/providers/explore_provider.dart`: reduce state/notifier to query intent, GPS synchronization, debounce, and repository invalidation.
- Create `apps/mobile/lib/features/explore/presentation/widgets/explore_paged_results.dart`: render flat virtual clinic/doctor lists whose rows resolve a shared repository page lazily.
- Modify `apps/mobile/lib/features/explore/presentation/screens/explore_screen.dart`: use the base-query/page providers and paged result widgets.
- Modify `apps/mobile/test/features/explore/presentation/providers/explore_provider_test.dart`: cover debounced query intent and reduced notifier behavior.
- Create `apps/mobile/test/features/explore/presentation/providers/explore_query_providers_test.dart`: cover page/offset mapping, query copying, and state-to-query mapping.
- Modify `apps/mobile/test/features/explore/presentation/explore_results_list_test.dart`: cover virtual rows, skeletons, and navigation with overridden page providers.

### Task 1: Query and page-provider contracts

- [ ] Add `copyWith({int? page})` to `ClinicsQuery` and `DoctorsQuery` so rows can derive a page query without rebuilding filter parameters.
- [ ] Add the constant `exploreRepositoryPageTtl = Duration(minutes: 2)`.
- [ ] Add `clinicsPageProvider` and `doctorsPageProvider` as `StreamProvider.autoDispose.family` providers. Each provider watches its repository family, forwards only ready repository states, calls `ref.keepAlive()`, starts the TTL timer in `ref.onCancel`, cancels it in `ref.onResume`, and closes it on expiry.
- [ ] Add focused tests proving `copyWith(page:)` preserves every non-page field and page/offset calculations use one-based pages.
- [ ] Run `flutter test test/features/explore/presentation/providers/explore_query_providers_test.dart` from `apps/mobile` and expect PASS.

### Task 2: Query-intent state

- [ ] Remove remote lists, totals, loading flags, pagination counters, local sorting getters, and fetch methods from `ExploreState`/`ExploreNotifier`.
- [ ] Keep `activeTab`, input `query`, debounced `searchQuery`, filters, sort, origin, and radius in `ExploreState`.
- [ ] Make `setQuery` update the visible input immediately and commit `searchQuery` after 350 ms.
- [ ] Make tab/filter/sort/location mutations only update state; changed query equality will select new repository instances automatically.
- [ ] Preserve `refreshGpsAndList`, but implement it as GPS revalidation followed by repository-family invalidation rather than direct fetching.
- [ ] Preserve `refreshAfterClinicUpdate(FacilityDTO)` as clinic repository invalidation so the clinic detail callback remains compatible.
- [ ] Update notifier tests for immediate input state, debounced effective query, and location synchronization.
- [ ] Run `flutter test test/features/explore/presentation/providers/explore_provider_test.dart test/features/location/explore_proximity_test.dart` and expect PASS.

### Task 3: Derived base queries

- [ ] Create pure helpers that map filters and sort strings to API query types.
- [ ] Add `clinicsQueryProvider`, returning `AsyncValue<ClinicsQuery>` because the effective vertical is asynchronous.
- [ ] Add `doctorsQueryProvider`, returning `DoctorsQuery` synchronously.
- [ ] Ensure repository queries use `searchQuery`, while the search widget continues using immediate `query`.
- [ ] Add tests for clinic and doctor query fields, including location, filters, sort order, and page-one defaults.
- [ ] Run the provider test file and expect PASS.

### Task 4: Flat virtual paged lists

- [ ] Create `ExplorePageIndex` with `page = index ~/ pageSize + 1` and `offset = index % pageSize`.
- [ ] Create `ClinicsPagedResults` and `DoctorsPagedResults`.
- [ ] Have each list watch page one to obtain the exact API `pagination.total`, then use that total as the flat `ListView.builder.itemCount`.
- [ ] Have each row calculate its page/offset and watch the corresponding shared page provider. Return `SkeletonRow` while that page is unresolved, an inline retry row on provider error, and the typed row when data is ready.
- [ ] Set `cacheExtent` so Flutter naturally requests the next page shortly before it becomes visible.
- [ ] Preserve bottom safe-area spacing, empty state behavior, navigation routes, and pull-to-refresh.
- [ ] Add widget tests with page-provider overrides to prove index 20 reads page 2 offset 0, unresolved pages show a skeleton, and clinic/doctor taps navigate correctly.
- [ ] Run `flutter test test/features/explore/presentation/explore_results_list_test.dart` and expect PASS.

### Task 5: Screen integration and cleanup

- [ ] Replace `ExploreResultsList` and notifier-backed result computation in `explore_screen.dart` with derived queries and the appropriate paged list.
- [ ] Derive tab counts from page-one pagination results instead of `ExploreState` totals.
- [ ] Remove manual selected-vertical refresh; watching `effectiveFacilityVerticalIdProvider` in the clinic query provider handles it.
- [ ] Keep periodic GPS refresh and pull-to-refresh, now implemented via state changes/invalidation.
- [ ] Remove obsolete imports and the unused `locationServiceProvider` re-export.
- [ ] Format all touched Dart files.

### Task 6: Verification

- [ ] Run targeted tests:

```bash
cd apps/mobile
flutter test \
  test/features/explore/presentation/providers/explore_provider_test.dart \
  test/features/explore/presentation/providers/explore_query_providers_test.dart \
  test/features/explore/presentation/explore_results_list_test.dart \
  test/features/location/explore_proximity_test.dart
```

Expected: all tests pass.

- [ ] Run static analysis:

```bash
cd apps/mobile
flutter analyze
```

Expected: no new errors; fix all failures related to touched files.

- [ ] Re-check the original requirement: no imperative clinic/doctor page fetch methods remain; page repositories are created lazily from global indices, shared by query key, and retained for the configured TTL.
