import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_scope_args.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:atlasmed_mobile_app/repository/repository_flutter.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The filters of spec 0014 §5, applied uniformly to every metric.
///
/// `manager` and `rep` are how a viewer narrows without leaving the screen —
/// the reason nested dashboard segments are unnecessary. `unit_type` reads its
/// options from the catalog endpoint added for item 14; when that catalog is
/// empty the chip is hidden rather than offered with unlabelled ids.
class DashboardFilterBar extends ConsumerWidget {
  const DashboardFilterBar({super.key, required this.scope});

  final DashboardScopeArgs scope;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return RepositoryBuilder(
      repository: ref.watch(unitTypeOptionsProvider),
      builder: (context, unitTypes, repo) {
        final options = unitTypes ?? const <UnitTypeOption>[];
        final selectedUnitType = options
            .where((o) => o.id == scope.unitTypeId)
            .firstOrNull;

        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              if (options.isNotEmpty)
                _FilterChip(
                  label: selectedUnitType?.name ?? 'Tipo de unidade',
                  selected: scope.unitTypeId != null,
                  onTap: () => _pickUnitType(context, ref, options),
                  onClear: scope.unitTypeId == null
                      ? null
                      : () => _update(ref, scope.copyWith(clearUnitType: true)),
                ),
              if (scope.hasFilters) ...[
                const SizedBox(width: 8),
                TextButton(
                  onPressed: () => _update(ref, scope.cleared()),
                  child: const Text('Limpar filtros'),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  void _update(WidgetRef ref, DashboardScopeArgs next) {
    ref.read(dashboardFiltersProvider.notifier).state = next;
  }

  Future<void> _pickUnitType(
    BuildContext context,
    WidgetRef ref,
    List<UnitTypeOption> options,
  ) async {
    final picked = await showModalBottomSheet<UnitTypeOption>(
      context: context,
      builder: (context) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            for (final option in options)
              ListTile(
                title: Text(option.name),
                onTap: () => Navigator.of(context).pop(option),
              ),
          ],
        ),
      ),
    );
    if (picked == null) return;
    _update(ref, scope.copyWith(unitTypeId: picked.id));
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.onClear,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    return InputChip(
      label: Text(label),
      selected: selected,
      onPressed: onTap,
      onDeleted: onClear,
    );
  }
}
