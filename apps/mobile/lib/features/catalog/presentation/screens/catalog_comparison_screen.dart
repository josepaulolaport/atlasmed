import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/comparison_row.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/providers/catalog_providers.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/manage_competitors_screen.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_widgets.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/comparison_table.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/widgets/order_widgets.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/providers/territories_providers.dart'
    show isAdminProvider;
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

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

  void _openManageCompetitors(String variantLabel) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ManageCompetitorsScreen(
          variantId: widget.variantId,
          variantLabel: variantLabel,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final groupAsync = ref.watch(catalogComparisonProvider(widget.variantId));
    final isAdmin = ref.watch(isAdminProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            _Header(
              onManageCompetitors: !isAdmin
                  ? null
                  : () => _openManageCompetitors(
                      groupAsync.valueOrNull?.variantLabel ?? '',
                    ),
            ),
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
  final VoidCallback? onManageCompetitors;

  const _Header({this.onManageCompetitors});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Row(
        children: [
          const BackChevron(),
          const SizedBox(width: 12),
          const Expanded(
            child: Text(
              'COMPARATIVO DE PREÇOS',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.navyDeep,
                letterSpacing: -0.1,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (onManageCompetitors != null)
            InkWell(
              onTap: onManageCompetitors,
              borderRadius: BorderRadius.circular(8),
              child: const Padding(
                padding: EdgeInsets.all(4),
                child: Icon(
                  Icons.compare_arrows_rounded,
                  size: 20,
                  color: AppColors.navyBright,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
