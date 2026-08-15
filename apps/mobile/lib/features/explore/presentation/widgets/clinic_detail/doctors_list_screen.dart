import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/core/user/role_capability_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/data/facility_roster_constants.dart'
    show facilityRosterListPageSize;
import 'package:atlasmed_mobile_app/features/explore/data/domain/person_facility_role_catalog.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_roster.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_associate_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_professionals_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_roster_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/associate_doctors_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/doctor_clinic_actions_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/edit_doctor_roles_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/facility_roster_filter_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/doctor_row.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/empty_state.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/search_bar_widget.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/sort_row.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/sort_sheet.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';

/// Full list of CRM doctors at an establishment — same table chrome as
/// Explorar (search + filter + sort chips + [DoctorRow]).
///
/// Opens immediately with [doctors] (strip cache), then hydrates a fuller
/// page in the background when [facilityId] is set.
class DoctorsListScreen extends ConsumerStatefulWidget {
  const DoctorsListScreen({
    super.key,
    required this.doctors,
    required this.facilityName,
    this.facilityId,
  });

  final List<ProfessionalRoster> doctors;
  final String facilityName;

  /// When set, load a larger roster page after first frame.
  final int? facilityId;

  @override
  ConsumerState<DoctorsListScreen> createState() => _DoctorsListScreenState();
}

class _DoctorsListScreenState extends ConsumerState<DoctorsListScreen> {
  late List<ProfessionalRoster> _doctors = List.of(widget.doctors);
  String _query = '';
  String _sort = 'name-asc';
  Map<String, List<String>> _filters = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _hydrateFullList());
  }

  Future<void> _hydrateFullList({bool force = false}) async {
    final facilityId = widget.facilityId;
    if (facilityId == null || (facilityId <= 0)) return;

    final repo = FacilityProfessionalsRepository(
      facilityId,
      page: 1,
      limit: facilityRosterListPageSize,
      view: 'all',
    );
    final List<ProfessionalRoster> next;
    try {
      final page = await repo.loadPage();
      next = page.items;
    } catch (_) {
      return;
    } finally {
      repo.dispose();
    }

    if (!mounted) return;
    if (!force && next.isEmpty) return;
    // Keep cached rows if hydrate somehow returned a shorter slice.
    if (!force && next.length < _doctors.length) return;
    setState(() => _doctors = next);
  }

  Future<void> _refreshAfterMutation(List<ProfessionalRoster> added) async {
    setState(() {
      final existing = _doctors.map((d) => d.id).toSet();
      _doctors = [..._doctors, ...added.where((d) => !existing.contains(d.id))];
    });
    final facilityId = widget.facilityId;
    if (facilityId != null && (facilityId > 0)) {
      // Refresh detail strip behind this route + re-hydrate list from API.
      await ref
          .read(facilityDoctorsRosterProvider(facilityId).notifier)
          .retry();
      await _hydrateFullList(force: true);
    }
  }

  @override
  void didUpdateWidget(covariant DoctorsListScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.doctors != widget.doctors) {
      _doctors = List.of(widget.doctors);
    }
  }

  List<String> get _specialtyOptions {
    final set = <String>{};
    for (final d in _doctors) {
      final s = d.specialty?.trim();
      if (s != null && s.isNotEmpty) set.add(s);
    }
    final list = set.toList()..sort();
    return list;
  }

  Map<String, List<String>> get _filterSections {
    final papel = PersonFacilityRoleCatalog.activeNames(
      PersonFacilityRoleCatalogCache.entries,
    );
    return {
      if (_specialtyOptions.isNotEmpty) 'Especialidade': _specialtyOptions,
      if (papel.isNotEmpty) 'Papel': papel,
    };
  }

  int get _filterCount =>
      _filters.values.fold<int>(0, (sum, list) => sum + list.length);

  List<ProfessionalRoster> get _filtered {
    var list = List<ProfessionalRoster>.from(_doctors);
    final q = _query.trim().toLowerCase();
    if (q.isNotEmpty) {
      list = list
          .where(
            (d) =>
                d.name.toLowerCase().contains(q) ||
                (d.specialty?.toLowerCase().contains(q) ?? false) ||
                (d.crm?.toLowerCase().contains(q) ?? false),
          )
          .toList();
    }

    final specialties = _filters['Especialidade'] ?? const <String>[];
    if (specialties.isNotEmpty) {
      list = list
          .where((d) => specialties.contains(d.specialty?.trim()))
          .toList();
    }

    final roles = _filters['Papel'] ?? const <String>[];
    if (roles.isNotEmpty) {
      final selectedIds = PersonFacilityRoleCatalog.idsForNames(
        roles,
        PersonFacilityRoleCatalogCache.entries,
      );
      list = list.where((d) => d.roleIds.any(selectedIds.contains)).toList();
    }

    switch (_sort) {
      case 'name-asc':
        list.sort(
          (a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()),
        );
      default:
        list.sort(
          (a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()),
        );
    }
    return list;
  }

  List<FilterChipData> get _filterChips {
    final chips = <FilterChipData>[];
    for (final entry in _filters.entries) {
      for (final value in entry.value) {
        chips.add(
          FilterChipData(
            label: value,
            onRemove: () {
              setState(() {
                final next = Map<String, List<String>>.from(_filters);
                next[entry.key] = (next[entry.key] ?? [])
                    .where((x) => x != value)
                    .toList();
                if (next[entry.key]!.isEmpty) next.remove(entry.key);
                _filters = next;
              });
            },
          ),
        );
      }
    }
    return chips;
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        foregroundColor: AppColors.gray900,
        title: Text(
          'Médicos · ${_doctors.length}',
          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
        ),
      ),
      floatingActionButton: ref.watch(canMutateProfessionalProvider)
          ? FloatingActionButton(
              onPressed: _openAssociate,
              backgroundColor: AppColors.navyBright,
              foregroundColor: Colors.white,
              child: const Icon(Icons.add_rounded),
            )
          : null,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 2, 20, 12),
            child: SearchBarWidget(
              value: _query,
              onChanged: (q) => setState(() => _query = q),
              onFilter: _showFilterSheet,
              filterCount: _filterCount,
              hintText: 'Buscar médico, especialidade…',
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(0, 0, 0, 4),
            child: SortRow(
              sort: _sort,
              onSortTap: _showSortSheet,
              filterChips: _filterChips,
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
            child: Text(
              filtered.length == 1 ? '1 médico' : '${filtered.length} médicos',
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w500,
                color: AppColors.gray500,
              ),
            ),
          ),
          Expanded(
            child: filtered.isEmpty
                ? EmptyState(query: _query, kind: 'facility-doctor')
                : ListView.builder(
                    itemCount: filtered.length,
                    itemBuilder: (_, i) {
                      final d = filtered[i];
                      return DoctorRow(
                        showDistance: false,
                        showRelationship: true,
                        phone: d.phone,
                        relationshipScore: d.relationshipScore,
                        badges: _badgesFor(d),
                        doctor: ProfessionalEntry(
                          id: d.id,
                          name: d.name,
                          initials: d.initials,
                          hue: d.hue,
                          specialty: d.specialty ?? '',
                          crm: d.crm ?? '',
                          distanceKm: 0,
                        ),
                        onMoreActions: ref.watch(canMutateProfessionalProvider)
                            ? () => _onMoreActions(d)
                            : null,
                        onTap: () => _openProfile(d),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Future<void> _showSortSheet() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => SortSheet(
        kind: 'facility-people',
        sort: _sort,
        onApply: (s) {
          setState(() => _sort = s);
          Navigator.pop(ctx);
        },
      ),
    );
  }

  Future<void> _showFilterSheet() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => FacilityRosterFilterSheet(
        sections: _filterSections,
        filters: _filters,
        onApply: (next) {
          setState(() => _filters = next);
          Navigator.pop(ctx);
        },
      ),
    );
  }

  List<String> _badgesFor(ProfessionalRoster d) => d.roleChipLabels;

  Future<void> _onMoreActions(ProfessionalRoster doctor) async {
    final action = await showDoctorClinicActionsSheet(
      context,
      doctorName: doctor.name,
    );
    if (!mounted || action == null) return;
    switch (action) {
      case DoctorClinicAction.editRoles:
        await _editRoles(doctor);
      case DoctorClinicAction.viewProfile:
        _openProfile(doctor);
      case DoctorClinicAction.endAffiliation:
        await _endAffiliation(doctor);
    }
  }

  Future<void> _endAffiliation(ProfessionalRoster doctor) async {
    final facilityId = widget.facilityId;
    if (facilityId == null || facilityId <= 0) return;
    if (doctor.personFacilityId == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Não foi possível encerrar — vínculo sem identificador',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Encerrar vínculo?'),
        content: Text(
          '${doctor.name} deixará de aparecer como médico desta clínica. '
          'O cadastro da pessoa permanece.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: TextButton.styleFrom(
              foregroundColor: const Color(0xFFB42318),
            ),
            child: const Text('Encerrar'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    final repo = FacilityAssociateRepository(facilityId);
    try {
      await repo.endDoctorAffiliation(doctor);
    } on FacilityAssociateException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.message ?? 'Falha ao encerrar vínculo'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    } finally {
      repo.dispose();
    }

    if (!mounted) return;
    setState(() {
      _doctors = [
        for (final d in _doctors)
          if (d.id != doctor.id) d,
      ];
    });
    ref
        .read(facilityDoctorsRosterProvider(facilityId).notifier)
        .removeWhere((d) => d.id == doctor.id);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${doctor.name} desvinculado da clínica'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _openProfile(ProfessionalRoster doctor) {
    final facilityId = widget.facilityId;
    DoctorDetailRoute(
      id: doctor.id,
      facilityId: facilityId != null && facilityId > 0 ? facilityId : null,
    ).push(context);
  }

  Future<void> _editRoles(ProfessionalRoster doctor) async {
    final updated = await showEditDoctorRolesSheet(
      context,
      doctor: doctor,
      facilityId: widget.facilityId,
    );
    if (updated == null || !mounted) return;

    setState(() {
      _doctors = [
        for (final d in _doctors)
          if (d.id == updated.id) updated else d,
      ];
    });

    final facilityId = widget.facilityId;
    if (facilityId != null && (facilityId > 0)) {
      ref
          .read(facilityDoctorsRosterProvider(facilityId).notifier)
          .replaceWhere((d) => d.id == updated.id, (_) => updated);
    }
  }

  Future<void> _openAssociate() async {
    final added = await showAssociateDoctorsSheet(
      context,
      alreadyAssociatedIds: _doctors.map((d) => d.id).toSet(),
      alreadyAssociatedDoctors: _doctors,
      facilityId: widget.facilityId,
    );
    // Null means dismissed; an empty list means saved with nothing added —
    // which is what a removal-only save returns. Bailing on `isEmpty` skipped
    // the refresh, so an ended affiliation stayed on screen until the next
    // hydrate and looked like it had not worked.
    if (added == null || !mounted) return;
    await _refreshAfterMutation(added);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          added.isEmpty
              // The sheet performed the removals; how many is its own business,
              // and claiming a count here would be a second source for it.
              ? 'Vínculos atualizados'
              : added.length == 1
              ? '${added.first.name} associado à clínica'
              : '${added.length} médicos associados à clínica',
        ),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
