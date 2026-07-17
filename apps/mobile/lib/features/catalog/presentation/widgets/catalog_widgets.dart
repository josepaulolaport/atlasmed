import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_family.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/comparison_row.dart';

String formatDate(DateTime date) {
  final d = date.day.toString().padLeft(2, '0');
  final m = date.month.toString().padLeft(2, '0');
  return '$d/$m/${date.year}';
}

void showComingSoonSnack(BuildContext context, String feature) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text('$feature — em breve'),
      behavior: SnackBarBehavior.floating,
    ),
  );
}

/// A friendly icon-in-circle status view for catalog error states —
/// consistent with the rest of the app's hubs (e.g. Explorar's empty state)
/// instead of a bare spinner + text button.
class CatalogErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const CatalogErrorState({
    super.key,
    required this.onRetry,
    this.message = 'Não foi possível carregar',
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                color: Color(0xFFf3f4f6),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.wifi_off_rounded,
                size: 26,
                color: Color(0xFF9ca3af),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
                color: Color(0xFF374151),
              ),
            ),
            const SizedBox(height: 14),
            TextButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, size: 16),
              label: const Text('Tentar novamente'),
              style: TextButton.styleFrom(
                foregroundColor: const Color(0xFF1e40af),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Search box used above the catalog list / comparativo / Brasíndice tables
/// to filter rows by product name, paired with a separate filter button —
/// same recipe as Explorar's `SearchBarWidget` (44px pill, subtle border +
/// shadow, dedicated square filter button with a badge when a filter is
/// active) so every search bar in the app reads the same way.
class CatalogSearchBar extends StatelessWidget {
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final VoidCallback onFilter;
  final int filterCount;
  final String hintText;

  const CatalogSearchBar({
    super.key,
    required this.controller,
    required this.onChanged,
    required this.onFilter,
    this.filterCount = 0,
    this.hintText = 'Buscar produto…',
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Row(
        children: [
          Expanded(
            child: Container(
              height: 44,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFe5e7eb)),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x0A000000),
                    blurRadius: 2,
                    offset: Offset(0, 1),
                  ),
                ],
              ),
              child: Row(
                children: [
                  const SizedBox(width: 12),
                  const Icon(
                    Icons.search_rounded,
                    size: 16,
                    color: Color(0xFF6b7280),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: controller,
                      onChanged: onChanged,
                      textInputAction: TextInputAction.search,
                      style: const TextStyle(
                        fontSize: 14,
                        color: Color(0xFF0f1729),
                      ),
                      decoration: InputDecoration(
                        hintText: hintText,
                        hintStyle: const TextStyle(color: Color(0xFF9ca3af)),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                  if (controller.text.isNotEmpty)
                    GestureDetector(
                      onTap: () {
                        controller.clear();
                        onChanged('');
                      },
                      child: Container(
                        width: 20,
                        height: 20,
                        margin: const EdgeInsets.only(right: 8),
                        decoration: const BoxDecoration(
                          color: Color(0xFFe5e7eb),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.close_rounded,
                          size: 10,
                          color: Color(0xFF6b7280),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: onFilter,
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: filterCount > 0 ? const Color(0xFF1e40af) : Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFe5e7eb)),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x0A000000),
                    blurRadius: 2,
                    offset: Offset(0, 1),
                  ),
                ],
              ),
              child: Stack(
                children: [
                  Center(
                    child: Icon(
                      Icons.tune_rounded,
                      size: 18,
                      color: filterCount > 0
                          ? Colors.white
                          : const Color(0xFF1e40af),
                    ),
                  ),
                  if (filterCount > 0)
                    Positioned(
                      top: 4,
                      right: 4,
                      child: Container(
                        constraints: const BoxConstraints(minWidth: 16),
                        height: 16,
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        decoration: const BoxDecoration(
                          color: Color(0xFFe11d48),
                          shape: BoxShape.circle,
                        ),
                        child: Center(
                          child: Text(
                            '$filterCount',
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Opens the family picker sheet for the flat product list's filter
/// button — "Todos" plus one option per family, radio-style.
Future<void> showFamilyFilterSheet(
  BuildContext context, {
  required List<CatalogFamily> families,
  required String? selectedId,
  required ValueChanged<String?> onSelect,
}) {
  return showModalBottomSheet(
    context: context,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) => _FilterSheetShell(
      title: 'FILTRAR POR FAMÍLIA',
      children: [
        _FilterOptionRow(
          label: 'Todos',
          selected: selectedId == null,
          onTap: () {
            onSelect(null);
            Navigator.pop(sheetContext);
          },
        ),
        for (final family in families)
          _FilterOptionRow(
            label: family.name,
            selected: selectedId == family.id,
            onTap: () {
              onSelect(family.id);
              Navigator.pop(sheetContext);
            },
          ),
      ],
    ),
  );
}

/// Opens the sort-column picker sheet for the comparativo / Brasíndice
/// tables' filter button — a second entry point to the same sort already
/// available by tapping a column header directly.
Future<void> showSortFilterSheet(
  BuildContext context, {
  required ComparisonSortColumn current,
  required ValueChanged<ComparisonSortColumn> onSelect,
}) {
  const labels = {
    ComparisonSortColumn.icms17: 'ICMS 17%',
    ComparisonSortColumn.icms18: 'ICMS 18%',
    ComparisonSortColumn.icms20: 'ICMS 20%',
  };
  return showModalBottomSheet(
    context: context,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) => _FilterSheetShell(
      title: 'ORDENAR POR',
      children: [
        for (final column in ComparisonSortColumn.values)
          _FilterOptionRow(
            label: labels[column]!,
            selected: current == column,
            onTap: () {
              onSelect(column);
              Navigator.pop(sheetContext);
            },
          ),
      ],
    ),
  );
}

/// Shared chrome for the catalog's filter sheets: drag handle, small caps
/// title, and whatever option rows the caller supplies.
class _FilterSheetShell extends StatelessWidget {
  final String title;
  final List<Widget> children;

  const _FilterSheetShell({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 10, bottom: 4),
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFe5e7eb),
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 4),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF9ca3af),
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ),
            ...children,
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

class _FilterOptionRow extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _FilterOptionRow({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                    color: selected
                        ? const Color(0xFF0a2f7f)
                        : const Color(0xFF374151),
                  ),
                ),
              ),
              if (selected)
                const Icon(
                  Icons.check_rounded,
                  size: 18,
                  color: Color(0xFF0a2f7f),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Which peer view of the Catálogo section is active — used by
/// [CatalogTabBar] so switching between them feels like flipping a tab
/// instead of drilling into a nested screen.
enum CatalogTab { produtos, tabelaCompleta }

/// Segmented control pinned below [AtlasTopBar] on every top-level catalog
/// screen (the flat product list and the full Brasíndice/Simpro table).
/// Selecting a segment replaces the current route with [context.go], so
/// flipping back and forth never piles up the back stack — it behaves like
/// a tab, not a pushed detail screen.
class CatalogTabBar extends StatelessWidget {
  final CatalogTab active;
  const CatalogTabBar({super.key, required this.active});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
      child: Container(
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          color: const Color(0xFFeef0f3),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Expanded(
              child: _segment(
                label: 'Produtos',
                selected: active == CatalogTab.produtos,
                onTap: () => context.go('/catalogo'),
              ),
            ),
            Expanded(
              child: _segment(
                label: 'Tabela Completa',
                selected: active == CatalogTab.tabelaCompleta,
                onTap: () => context.go('/catalogo/brasindice'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _segment({
    required String label,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return Material(
      color: selected ? Colors.white : Colors.transparent,
      borderRadius: BorderRadius.circular(9),
      elevation: selected ? 1 : 0,
      shadowColor: Colors.black.withValues(alpha: 0.08),
      child: InkWell(
        onTap: selected ? null : onTap,
        borderRadius: BorderRadius.circular(9),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 9),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: selected
                    ? const Color(0xFF0a2f7f)
                    : const Color(0xFF6b7280),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
