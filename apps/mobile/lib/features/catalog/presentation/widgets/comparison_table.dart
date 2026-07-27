import 'package:flutter/material.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/comparison_row.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_widgets.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/formatting.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Width shared by every ICMS price column — both the sortable header
/// labels and the price boxes below them — so the columns line up.
const double _priceColumnWidth = 58;
const double _priceGroupGap = 6;

/// Combined width of the 3 price columns plus the gaps between them — the
/// update date sits directly under this group, matching its width exactly.
const double _priceGroupWidth = _priceColumnWidth * 3 + _priceGroupGap * 2;

/// Fixed height of a competitor row in [ComparisonSection]'s scrollable
/// list. A uniform row extent is what makes [_RowSnapScrollPhysics] able to
/// snap to row boundaries — comfortably tall enough for the 2-line product
/// name case plus both detail lines, with a little headroom to spare.
const double _competitorRowHeight = 84;

/// Scroll physics that settle the competitor list on a row boundary after
/// every drag or fling — the same "snap" behavior [PageScrollPhysics] gives
/// a [PageView], but keyed to a fixed row height instead of the full
/// viewport, so several rows stay visible at once instead of one page per
/// screen.
class _RowSnapScrollPhysics extends ScrollPhysics {
  const _RowSnapScrollPhysics({required this.itemExtent, super.parent});

  final double itemExtent;

  @override
  _RowSnapScrollPhysics applyTo(ScrollPhysics? ancestor) {
    return _RowSnapScrollPhysics(
      itemExtent: itemExtent,
      parent: buildParent(ancestor),
    );
  }

  double _getPage(ScrollMetrics position) => position.pixels / itemExtent;

  double _getPixels(double page) => page * itemExtent;

  double _getTargetPixels(
    ScrollMetrics position,
    Tolerance tolerance,
    double velocity,
  ) {
    double page = _getPage(position);
    if (velocity < -tolerance.velocity) {
      page -= 0.5;
    } else if (velocity > tolerance.velocity) {
      page += 0.5;
    }
    return _getPixels(page.roundToDouble());
  }

  @override
  Simulation? createBallisticSimulation(
    ScrollMetrics position,
    double velocity,
  ) {
    // Out of range and not headed back in — defer to the parent physics,
    // which puts us back in range (bounce/clamp) at a row boundary.
    if ((velocity <= 0.0 && position.pixels <= position.minScrollExtent) ||
        (velocity >= 0.0 && position.pixels >= position.maxScrollExtent)) {
      return super.createBallisticSimulation(position, velocity);
    }
    final tolerance = toleranceFor(position);
    final target = _getTargetPixels(position, tolerance, velocity);
    if (target != position.pixels) {
      return ScrollSpringSimulation(
        spring,
        position.pixels,
        target,
        velocity,
        tolerance: tolerance,
      );
    }
    return null;
  }

  @override
  bool get allowImplicitScrolling => true;
}

/// The "Comparativo" section for a single AtlasMed product: a fixed block
/// (column headers + our own product, always visible) above a scrollable
/// list of its registered competitor equivalences and a static
/// "+ Adicionar Produto" action. This is scoped to exactly one product —
/// see [PriceIndexTable] for the full, unscoped Brasíndice list.
///
/// Deliberately built with plain [Column]/[ListView] widgets instead of
/// `CustomScrollView` + `SliverPersistentHeader`: the fixed header never
/// needs to scroll, shrink, or float, so keeping it out of the sliver tree
/// avoids a well-known class of `SliverPersistentHeader` semantics-tree
/// assertion crashes.
class ComparisonSection extends StatelessWidget {
  final ComparisonGroup group;
  final ComparisonSortColumn sortColumn;
  final ValueChanged<ComparisonSortColumn> onSortChanged;

  const ComparisonSection({
    super.key,
    required this.group,
    required this.sortColumn,
    required this.onSortChanged,
  });

  @override
  Widget build(BuildContext context) {
    final ownRow = group.rows.firstWhere(
      (row) => row.isOwn,
      orElse: () => group.rows.first,
    );
    final competitorRows = group.rows.where((row) => !row.isOwn).toList();

    return Column(
      children: [
        _OwnProductBar(
          ownRow: ownRow,
          sortColumn: sortColumn,
          onSortChanged: onSortChanged,
        ),
        Expanded(
          child: competitorRows.isEmpty
              ? const _EmptyState(
                  message: 'Nenhum concorrente cadastrado ainda',
                )
              // Every row shares the same [_competitorRowHeight] extent, which
              // is what lets [_RowSnapScrollPhysics] snap cleanly to a row
              // boundary — the list keeps showing several rows at once, it
              // just settles on one instead of stopping mid-row.
              : ListView.builder(
                  physics: const _RowSnapScrollPhysics(
                    itemExtent: _competitorRowHeight,
                  ),
                  padding: EdgeInsets.zero,
                  itemExtent: _competitorRowHeight,
                  itemCount: competitorRows.length,
                  itemBuilder: (context, index) {
                    return Container(
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        border: Border(
                          bottom: BorderSide(color: AppColors.gray100),
                        ),
                      ),
                      child: _ComparisonDataRow(
                        row: competitorRows[index],
                        sortColumn: sortColumn,
                      ),
                    );
                  },
                ),
        ),
        const _AddProductButton(),
      ],
    );
  }
}

/// The complete Tabela Brasíndice/Simpro: a fixed column-header bar above
/// every product in the catalog (AtlasMed's own variants tagged with an
/// "ATLASMED" badge, alongside every competitor), sorted by the active ICMS
/// column. Unlike [ComparisonSection], nothing here is scoped to one
/// product — this is a flat index.
class PriceIndexTable extends StatelessWidget {
  final List<ComparisonRow> rows;
  final ComparisonSortColumn sortColumn;
  final ValueChanged<ComparisonSortColumn> onSortChanged;

  const PriceIndexTable({
    super.key,
    required this.rows,
    required this.sortColumn,
    required this.onSortChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _ColumnHeaderBar(sortColumn: sortColumn, onSortChanged: onSortChanged),
        Expanded(
          child: rows.isEmpty
              ? const _EmptyState(message: 'Nenhum produto encontrado')
              : ListView.builder(
                  physics: const BouncingScrollPhysics(),
                  padding: const EdgeInsets.only(bottom: 8),
                  itemCount: rows.length,
                  itemBuilder: (context, index) {
                    final row = rows[index];
                    return Container(
                      decoration: BoxDecoration(
                        color: row.isOwn
                            ? const AppColors.blue50
                            : Colors.white,
                        border: const Border(
                          bottom: BorderSide(color: AppColors.gray100),
                        ),
                      ),
                      child: _ComparisonDataRow(
                        row: row,
                        sortColumn: sortColumn,
                        showOwnBadge: true,
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

/// Fixed column-header bar — used above the flat Brasíndice list, where
/// there is no single product to keep fixed at the top.
class _ColumnHeaderBar extends StatelessWidget {
  final ComparisonSortColumn sortColumn;
  final ValueChanged<ComparisonSortColumn> onSortChanged;

  const _ColumnHeaderBar({
    required this.sortColumn,
    required this.onSortChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: AppColors.surfaceSecondary)),
        boxShadow: [
          BoxShadow(
            color: Color(0x0F000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: _ColumnHeaderRow(
        sortColumn: sortColumn,
        onSortChanged: onSortChanged,
      ),
    );
  }
}

/// Fixed column-header bar + our own product row, stacked above the
/// scrollable competitor list.
class _OwnProductBar extends StatelessWidget {
  final ComparisonRow ownRow;
  final ComparisonSortColumn sortColumn;
  final ValueChanged<ComparisonSortColumn> onSortChanged;

  const _OwnProductBar({
    required this.ownRow,
    required this.sortColumn,
    required this.onSortChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: AppColors.surfaceSecondary)),
        boxShadow: [
          BoxShadow(
            color: Color(0x0F000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _ColumnHeaderRow(
            sortColumn: sortColumn,
            onSortChanged: onSortChanged,
          ),
          Container(
            color: const AppColors.blue50,
            child: _ComparisonDataRow(row: ownRow, sortColumn: sortColumn),
          ),
        ],
      ),
    );
  }
}

/// Informative column titles: "Produto" on the left, sortable ICMS 17/18/20
/// columns on the right.
class _ColumnHeaderRow extends StatelessWidget {
  final ComparisonSortColumn sortColumn;
  final ValueChanged<ComparisonSortColumn> onSortChanged;

  const _ColumnHeaderRow({
    required this.sortColumn,
    required this.onSortChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 8, 14, 6),
      child: Row(
        children: [
          const Expanded(
            flex: 3,
            child: Text(
              'PRODUTO',
              style: TextStyle(
                fontSize: 9.5,
                fontWeight: FontWeight.w700,
                color: AppColors.gray400,
                letterSpacing: 0.3,
              ),
            ),
          ),
          const Text(
            'ICMS',
            style: TextStyle(fontSize: 9.5, color: AppColors.gray400),
          ),
          const Spacer(),
          _sortableHeader('17%', ComparisonSortColumn.icms17),
          const SizedBox(width: _priceGroupGap),
          _sortableHeader('18%', ComparisonSortColumn.icms18),
          const SizedBox(width: _priceGroupGap),
          _sortableHeader('20%', ComparisonSortColumn.icms20),
        ],
      ),
    );
  }

  Widget _sortableHeader(String label, ComparisonSortColumn column) {
    final active = column == sortColumn;
    return GestureDetector(
      onTap: () => onSortChanged(column),
      child: SizedBox(
        width: _priceColumnWidth,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                color: active
                    ? const AppColors.navyDeep
                    : const AppColors.gray400,
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(left: 2),
              child: Opacity(
                // Always reserve the icon's space so the header's widget
                // tree shape never changes between active/inactive states.
                opacity: active ? 1 : 0,
                child: const Icon(
                  Icons.arrow_downward_rounded,
                  size: 10,
                  color: AppColors.navyDeep,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ComparisonDataRow extends StatelessWidget {
  final ComparisonRow row;
  final ComparisonSortColumn sortColumn;
  final bool showOwnBadge;

  const _ComparisonDataRow({
    required this.row,
    required this.sortColumn,
    this.showOwnBadge = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            flex: 3,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  row.label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: row.isOwn ? FontWeight.w700 : FontWeight.w600,
                    color: const AppColors.gray900,
                    height: 1.15,
                  ),
                ),
                if (showOwnBadge && row.isOwn) ...[
                  const SizedBox(height: 4),
                  _ownBadge(),
                ],
                const SizedBox(height: 4),
                _detailLine('Fabricante', row.manufacturer),
                const SizedBox(height: 2),
                _detailLine('País', row.countryOfOrigin),
              ],
            ),
          ),
          const SizedBox(width: 10),
          // The update date lives inside this column, directly below the
          // price boxes — it is part of the same flow, so it always sits
          // right underneath them (nudging the boxes up slightly to make
          // room) instead of floating independently at odd heights.
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  _priceCell(
                    row.price17,
                    sortColumn == ComparisonSortColumn.icms17,
                  ),
                  const SizedBox(width: _priceGroupGap),
                  _priceCell(
                    row.price18,
                    sortColumn == ComparisonSortColumn.icms18,
                  ),
                  const SizedBox(width: _priceGroupGap),
                  _priceCell(
                    row.price20,
                    sortColumn == ComparisonSortColumn.icms20,
                  ),
                ],
              ),
              const SizedBox(height: 4),
              SizedBox(
                width: _priceGroupWidth,
                child: Text(
                  'Atualizado em: ${formatDate(row.updatedAt)}',
                  textAlign: TextAlign.right,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 9, color: AppColors.gray400),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _ownBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: const AppColors.navyDeep,
        borderRadius: BorderRadius.circular(20),
      ),
      child: const Text(
        'ATLASMED',
        style: TextStyle(
          fontSize: 8.5,
          fontWeight: FontWeight.w700,
          color: Colors.white,
          letterSpacing: 0.2,
        ),
      ),
    );
  }

  /// A small gray label followed by its value, on one line together —
  /// each detail gets its own full-width row instead of competing for
  /// space in a single crowded line, so the value is never truncated.
  Widget _detailLine(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Text(
          '$label: ',
          style: const TextStyle(
            fontSize: 9.5,
            fontWeight: FontWeight.w600,
            color: AppColors.gray400,
          ),
        ),
        Expanded(
          child: Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 9.5,
              fontWeight: FontWeight.w700,
              color: AppColors.navyDeep,
            ),
          ),
        ),
      ],
    );
  }

  Widget _priceCell(double value, bool active) {
    return Container(
      width: _priceColumnWidth,
      padding: const EdgeInsets.symmetric(vertical: 6),
      decoration: BoxDecoration(
        color: active ? const AppColors.blueLight : Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: active ? const Color(0xFFc7d7fb) : const AppColors.gray200,
        ),
      ),
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: Text(
          brlNumber(value),
          maxLines: 1,
          softWrap: false,
          style: TextStyle(
            fontSize: 11,
            fontWeight: active ? FontWeight.w700 : FontWeight.w600,
            color: active ? const AppColors.navyDeep : const AppColors.gray700,
          ),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final String message;
  const _EmptyState({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Center(
        child: Text(
          message,
          style: const TextStyle(fontSize: 11.5, color: AppColors.gray400),
        ),
      ),
    );
  }
}

class _AddProductButton extends StatelessWidget {
  const _AddProductButton();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.surfaceSecondary)),
      ),
      child: InkWell(
        onTap: () => showComingSoonSnack(context, 'Adicionar produto'),
        child: const Padding(
          padding: EdgeInsets.symmetric(vertical: 10),
          child: Center(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.add_rounded, size: 15, color: AppColors.navyBright),
                SizedBox(width: 6),
                Text(
                  'Adicionar Produto',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.navyBright,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
