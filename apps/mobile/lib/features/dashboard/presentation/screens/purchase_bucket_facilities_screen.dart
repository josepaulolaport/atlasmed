import 'dart:async';

import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/purchase_bucket_facilities_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_bucket.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/screens/explore_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/empty_state.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/filter_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/search_bar_widget.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/skeleton_row.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/sort_row.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/sort_sheet.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Clinics list for one Desempenho purchase-status bucket.
/// Same list UX as Explorar clinics, without commercial-status / funnel filters.
class PurchaseBucketFacilitiesScreen extends ConsumerStatefulWidget {
  const PurchaseBucketFacilitiesScreen({
    super.key,
    required this.bucket,
    this.verticalId,
  });

  final String bucket;
  final String? verticalId;

  @override
  ConsumerState<PurchaseBucketFacilitiesScreen> createState() =>
      _PurchaseBucketFacilitiesScreenState();
}

class _PurchaseBucketFacilitiesScreenState
    extends ConsumerState<PurchaseBucketFacilitiesScreen> {
  PurchaseBucketFacilitiesArgs get _args => PurchaseBucketFacilitiesArgs(
    bucket: widget.bucket,
    verticalId: widget.verticalId,
  );

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(purchaseBucketFacilitiesProvider(_args));
    final notifier = ref.read(purchaseBucketFacilitiesProvider(_args).notifier);
    final title = PurchaseBucketFilter.label(widget.bucket);
    final items = state.visibleClinics
        .map((clinic) => Left<FacilityEntry, ProfessionalEntry>(clinic))
        .toList();
    final filterChips = _buildFilterChips(state, notifier);
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(6, 4, 10, 4),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => context.pop(),
                    icon: const Icon(
                      Icons.arrow_back_rounded,
                      color: AppColors.gray900,
                    ),
                  ),
                  Expanded(
                    child: Text(
                      title,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.gray900,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 2, 20, 12),
              child: SearchBarWidget(
                value: state.query,
                onChanged: notifier.setQuery,
                onFilter: () => _showFilterSheet(state, notifier),
                filterCount: filterChips.length,
                hintText: 'Buscar clínica, bairro…',
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
              child: Row(
                children: [
                  Text(
                    state.loading
                        ? 'Carregando…'
                        : '${state.total} clínica${state.total == 1 ? '' : 's'}',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: AppColors.gray500,
                    ),
                  ),
                  const Spacer(),
                  ExploreSortChip(
                    sort: state.sort,
                    onTap: () => _showSortSheet(state, notifier),
                  ),
                ],
              ),
            ),
            if (filterChips.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: SortRow(
                  sort: state.sort,
                  onSortTap: () => _showSortSheet(state, notifier),
                  filterChips: filterChips,
                  includeSort: false,
                ),
              ),
            Expanded(
              child: state.loading
                  ? ListView.builder(
                      itemCount: 8,
                      itemBuilder: (_, _) => const SkeletonRow(isDoctor: false),
                    )
                  : items.isEmpty
                  ? EmptyState(
                      query: state.query,
                      kind: 'clinic',
                      hasActiveFilters: filterChips.isNotEmpty,
                    )
                  : RefreshIndicator(
                      onRefresh: () => notifier.refreshGpsAndList(),
                      child: ExploreResultsList(
                        items: items,
                        hasMore: state.canLoadMore,
                        isLoadingMore: state.loadingMore,
                        onLoadMore: () => unawaited(notifier.loadMore()),
                        bottomInset: bottomInset,
                        preferredVerticalId: widget.verticalId,
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  List<FilterChipData> _buildFilterChips(
    PurchaseBucketFacilitiesState state,
    PurchaseBucketFacilitiesNotifier notifier,
  ) {
    final chips = <FilterChipData>[];

    for (final key in (state.filters['purchaseProfile'] ?? [])) {
      chips.add(
        FilterChipData(
          label: purchaseProfileFromApi(key)?.label ?? key,
          onRemove: () {
            final next = Map<String, List<String>>.from(state.filters);
            next['purchaseProfile'] = [];
            notifier.applyFilters(
              filters: next,
              radiusKm: state.radiusKm,
              clearRadius: state.radiusKm == null,
            );
          },
        ),
      );
    }

    final minDays = state.filters['purchaseIntervalMinDays']?.first;
    final maxDays = state.filters['purchaseIntervalMaxDays']?.first;
    if (minDays != null || maxDays != null) {
      final label = [
        if (minDays != null) '≥ $minDays d',
        if (maxDays != null) '≤ $maxDays d',
      ].join(' · ');
      chips.add(
        FilterChipData(
          label: label,
          onRemove: () {
            final next = Map<String, List<String>>.from(state.filters)
              ..remove('purchaseIntervalMinDays')
              ..remove('purchaseIntervalMaxDays');
            notifier.applyFilters(
              filters: next,
              radiusKm: state.radiusKm,
              clearRadius: state.radiusKm == null,
            );
          },
        ),
      );
    }

    if (state.radiusKm != null) {
      chips.add(
        FilterChipData(
          label: '${state.radiusKm!.toInt()} km',
          onRemove: () {
            notifier.applyFilters(filters: state.filters, clearRadius: true);
          },
        ),
      );
    }

    return chips;
  }

  Future<void> _showSortSheet(
    PurchaseBucketFacilitiesState state,
    PurchaseBucketFacilitiesNotifier notifier,
  ) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      useRootNavigator: true,
      builder: (ctx) => SortSheet(
        kind: 'clinic',
        sort: state.sort,
        hasLocation: state.origin != null,
        onApply: notifier.setSort,
      ),
    );
  }

  Future<void> _showFilterSheet(
    PurchaseBucketFacilitiesState state,
    PurchaseBucketFacilitiesNotifier notifier,
  ) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      builder: (context) => FilterSheet(
        kind: 'clinic',
        filters: state.filters,
        radiusKm: state.radiusKm,
        hideCommercialStatus: true,
        hidePurchaseFunnel: true,
        onApply: (filters, radiusKm) {
          notifier.applyFilters(
            filters: filters,
            radiusKm: radiusKm,
            clearRadius: radiusKm == null,
          );
          Navigator.pop(context);
        },
      ),
    );
  }
}
