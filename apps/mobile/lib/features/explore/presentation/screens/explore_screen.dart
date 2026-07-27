import 'dart:async';

import 'package:dartz/dartz.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:atlasmed_mobile_app/features/explore/data/models/clinic.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/commercial_status.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/doctor.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/explore_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_row.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/doctor_row.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/empty_state.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/filter_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/search_bar_widget.dart';
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
  final List<Either<Clinic, Doctor>> items;
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
            (clinic) => ClinicRow(
              clinic: clinic,
              onTap: () => context.push('/explore/clinic/${clinic.id}'),
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
  bool _sortOpen = false;
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
              .map((clinic) => Left<Clinic, Doctor>(clinic))
              .toList()
        : state.filteredDoctors
              .take(state.visibleCount)
              .map((doctor) => Right<Clinic, Doctor>(doctor))
              .toList();
    final hasMore =
        state.visibleCount <
        (isClinic
            ? state.filteredClinics.length
            : state.filteredDoctors.length);
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    final filterChips = buildFilterChips(state, notifier, isClinic);
    final filterCount = filterChips.length;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: const AtlasAppBar(page: 'Explorar'),
      body: Stack(
        children: [
          Column(
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
                  onTap: () => setState(() => _sortOpen = true),
                ),
              ),
              if (filterChips.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: SortRow(
                    sort: state.sort,
                    onSortTap: () => setState(() => _sortOpen = true),
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
                        onRefresh: () => ref
                            .read(exploreProvider.notifier)
                            .refreshGpsAndList(),
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
          SortSheet(
            open: _sortOpen,
            onClose: () => setState(() => _sortOpen = false),
            kind: state.activeTab,
            sort: state.sort,
            onApply: notifier.setSort,
          ),
        ],
      ),
    );
  }

  Future<void> _showFilterSheet(
    ExploreState state,
    ExploreNotifier notifier,
  ) async {
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
            label: s,
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
