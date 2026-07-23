import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:atlasmed_mobile_app/features/explore/data/models/clinic.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/commercial_status.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/distance_bands.dart';
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
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';

class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({super.key});

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
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

    final isClinic = state.activeTab == 'clinic';
    final filteredList = isClinic
        ? state.filteredClinics
        : state.filteredDoctors;
    final displayedList = filteredList.take(state.visibleCount).toList();
    final hasMore = state.visibleCount < filteredList.length;
    final banded = isClinic
        ? withDistanceBandHeaders<Clinic>(
            displayedList.cast<Clinic>(),
            (c) => c.distanceKm,
          )
        : withDistanceBandHeaders<Doctor>(
            displayedList.cast<Doctor>(),
            (d) => d.distanceKm,
          );

    final filterChips = buildFilterChips(state, notifier, isClinic);
    final filterCount = filterChips.length;

    return Scaffold(
      backgroundColor: Colors.white,
      floatingActionButton: state.loading
          ? null
          : FloatingActionButton.extended(
              onPressed: () => _openCreate(isClinic),
              backgroundColor: const Color(0xFF1e40af),
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add_rounded),
              label: Text(isClinic ? 'Nova clínica' : 'Novo médico'),
            ),
      body: SafeArea(
        child: Stack(
          children: [
            Column(
              children: [
                const AtlasTopBar(page: 'Explorar'),
                const SizedBox(height: 16),
                _buildSearchBar(state, notifier, filterCount, isClinic),
                TabToggle(
                  value: state.activeTab,
                  onChanged: notifier.setTab,
                  clinicCount: state.clinics.length,
                  doctorCount: state.doctors.length,
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(0, 10, 0, 4),
                  child: SortRow(
                    sort: state.sort,
                    onSortTap: () => setState(() => _sortOpen = true),
                    filterChips: filterChips,
                  ),
                ),
                _buildResultCount(filteredList.length, isClinic),
                Expanded(
                  child: state.loading
                      ? ListView.builder(
                          itemCount: 8,
                          itemBuilder: (_, _) =>
                              SkeletonRow(isDoctor: !isClinic),
                        )
                      : filteredList.isEmpty
                      ? EmptyState(
                          query: state.query,
                          kind: state.activeTab,
                          onCreate: () => _openCreate(isClinic),
                        )
                      : RefreshIndicator(
                          onRefresh: () => ref
                              .read(exploreProvider.notifier)
                              .refreshGpsAndList(),
                          child: _buildBandedList(
                            banded,
                            hasMore,
                            isClinic,
                            notifier,
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
      ),
    );
  }

  void _openCreate(bool isClinic) {
    context.push(
      isClinic
          ? '/workspace/explore/clinics/new'
          : '/workspace/explore/doctors/new',
    );
  }


  Future<void> _showFilterSheet(
    ExploreState state,
    ExploreNotifier notifier,
  ) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
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

  Widget _buildResultCount(int count, bool isClinic) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Align(
        alignment: Alignment.centerLeft,
        child: Text(
          '$count ${isClinic ? (count == 1 ? 'clínica' : 'clínicas') : (count == 1 ? 'médico' : 'médicos')}',
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: Color(0xFF9ca3af),
          ),
        ),
      ),
    );
  }

  Widget _buildBandedList(
    List<BandedListEntry<dynamic>> banded,
    bool hasMore,
    bool isClinic,
    ExploreNotifier notifier,
  ) {
    return NotificationListener<ScrollNotification>(
      onNotification: (notification) {
        if (notification is ScrollEndNotification &&
            hasMore &&
            notification.metrics.pixels >=
                notification.metrics.maxScrollExtent - 200) {
          notifier.loadMore();
        }
        return false;
      },
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        itemCount: banded.length + (hasMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index >= banded.length) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Color(0xFF9ca3af),
                  ),
                ),
              ),
            );
          }

          final entry = banded[index];
          switch (entry) {
            case BandHeader(:final band):
              return Padding(
                padding: const EdgeInsets.fromLTRB(20, 14, 20, 6),
                child: Text(
                  band.label,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.4,
                    color: Color(0xFF6b7280),
                  ),
                ),
              );
            case BandItem(:final item):
              if (isClinic) {
                final clinic = item as Clinic;
                return ClinicRow(
                  clinic: clinic,
                  onTap: () => context.push('/workspace/clinic/${clinic.id}'),
                );
              }
              final doctor = item as Doctor;
              return DoctorRow(
                doctor: doctor,
                onTap: () => context.push('/workspace/doctor/${doctor.id}'),
              );
          }
        },
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
