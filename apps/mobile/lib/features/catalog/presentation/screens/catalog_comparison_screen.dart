import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/comparison_row.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/providers/catalog_providers.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_widgets.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/comparison_table.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/widgets/order_widgets.dart';

/// "Comparativo" screen — scoped to exactly one AtlasMed product: shows that
/// variant (pinned) plus its registered competitor equivalences, searchable
/// by name. For the complete, unscoped price list see
/// [CatalogPriceIndexScreen].
class CatalogComparisonScreen extends ConsumerStatefulWidget {
  final String variantId;
  const CatalogComparisonScreen({super.key, required this.variantId});

  @override
  ConsumerState<CatalogComparisonScreen> createState() =>
      _CatalogComparisonScreenState();
}

class _CatalogComparisonScreenState
    extends ConsumerState<CatalogComparisonScreen> {
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

  /// Re-sorts by the active column and filters competitors by [_query].
  /// The own product row is never filtered out — it is the fixed reference
  /// point of the table.
  ComparisonGroup _prepared(ComparisonGroup group) {
    final query = _query.trim().toLowerCase();
    final rows = [...group.rows]
      ..sort((a, b) => _priceFor(b).compareTo(_priceFor(a)));
    final filtered = query.isEmpty
        ? rows
        : rows
              .where(
                (row) => row.isOwn || row.label.toLowerCase().contains(query),
              )
              .toList();
    return ComparisonGroup(
      variantId: group.variantId,
      variantLabel: group.variantLabel,
      rows: filtered,
    );
  }

  @override
  Widget build(BuildContext context) {
    final groupAsync = ref.watch(catalogComparisonProvider(widget.variantId));

    return Scaffold(
      backgroundColor: const Color(0xFFf7f8fb),
      body: SafeArea(
        child: Column(
          children: [
            const _Header(),
            CatalogSearchBar(
              controller: _searchController,
              onChanged: _onSearchChanged,
              hintText: 'Buscar produto concorrente…',
              onFilter: () => showSortFilterSheet(
                context,
                current: _sortColumn,
                onSelect: _onSortChanged,
              ),
            ),
            Expanded(
              child: groupAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, _) => CatalogErrorState(
                  onRetry: () => ref.invalidate(
                    catalogComparisonProvider(widget.variantId),
                  ),
                ),
                data: (group) {
                  final prepared = _prepared(group);
                  return ComparisonSection(
                    group: prepared,
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

class _Header extends StatelessWidget {
  const _Header();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Row(
        children: [
          BackChevron(),
          SizedBox(width: 12),
          Expanded(
            child: Text(
              'COMPARATIVO DE PREÇOS',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0a2f7f),
                letterSpacing: -0.1,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}
