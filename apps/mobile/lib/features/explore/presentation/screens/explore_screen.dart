import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../shared/widgets/app_shell.dart';
import '../../data/models.dart';
import '../../data/explore_list_filters.dart';
import '../../data/mappers/explore_mapper.dart';
import '../providers/explore_provider.dart';
import '../widgets/clinic_row.dart';
import '../widgets/doctor_row.dart';
import '../widgets/empty_state.dart';
import '../widgets/filter_sheet.dart';
import '../widgets/search_bar_widget.dart';
import '../widgets/skeleton_row.dart';
import '../widgets/sort_row.dart';
import '../widgets/sort_sheet.dart';
import '../widgets/tab_toggle.dart';

class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({super.key});

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  bool _filterOpen = false;
  bool _sortOpen = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(exploreProvider.notifier).loadData();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(exploreProvider);
    final notifier = ref.read(exploreProvider.notifier);

    final isClinic = state.activeTab == 'clinic';
    final filteredList = isClinic
        ? state.filteredClinics
        : state.filteredDoctors;
    final displayedList = filteredList;
    final hasMore = isClinic ? state.clinicHasMore : state.doctorHasMore;
    final isLoadingMore = state.loadingMore;

    // Build filter chips for active filters
    final filterChips = buildFilterChips(state, notifier, isClinic);
    final filterCount = filterChips.length;

    final filterOptions = ref.watch(exploreFilterOptionsProvider).maybeWhen(
          data: (value) => value,
          orElse: () => const ExploreFilterOptions(),
        );
    final repository = ref.watch(exploreRepositoryProvider);

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Stack(
          children: [
            // ── Main content ──────────────────────────────
            Column(
              children: [
                const AtlasTopBar(page: 'Explorar'),
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
                      ? EmptyState(query: state.query, kind: state.activeTab)
                      : _buildList(displayedList, hasMore, isLoadingMore, isClinic, notifier),
                ),
              ],
            ),

            // ── Filter sheet overlay ──────────────────────
            FilterSheet(
              open: _filterOpen,
              onClose: () => setState(() => _filterOpen = false),
              kind: state.activeTab,
              filters: state.filters,
              filterOptions: filterOptions,
              repository: repository,
              onApply: (f) async {
                setState(() => _filterOpen = false);
                await notifier.setFilters(f);
              },
            ),

            // ── Sort sheet overlay ────────────────────────
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
        onFilter: () => setState(() => _filterOpen = true),
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

  Widget _buildList(
    List<dynamic> displayedList,
    bool hasMore,
    bool isLoadingMore,
    bool isClinic,
    ExploreNotifier notifier,
  ) {
    return NotificationListener<ScrollNotification>(
      onNotification: (notification) {
        if (notification is ScrollEndNotification &&
            hasMore &&
            !isLoadingMore &&
            notification.metrics.pixels >=
                notification.metrics.maxScrollExtent - 200) {
          notifier.loadMore();
        }
        return false;
      },
      child: ListView.builder(
        physics: const BouncingScrollPhysics(),
        itemCount: displayedList.length + (hasMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index >= displayedList.length) {
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

          if (isClinic) {
            final clinic = displayedList[index] as Clinic;
            return ClinicRow(
              clinic: clinic,
              onTap: () => context.push('/workspace/clinic/${clinic.id}'),
            );
          } else {
            final doctor = displayedList[index] as Doctor;
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
        final status = ClinicStatus.values.firstWhere(
          (s) => s.name == key,
          orElse: () => ClinicStatus.ativa,
        );
        chips.add(
          FilterChipData(
            label: status.label,
            onRemove: () {
              final next = Map<String, List<String>>.from(state.filters);
              next['status'] = (next['status'] ?? [])
                  .where((x) => x != key)
                  .toList();
              notifier.setFilters(next);
            },
          ),
        );
      }
      for (final p in (state.filters['products'] ?? [])) {
        chips.add(
          FilterChipData(
            label: p,
            onRemove: () {
              final next = Map<String, List<String>>.from(state.filters);
              next['products'] = (next['products'] ?? [])
                  .where((x) => x != p)
                  .toList();
              notifier.setFilters(next);
            },
          ),
        );
      }
      for (final code in (state.filters['state'] ?? [])) {
        chips.add(
          FilterChipData(
            label: code,
            onRemove: () {
              final next = Map<String, List<String>>.from(state.filters);
              next['state'] = (next['state'] ?? []).where((x) => x != code).toList();
              notifier.setFilters(next);
            },
          ),
        );
      }
      for (final type in (state.filters['facilityType'] ?? [])) {
        chips.add(
          FilterChipData(
            label: formatDisplayName(type),
            onRemove: () {
              final next = Map<String, List<String>>.from(state.filters);
              next['facilityType'] =
                  (next['facilityType'] ?? []).where((x) => x != type).toList();
              notifier.setFilters(next);
            },
          ),
        );
      }
      for (final city in (state.filters['city'] ?? [])) {
        chips.add(
          FilterChipData(
            label: formatDisplayName(city),
            onRemove: () {
              final next = Map<String, List<String>>.from(state.filters);
              next['city'] = (next['city'] ?? []).where((x) => x != city).toList();
              notifier.setFilters(next);
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
              notifier.setFilters(next);
            },
          ),
        );
      }
    }

    return chips;
  }
}
