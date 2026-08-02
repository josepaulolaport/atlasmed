import 'dart:async';

import 'package:dartz/dartz.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/commercial_status.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/facility_service_labels.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_bucket.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/doctor_list_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/explore_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/explore_query_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_services_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_row.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/doctor_row.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/explore_paged_results.dart';
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

/// Compatibility list used by focused clinic surfaces such as Desempenho.
/// The main Explore screen uses [ClinicsPagedResults]/[DoctorsPagedResults].
class ExploreResultsList extends ConsumerWidget {
  const ExploreResultsList({
    required this.items,
    required this.hasMore,
    required this.isLoadingMore,
    required this.onLoadMore,
    required this.bottomInset,
    this.preferredVerticalId,
    super.key,
  });

  final List<Either<FacilityEntry, ProfessionalEntry>> items;
  final bool hasMore;
  final bool isLoadingMore;
  final VoidCallback onLoadMore;
  final double bottomInset;
  final String? preferredVerticalId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
              onTap: () {
                seedClinicDetailShellFromEntry(ref, clinic);
                final verticalId = preferredVerticalId;
                if (verticalId != null && verticalId.isNotEmpty) {
                  context.push(
                    Uri(
                      path: '/explore/clinic/${clinic.id}',
                      queryParameters: {'verticalId': verticalId},
                    ).toString(),
                  );
                  return;
                }
                context.push('/explore/clinic/${clinic.id}');
              },
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

class _QueryLoadingList extends StatelessWidget {
  const _QueryLoadingList({required this.isDoctor});

  final bool isDoctor;

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      itemCount: 8,
      itemBuilder: (_, _) => SkeletonRow(isDoctor: isDoctor),
    );
  }
}

class _QueryError extends StatelessWidget {
  const _QueryError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: TextButton.icon(
        onPressed: onRetry,
        icon: const Icon(Icons.refresh_rounded),
        label: const Text('Tentar novamente'),
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

    final isClinic = state.activeTab == 'clinic';
    final clinicsQuery = ref.watch(clinicsQueryProvider);
    final doctorsQuery = ref.watch(doctorsQueryProvider);
    final clinicTotal = clinicsQuery.maybeWhen(
      data: (query) => ref
          .watch(clinicsPageProvider(query.copyWith(page: 1)))
          .valueOrNull
          ?.pagination
          .total,
      orElse: () => null,
    );
    final doctorTotal = ref
        .watch(doctorsPageProvider(doctorsQuery.copyWith(page: 1)))
        .valueOrNull
        ?.pagination
        .total;
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    if (isClinic && (state.filters['serviceCodes']?.isNotEmpty ?? false)) {
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
            clinicCount: clinicTotal ?? 0,
            doctorCount: doctorTotal ?? 0,
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
            child: isClinic
                ? clinicsQuery.when(
                    data: (query) => ClinicsPagedResults(
                      query: query,
                      bottomInset: bottomInset,
                      preferredVerticalId: query.verticalId,
                      onRefresh: notifier.refreshGpsAndList,
                    ),
                    loading: () => const _QueryLoadingList(isDoctor: false),
                    error: (_, _) => _QueryError(
                      onRetry: () =>
                          ref.invalidate(effectiveFacilityVerticalIdProvider),
                    ),
                  )
                : DoctorsPagedResults(
                    query: doctorsQuery,
                    bottomInset: bottomInset,
                    onRefresh: notifier.refreshGpsAndList,
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
      for (final key in (state.filters['purchaseFunnelStage'] ?? [])) {
        chips.add(
          FilterChipData(
            label: purchaseFunnelStageFromApi(key)?.label ?? key,
            onRemove: () {
              final next = Map<String, List<String>>.from(state.filters);
              next['purchaseFunnelStage'] = [];
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
