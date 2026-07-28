import 'dart:async';

import 'package:dartz/dartz.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/commercial_status.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/facility_service_labels.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_bucket.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/explore_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_services_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_row.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/doctor_row.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/empty_state.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/filter_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/search_bar_widget.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/specialty_filter_drawer.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/skeleton_row.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/sort_row.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/sort_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/tab_toggle.dart';
import 'package:atlasmed_mobile_app/core/user/facility_vertical_filter_bar.dart';
import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';

class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({super.key});

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class ExploreResultsList extends StatelessWidget {
  final List<Either<FacilityEntry, ProfessionalEntry>> items;
  final bool hasMore;
  final bool isLoadingMore;
  final VoidCallback onLoadMore;
  final double bottomInset;

  const ExploreResultsList({
    super.key,
    required this.items,
    required this.hasMore,
    required this.isLoadingMore,
    required this.onLoadMore,
    required this.bottomInset,
  });

  @override
  Widget build(BuildContext context) {
    return NotificationListener<ScrollNotification>(
      onNotification: (notification) {
        if (notification is ScrollEndNotification &&
            hasMore &&
            !isLoadingMore &&
            notification.metrics.pixels >=
                notification.metrics.maxScrollExtent - 200) {
          onLoadMore();
        }
        return false;
      },
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        itemCount: items.length + (hasMore ? 1 : 0) + 1,
        itemBuilder: (context, index) {
          if (index == items.length + (hasMore ? 1 : 0)) {
            return SizedBox(height: bottomInset);
          }

          if (index >= items.length) {
            return isLoadingMore
                ? SkeletonRow(isDoctor: items.last.isRight())
                : const SizedBox.shrink();
          }

          return items[index].fold(
            (facility) => ClinicRow(
              clinic: facility,
              onTap: () => context.push('/explore/clinic/${facility.id}'),
            ),
            (doctor) => DoctorRow(
              doctor: doctor,
              onTap: () => context.push('/explore/doctor/${doctor.id}'),
            ),
          );
        },
      ),
    );
  }
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  Timer? _gpsTimer;

  static const _gpsInterval = Duration(seconds: 90);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await ref.read(exploreProvider.notifier).refreshGpsAndList();
      _gpsTimer = Timer.periodic(_gpsInterval, (_) {
        if (!mounted) return;
        ref.read(exploreProvider.notifier).refreshGpsAndList();
      });
    });
  }

  @override
  void dispose() {
    _gpsTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(exploreProvider);
    final notifier = ref.read(exploreProvider.notifier);

    ref.listen<String?>(selectedFacilityVerticalIdProvider, (previous, next) {
      if (previous == next) return;
      unawaited(notifier.refreshGpsAndList());
    });

    final isClinic = state.activeTab == 'clinic';
    final displayedList = isClinic
        ? state.filteredClinics
              .take(state.visibleCount)
              .map((clinic) => Left<FacilityEntry, ProfessionalEntry>(clinic))
              .toList()
        : state.filteredDoctors
              .take(state.visibleCount)
              .map((doctor) => Right<FacilityEntry, ProfessionalEntry>(doctor))
              .toList();
    final hasMore =
        state.visibleCount <
        (isClinic
            ? state.filteredClinics.length
            : state.filteredDoctors.length);
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    if (isClinic &&
        (state.filters['serviceCodes']?.isNotEmpty ?? false)) {
      unawaited(
        ref.read(facilityServicesRepositoryProvider).currentValueOrResolve(),
      );
    }

    final filterChips = buildFilterChips(state, notifier, isClinic);
    final filterCount = filterChips.length;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: const AtlasAppBar(page: 'Explorar'),
      body: Column(
        children: [
          const SizedBox(height: 16),
          _buildSearchBar(state, notifier, filterCount, isClinic),
          const FacilityVerticalFilterBar(
            padding: EdgeInsets.fromLTRB(16, 8, 16, 0),
          ),
          TabToggle(
            value: state.activeTab,
            onChanged: notifier.setTab,
            clinicCount: state.clinicTotal,
            doctorCount: state.doctorTotal,
            trailing: ExploreSortChip(
              sort: state.sort,
              onTap: () => _showSortSheet(state, notifier),
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
                    itemBuilder: (_, _) => SkeletonRow(isDoctor: !isClinic),
                  )
                : displayedList.isEmpty
                ? EmptyState(query: state.query, kind: state.activeTab)
                : RefreshIndicator(
                    onRefresh: () =>
                        ref.read(exploreProvider.notifier).refreshGpsAndList(),
                    child: ExploreResultsList(
                      items: displayedList,
                      hasMore: hasMore,
                      isLoadingMore: state.loadingMore,
                      onLoadMore: notifier.loadMore,
                      bottomInset: bottomInset,
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Future<void> _showSortSheet(
    ExploreState state,
    ExploreNotifier notifier,
  ) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      useRootNavigator: true,
      builder: (ctx) => SortSheet(
        kind: state.activeTab,
        sort: state.sort,
        onApply: notifier.setSort,
      ),
    );
  }

  Future<void> _showFilterSheet(
    ExploreState state,
    ExploreNotifier notifier,
  ) async {
    // Doctor filters are specialty-only → open dedicated drawer.
    if (state.activeTab == 'doctor') {
      final result = await SpecialtyFilterDrawer.show(
        context,
        kind: 'doctor',
        selected: Set<String>.from(state.filters['specialties'] ?? const []),
      );
      if (!mounted || result == null) return;
      final next = Map<String, List<String>>.from(state.filters)
        ..['specialties'] = result.toList(growable: false);
      notifier.applyFilters(filters: next, clearRadius: true);
      return;
    }

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      builder: (context) => FilterSheet(
        kind: state.activeTab,
        filters: state.filters,
        radiusKm: state.radiusKm,
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

  Widget _buildSearchBar(
    ExploreState state,
    ExploreNotifier notifier,
    int filterCount,
    bool isClinic,
  ) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 2, 20, 12),
      child: SearchBarWidget(
        value: state.query,
        onChanged: notifier.setQuery,
        onFilter: () => _showFilterSheet(state, notifier),
        filterCount: filterCount,
        hintText: isClinic
            ? 'Buscar clínica, bairro…'
            : 'Buscar médico, especialidade…',
      ),
    );
  }

  List<FilterChipData> buildFilterChips(
    ExploreState state,
    ExploreNotifier notifier,
    bool isClinic,
  ) {
    final chips = <FilterChipData>[];

    if (isClinic) {
      for (final key in (state.filters['status'] ?? [])) {
        chips.add(
          FilterChipData(
            label: CommercialStatusFilter.label(key),
            onRemove: () {
              final next = Map<String, List<String>>.from(state.filters);
              next['status'] = [];
              notifier.applyFilters(
                filters: next,
                radiusKm: state.radiusKm,
                clearRadius: state.radiusKm == null,
              );
            },
          ),
        );
      }
      for (final key in (state.filters['purchaseBucket'] ?? [])) {
        chips.add(
          FilterChipData(
            label: PurchaseBucketFilter.label(key),
            onRemove: () {
              final next = Map<String, List<String>>.from(state.filters);
              next['purchaseBucket'] = [];
              notifier.applyFilters(
                filters: next,
                radiusKm: state.radiusKm,
                clearRadius: state.radiusKm == null,
              );
            },
          ),
        );
      }
      final serviceCatalog = ref
          .watch(facilityServicesRepositoryProvider)
          .currentValue;
      final serviceLabels = {
        for (final option in serviceCatalog ?? const [])
          option.serviceCode: option.label,
      };
      for (final code in (state.filters['serviceCodes'] ?? [])) {
        chips.add(
          FilterChipData(
            label: serviceLabels[code] ?? code,
            onRemove: () {
              final next = Map<String, List<String>>.from(state.filters);
              next['serviceCodes'] = (next['serviceCodes'] ?? [])
                  .where((x) => x != code)
                  .toList();
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
    } else {
      for (final s in (state.filters['specialties'] ?? [])) {
        chips.add(
          FilterChipData(
            label: FacilityServiceLabels.formatName(s),
            onRemove: () {
              final next = Map<String, List<String>>.from(state.filters);
              next['specialties'] = (next['specialties'] ?? [])
                  .where((x) => x != s)
                  .toList();
              notifier.applyFilters(filters: next, clearRadius: true);
            },
          ),
        );
      }
    }

    return chips;
  }
}
