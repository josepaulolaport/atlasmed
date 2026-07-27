import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/bottom_sheet.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Compact filter sheet for facility-scoped people lists (Médicos /
/// Profissionais administrativos "Ver todos") — same chrome as Explorar's
/// [FilterSheet], without proximity.
class FacilityRosterFilterSheet extends StatefulWidget {
  const FacilityRosterFilterSheet({
    super.key,
    required this.sections,
    required this.filters,
    required this.onApply,
  });

  /// Section title → chip values (e.g. "Especialidade" → Ortopedia…).
  final Map<String, List<String>> sections;
  final Map<String, List<String>> filters;
  final ValueChanged<Map<String, List<String>>> onApply;

  @override
  State<FacilityRosterFilterSheet> createState() =>
      _FacilityRosterFilterSheetState();
}

class _FacilityRosterFilterSheetState extends State<FacilityRosterFilterSheet> {
  late Map<String, List<String>> _local = {
    for (final e in widget.filters.entries) e.key: List.of(e.value),
  };

  void _toggle(String key, String value) {
    setState(() {
      final list = List<String>.from(_local[key] ?? []);
      if (list.contains(value)) {
        list.remove(value);
      } else {
        list.add(value);
      }
      _local[key] = list;
    });
  }

  int get _count =>
      _local.values.fold<int>(0, (sum, list) => sum + list.length);

  @override
  Widget build(BuildContext context) {
    return BottomSheetWidget(
      title: 'Filtros',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final entry in widget.sections.entries) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 4),
              child: Text(
                entry.key.toUpperCase(),
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1,
                  color: AppColors.gray500,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final value in entry.value)
                    _Chip(
                      label: value,
                      selected: (_local[entry.key] ?? []).contains(value),
                      onTap: () => _toggle(entry.key, value),
                    ),
                ],
              ),
            ),
          ],
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 8),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => setState(() => _local = {}),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(46),
                      foregroundColor: AppColors.gray700,
                      side: const BorderSide(color: AppColors.gray200),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text('Limpar'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: FilledButton(
                    onPressed: () => widget.onApply(_local),
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(46),
                      backgroundColor: AppColors.navyBright,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: Text(_count > 0 ? 'Aplicar ($_count)' : 'Aplicar'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.navyBright : Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected ? AppColors.navyBright : AppColors.gray200,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: selected ? Colors.white : AppColors.gray700,
          ),
        ),
      ),
    );
  }
}
