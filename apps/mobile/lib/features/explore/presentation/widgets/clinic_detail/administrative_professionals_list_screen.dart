import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/core/user/role_capability_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/data/facility_roster_constants.dart'
    show facilityRosterListPageSize;
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_representatives_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_roster_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/create_admin_professional_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/facility_roster_filter_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/representative_detail_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/empty_state.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/search_bar_widget.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/sort_row.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/sort_sheet.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Full list of administrative professionals — same Explorar table chrome
/// (search + filter + sort + hairline rows) as [DoctorsListScreen].
///
/// Opens immediately with [professionals] (strip cache), then hydrates a
/// fuller page in the background when [facilityId] is set.
class AdministrativeProfessionalsListScreen extends ConsumerStatefulWidget {
  const AdministrativeProfessionalsListScreen({
    super.key,
    required this.professionals,
    required this.facilityName,
    this.facilityId,
  });

  final List<AdministrativeProfessional> professionals;
  final String facilityName;

  /// When set, load a larger page after first frame.
  final int? facilityId;

  @override
  ConsumerState<AdministrativeProfessionalsListScreen> createState() =>
      _AdministrativeProfessionalsListScreenState();
}

class _AdministrativeProfessionalsListScreenState
    extends ConsumerState<AdministrativeProfessionalsListScreen> {
  late List<AdministrativeProfessional> _professionals = List.of(
    widget.professionals,
  );
  String _query = '';
  String _sort = 'name-asc';
  Map<String, List<String>> _filters = {};

  static const _typeSection = 'Função';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _hydrateFullList());
  }

  Future<void> _hydrateFullList({bool force = false}) async {
    final facilityId = widget.facilityId;
    if (facilityId == null || (facilityId <= 0)) return;

    final repo = FacilityRepresentativesRepository(
      facilityId,
      page: 1,
      limit: facilityRosterListPageSize,
    );
    final List<AdministrativeProfessional> next;
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
    if (!force && next.length < _professionals.length) return;
    setState(() => _professionals = next);
  }

  Future<void> _refreshAfterMutation(
    List<AdministrativeProfessional> added,
  ) async {
    setState(() {
      final existing = _professionals.map((p) => p.id).toSet();
      _professionals = [
        ..._professionals,
        ...added.where((p) => !existing.contains(p.id)),
      ];
    });
    final facilityId = widget.facilityId;
    if (facilityId != null && (facilityId > 0)) {
      await ref
          .read(facilityAdministratorsRosterProvider(facilityId).notifier)
          .retry();
      await _hydrateFullList(force: true);
    }
  }

  @override
  void didUpdateWidget(
    covariant AdministrativeProfessionalsListScreen oldWidget,
  ) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.professionals != widget.professionals) {
      _professionals = List.of(widget.professionals);
    }
  }

  Map<String, List<String>> get _filterSections => {
    _typeSection: const [
      'Parceiro',
      'Administrador',
      'Decisor',
      'Comprador',
      'Faturamento',
      'Secretário(a)',
    ],
  };

  int get _filterCount =>
      _filters.values.fold<int>(0, (sum, list) => sum + list.length);

  List<AdministrativeProfessional> get _filtered {
    var list = List<AdministrativeProfessional>.from(_professionals);
    final q = _query.trim().toLowerCase();
    if (q.isNotEmpty) {
      list = list
          .where(
            (p) =>
                p.name.toLowerCase().contains(q) ||
                (p.roleTitle?.toLowerCase().contains(q) ?? false) ||
                p.roleChipLabels.any((l) => l.toLowerCase().contains(q)) ||
                (p.phone?.toLowerCase().contains(q) ?? false) ||
                (p.email?.toLowerCase().contains(q) ?? false),
          )
          .toList();
    }

    final types = _filters[_typeSection] ?? const <String>[];
    if (types.isNotEmpty) {
      list = list.where((p) => p.roleChipLabels.any(types.contains)).toList();
    }

    list.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
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
          'Profissionais administrativos · ${_professionals.length}',
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
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
              hintText: 'Buscar nome, cargo…',
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
              filtered.length == 1
                  ? '1 profissional'
                  : '${filtered.length} profissionais',
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w500,
                color: AppColors.gray500,
              ),
            ),
          ),
          Expanded(
            child: filtered.isEmpty
                ? EmptyState(query: _query, kind: 'facility-admin')
                : ListView.builder(
                    itemCount: filtered.length,
                    itemBuilder: (_, i) => _AdminProfessionalRow(
                      professional: filtered[i],
                      onTap: () async {
                        final updated = await Navigator.of(context)
                            .push<AdministrativeProfessional>(
                              MaterialPageRoute(
                                builder: (_) => RepresentativeDetailScreen(
                                  professional: filtered[i],
                                  facilityName: widget.facilityName,
                                  facilityId: widget.facilityId,
                                ),
                              ),
                            );
                        if (updated == null || !mounted) return;
                        setState(() {
                          _professionals = [
                            for (final p in _professionals)
                              if (p.id == updated.id) updated else p,
                          ];
                        });
                        final facilityId = widget.facilityId;
                        if (facilityId != null && (facilityId > 0)) {
                          await ref
                              .read(
                                facilityAdministratorsRosterProvider(
                                  facilityId,
                                ).notifier,
                              )
                              .retry();
                        }
                      },
                    ),
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

  Future<void> _openAssociate() async {
    final created = await showCreateAdminProfessionalSheet(
      context,
      facilityId: widget.facilityId,
    );
    if (created == null || !mounted) return;
    await _refreshAfterMutation([created]);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${created.name} criado na clínica'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}

/// Same visual language as [DoctorRow] (Explorar table), adapted for
/// administrative contacts.
class _AdminProfessionalRow extends StatelessWidget {
  const _AdminProfessionalRow({
    required this.professional,
    required this.onTap,
  });

  final AdministrativeProfessional professional;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final initials = _initials(professional.name);
    final role = professional.roleTitle?.trim() ?? '';
    final phoneLabel = professional.phone?.trim();
    final hasPhone = phoneLabel != null && phoneLabel.isNotEmpty;

    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.surfaceSecondary)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.blue100,
              ),
              child: Center(
                child: Text(
                  initials,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.blueDarker,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    professional.name,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray900,
                      letterSpacing: -0.15,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Wrap(
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 6,
                    runSpacing: 4,
                    children: [
                      if (role.isNotEmpty)
                        Text(
                          role,
                          style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w500,
                            color: AppColors.navyBright,
                          ),
                        ),
                      for (final label in professional.roleChipLabels)
                        _RowBadge(label: label),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(
                        Icons.phone_outlined,
                        size: 13,
                        color: hasPhone ? AppColors.gray500 : AppColors.gray300,
                      ),
                      const SizedBox(width: 5),
                      Expanded(
                        child: Text(
                          hasPhone ? phoneLabel : 'Sem telefone',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 12,
                            color: hasPhone
                                ? AppColors.gray600
                                : AppColors.gray400,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }
}

class _RowBadge extends StatelessWidget {
  const _RowBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final emphasized = label.toUpperCase().contains('DECISOR');
    final color = emphasized ? AppColors.purple : AppColors.navyBright;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}
