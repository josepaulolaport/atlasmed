import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/comparison_row.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/providers/catalog_providers.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_widgets.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/comparison_table.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/subscreen_app_bar.dart';

/// "Tabela Brasíndice/Simpro" screen — the complete price index: every
/// AtlasMed product and every competitor product in the catalog, flattened
/// into a single searchable, sortable list. Unlike [CatalogComparisonScreen],
/// this is not scoped to any one product.
///
/// Rep-facing, not administrative (`read CATALOG`, which REP and MANAGER both
/// hold). It is a peer tab of the product list at `/products`, in the same
/// shell branch — so the drawer is available on both. Before spec 0016 §3.4 it
/// sat at `/catalog/price-index`, whose only way in was the tab bar on an admin
/// screen nothing linked to.
class CatalogPriceIndexScreen extends ConsumerStatefulWidget {
  const CatalogPriceIndexScreen({super.key});

  @override
  ConsumerState<CatalogPriceIndexScreen> createState() =>
      _CatalogPriceIndexScreenState();
}

class _CatalogPriceIndexScreenState
    extends ConsumerState<CatalogPriceIndexScreen> {
  ComparisonSortColumn _sortColumn = ComparisonSortColumn.icms20;
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _onSortChanged(ComparisonSortColumn column) {
    setState(() => _sortColumn = column);
  }

  void _onSearchChanged(String value) {
    setState(() => _query = value);
  }

  double _priceFor(ComparisonRow row) {
    switch (_sortColumn) {
      case ComparisonSortColumn.icms17:
        return row.price17;
      case ComparisonSortColumn.icms18:
        return row.price18;
      case ComparisonSortColumn.icms20:
        return row.price20;
    }
  }

  List<ComparisonRow> _prepared(List<ComparisonRow> rows) {
    final query = _query.trim().toLowerCase();
    final filtered = query.isEmpty
        ? rows
        : rows.where((row) => row.label.toLowerCase().contains(query)).toList();
    return [...filtered]..sort((a, b) => _priceFor(b).compareTo(_priceFor(a)));
  }

  @override
  Widget build(BuildContext context) {
    final indexAsync = ref.watch(catalogPriceIndexProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const SubscreenAppBar(title: 'Tabela completa'),
      body: SafeArea(
        child: Column(
          children: [
            const CatalogTabBar(active: CatalogTab.tabelaCompleta),
            CatalogSearchBar(
              controller: _searchController,
              onChanged: _onSearchChanged,
              hintText: 'Buscar produto…',
              onFilter: () => showSortFilterSheet(
                context,
                current: _sortColumn,
                onSelect: _onSortChanged,
              ),
            ),
            Expanded(
              child: indexAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, _) => CatalogErrorState(
                  onRetry: () => ref.invalidate(catalogPriceIndexProvider),
                ),
                data: (rows) {
                  final prepared = _prepared(rows);
                  return PriceIndexTable(
                    rows: prepared,
                    sortColumn: _sortColumn,
                    onSortChanged: _onSortChanged,
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
