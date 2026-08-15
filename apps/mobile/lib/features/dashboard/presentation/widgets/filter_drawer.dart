import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/filter_sheet_footer.dart';
import 'package:flutter/material.dart';

/// A searchable, multi-select drawer for one filter (spec 0014 §5).
///
/// One component for all five filters: they differ only in what they are called
/// and what they offer, and a second implementation would be a second set of
/// selection bugs.
///
/// Selection is committed on close rather than per tap. Every change refetches
/// the whole screen, so applying each tap would fire a request per option while
/// the user is still choosing — and the lists would re-narrow underneath their
/// finger as they picked.
class FilterDrawer extends StatefulWidget {
  const FilterDrawer({
    super.key,
    required this.title,
    required this.options,
    required this.selectedIds,
  });

  final String title;
  final List<FilterOption> options;
  final List<int> selectedIds;

  /// Returns the chosen ids, or null when dismissed without applying.
  static Future<List<int>?> show(
    BuildContext context, {
    required String title,
    required List<FilterOption> options,
    required List<int> selectedIds,
  }) {
    return showModalBottomSheet<List<int>>(
      context: context,
      isScrollControlled: true,
      builder: (context) => FilterDrawer(
        title: title,
        options: options,
        selectedIds: selectedIds,
      ),
    );
  }

  @override
  State<FilterDrawer> createState() => _FilterDrawerState();
}

class _FilterDrawerState extends State<FilterDrawer> {
  late final Set<int> _selected = widget.selectedIds.toSet();
  String _query = '';

  List<FilterOption> get _visible {
    final query = _query.trim().toLowerCase();
    if (query.isEmpty) return widget.options;
    return widget.options
        .where((option) => option.label.toLowerCase().contains(query))
        .toList(growable: false);
  }

  @override
  Widget build(BuildContext context) {
    final visible = _visible;

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: SizedBox(
          height: MediaQuery.of(context).size.height * 0.75,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    widget.title,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: TextField(
                  autofocus: false,
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.search_rounded),
                    hintText: 'Buscar',
                    isDense: true,
                    border: OutlineInputBorder(),
                  ),
                  onChanged: (value) => setState(() => _query = value),
                ),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: visible.isEmpty
                    ? const Center(
                        child: Padding(
                          padding: EdgeInsets.all(24),
                          child: Text(
                            'Nenhuma opção disponível neste recorte.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 14,
                              color: Color(0xFF6b7280),
                            ),
                          ),
                        ),
                      )
                    : ListView.builder(
                        itemCount: visible.length,
                        itemBuilder: (context, index) {
                          final option = visible[index];
                          return CheckboxListTile(
                            dense: true,
                            value: _selected.contains(option.id),
                            title: Text(option.label),
                            onChanged: (checked) => setState(() {
                              if (checked ?? false) {
                                _selected.add(option.id);
                              } else {
                                _selected.remove(option.id);
                              }
                            }),
                          );
                        },
                      ),
              ),
              // Explorar's footer, shared rather than copied — and it is where
              // "Limpar" belongs: next to the button it undoes, instead of a
              // link in the header that appeared on the first tick and pushed
              // every row down by its own height.
              FilterSheetFooter(
                selectedCount: _selected.length,
                onClear: () => setState(_selected.clear),
                // Sorted, because the selection is part of the provider key and
                // that key is order-sensitive: picking Rio then São Paulo would
                // otherwise be a different scope from picking them the other way
                // round, and refetch the whole screen for the same set.
                onApply: () =>
                    Navigator.of(context).pop(_selected.toList()..sort()),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The chip that opens a drawer, showing what is currently chosen.
class FilterChipButton extends StatelessWidget {
  const FilterChipButton({
    super.key,
    required this.label,
    required this.selectedCount,
    required this.onTap,
    this.onClear,
  });

  final String label;
  final int selectedCount;
  final VoidCallback onTap;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: InputChip(
        label: Text(selectedCount == 0 ? label : '$label ($selectedCount)'),
        selected: selectedCount > 0,
        onPressed: onTap,
        onDeleted: selectedCount > 0 ? onClear : null,
        backgroundColor: AppColors.background,
      ),
    );
  }
}
