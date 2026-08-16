import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_scope_args.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/widgets/filter_drawer.dart';
import 'package:atlasmed_mobile_app/repository/repository_flutter.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The filters of spec 0014 §5, applied uniformly to every metric.
///
/// Each opens a searchable multi-select drawer whose options come from the API,
/// computed over the clinics the viewer can actually see. The lists are
/// progressive: choosing a state narrows the municipality drawer, choosing a
/// manager narrows the rep drawer, and choosing a rep narrows the manager
/// drawer in turn.
///
/// `unit_type` sits outside that entirely — its list is the whole catalogue
/// whatever else is chosen, and choosing one narrows nothing.
class DashboardFilterBar extends ConsumerWidget {
  const DashboardFilterBar({super.key, required this.scope});

  final DashboardScopeArgs scope;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return RepositoryBuilder(
      repository: ref.watch(filterOptionsProvider(scope)),
      builder: (context, options, repo) {
        final available = options ?? const DashboardFilterOptions();

        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              FilterChipButton(
                label: 'Estado',
                selectedCount: scope.stateIds.length,
                onTap: () => _pickState(context, ref, available),
                onClear: () => _clearState(ref, available),
              ),
              FilterChipButton(
                label: 'Município',
                selectedCount: scope.municipalityIds.length,
                onTap: () => _pickMunicipality(context, ref, available),
                onClear: () =>
                    _apply(ref, scope.copyWith(municipalityIds: const [])),
              ),
              FilterChipButton(
                label: 'Gerente',
                selectedCount: scope.managerIds.length,
                onTap: () => _pickManager(context, ref, available),
                onClear: () => _clearManager(ref, available),
              ),
              FilterChipButton(
                label: 'Representante',
                selectedCount: scope.repIds.length,
                onTap: () => _pickRep(context, ref, available),
                onClear: () => _apply(ref, scope.copyWith(repIds: const [])),
              ),
              FilterChipButton(
                label: 'Tipo de unidade',
                selectedCount: scope.unitTypeIds.length,
                onTap: () => _pickUnitType(context, ref, available),
                onClear: () =>
                    _apply(ref, scope.copyWith(unitTypeIds: const [])),
              ),
              if (scope.hasFilters)
                TextButton(
                  onPressed: () => _apply(ref, scope.cleared()),
                  child: const Text('Limpar filtros'),
                ),
            ],
          ),
        );
      },
    );
  }

  void _apply(WidgetRef ref, DashboardScopeArgs next) {
    ref.read(dashboardFiltersProvider.notifier).state = next;
  }

  // ── The parent side of the cascade ────────────────────────────────────────
  //
  // Clearing a state has to drop the municipalities inside it, or the screen
  // goes on filtering by a município the user believes they cleared. Same for a
  // manager and their reps.

  void _clearState(WidgetRef ref, DashboardFilterOptions available) {
    final cascaded = cascadeSelection(
      parentIds: const [],
      childIds: scope.municipalityIds,
      children: available.municipalities,
      childChanged: false,
    );
    _apply(
      ref,
      scope.copyWith(stateIds: const [], municipalityIds: cascaded.childIds),
    );
  }

  void _clearManager(WidgetRef ref, DashboardFilterOptions available) {
    final cascaded = cascadeSelection(
      parentIds: const [],
      childIds: scope.repIds,
      children: available.reps,
      childChanged: false,
    );
    _apply(
      ref,
      scope.copyWith(managerIds: const [], repIds: cascaded.childIds),
    );
  }

  Future<void> _pickState(
    BuildContext context,
    WidgetRef ref,
    DashboardFilterOptions available,
  ) async {
    final picked = await FilterDrawer.show(
      context,
      title: 'Estado',
      options: available.states,
      selectedIds: scope.stateIds,
    );
    if (picked == null) return;

    final cascaded = cascadeSelection(
      parentIds: picked,
      childIds: scope.municipalityIds,
      children: available.municipalities,
      childChanged: false,
    );
    _apply(
      ref,
      scope.copyWith(
        stateIds: cascaded.parentIds,
        municipalityIds: cascaded.childIds,
      ),
    );
  }

  Future<void> _pickManager(
    BuildContext context,
    WidgetRef ref,
    DashboardFilterOptions available,
  ) async {
    final picked = await FilterDrawer.show(
      context,
      title: 'Gerente',
      options: available.managers,
      selectedIds: scope.managerIds,
    );
    if (picked == null) return;

    final cascaded = cascadeSelection(
      parentIds: picked,
      childIds: scope.repIds,
      children: available.reps,
      childChanged: false,
    );
    _apply(
      ref,
      scope.copyWith(managerIds: cascaded.parentIds, repIds: cascaded.childIds),
    );
  }

  // ── The child side ───────────────────────────────────────────────────────
  //
  // Picking the city of Rio de Janeiro means the state of Rio de Janeiro is
  // part of the question, so it selects with it — otherwise the two drawers
  // would show contradictory answers to the same question.

  Future<void> _pickMunicipality(
    BuildContext context,
    WidgetRef ref,
    DashboardFilterOptions available,
  ) async {
    final picked = await FilterDrawer.show(
      context,
      title: 'Município',
      options: available.municipalities,
      selectedIds: scope.municipalityIds,
    );
    if (picked == null) return;

    final cascaded = cascadeSelection(
      parentIds: scope.stateIds,
      childIds: picked,
      children: available.municipalities,
      childChanged: true,
    );
    _apply(
      ref,
      scope.copyWith(
        stateIds: cascaded.parentIds,
        municipalityIds: cascaded.childIds,
      ),
    );
  }

  Future<void> _pickRep(
    BuildContext context,
    WidgetRef ref,
    DashboardFilterOptions available,
  ) async {
    final picked = await FilterDrawer.show(
      context,
      title: 'Representante',
      options: available.reps,
      selectedIds: scope.repIds,
    );
    if (picked == null) return;

    final cascaded = cascadeSelection(
      parentIds: scope.managerIds,
      childIds: picked,
      children: available.reps,
      childChanged: true,
    );
    _apply(
      ref,
      scope.copyWith(managerIds: cascaded.parentIds, repIds: cascaded.childIds),
    );
  }

  Future<void> _pickUnitType(
    BuildContext context,
    WidgetRef ref,
    DashboardFilterOptions available,
  ) async {
    final picked = await FilterDrawer.show(
      context,
      title: 'Tipo de unidade',
      options: available.unitTypes,
      selectedIds: scope.unitTypeIds,
    );
    if (picked == null) return;
    // No cascade: unit type is outside the faceting in both directions.
    _apply(ref, scope.copyWith(unitTypeIds: picked));
  }
}
