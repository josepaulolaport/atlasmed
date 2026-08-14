import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class SortRow extends StatelessWidget {
  final String sort;
  final VoidCallback onSortTap;
  final List<FilterChipData> filterChips;

  /// When false, only filter chips are shown (sort lives elsewhere).
  final bool includeSort;

  const SortRow({
    super.key,
    required this.sort,
    required this.onSortTap,
    required this.filterChips,
    this.includeSort = true,
  });

  /// Short label for a sort key — one or two words.
  ///
  /// The direction is an arrow, not words. "Status de compras — inverso" was
  /// 27 characters in a chip that sits beside the Clínicas/Médicos tabs, and it
  /// overlapped them; every descending option carried the same "— inverso"
  /// suffix, so the longest labels were the ones a rep switches to most.
  ///
  /// Must cover every key [SortSheet] offers. It used to handle four and fall
  /// through to returning the key itself, so the chip read
  /// "purchase-funnel-desc" to reps. `sort_row_labels_test.dart` walks the
  /// sheet's real option list, so a new option without a label here fails
  /// rather than ships.
  static String labelFor(String key) {
    switch (key) {
      case 'name-asc':
      case 'name-desc':
        return 'Nome';
      case 'distance':
        return 'Distância';
      case 'purchase-funnel-asc':
      case 'purchase-funnel-desc':
        return 'Status';
      case 'purchase-interval-asc':
      case 'purchase-interval-desc':
        return 'Intervalo';
      case 'last-purchase-desc':
      case 'last-purchase-asc':
        return 'Última compra';
      case 'oldest-visit':
        return 'Sem visita';
      case 'last-contact':
        return 'Sem contato';
      default:
        return key;
    }
  }

  /// Which way the current sort runs.
  ///
  /// Ascending is the arrow up: A→Z, nearest first, oldest date first. So
  /// "Última compra ↓" is most recent first and "Nome ↑" is A–Z.
  ///
  /// Options with no opposite in the sheet — distance, and the two "há mais
  /// tempo" sorts — still get an arrow, because they still have a direction and
  /// a bare "Distância" would not say which end it starts from.
  static SortChipDirection directionFor(String key) {
    switch (key) {
      case 'name-desc':
      case 'purchase-funnel-desc':
      case 'purchase-interval-desc':
      case 'last-purchase-desc':
        return SortChipDirection.descending;
      default:
        return SortChipDirection.ascending;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!includeSort && filterChips.isEmpty) {
      return const SizedBox.shrink();
    }

    return SizedBox(
      height: 36,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        children: [
          if (includeSort) ...[
            Center(
              child: _SortChip(sort: sort, onTap: onSortTap),
            ),
            if (filterChips.isNotEmpty) const SizedBox(width: 6),
          ],
          for (final chip in filterChips)
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: Center(
                child: _FilterChip(label: chip.label, onRemove: chip.onRemove),
              ),
            ),
        ],
      ),
    );
  }
}

/// Sort control chip — used in the Explorar tab bar.
class ExploreSortChip extends StatelessWidget {
  final String sort;
  final VoidCallback onTap;

  const ExploreSortChip({super.key, required this.sort, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return _SortChip(sort: sort, onTap: onTap);
  }
}

/// Which end an ordering starts from.
enum SortChipDirection { ascending, descending }

class _SortChip extends StatelessWidget {
  final String sort;
  final VoidCallback onTap;

  const _SortChip({required this.sort, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final ascending = SortRow.directionFor(sort) == SortChipDirection.ascending;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: AppColors.gray200),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Replaces the generic swap glyph, which looked the same for every
            // sort and so said nothing about the current one.
            Icon(
              ascending
                  ? Icons.arrow_upward_rounded
                  : Icons.arrow_downward_rounded,
              size: 12,
              color: AppColors.gray900,
            ),
            const SizedBox(width: 5),
            Text(
              SortRow.labelFor(sort),
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: AppColors.gray900,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final VoidCallback onRemove;

  const _FilterChip({required this.label, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onRemove,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: AppColors.blue50,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: AppColors.blueLight),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: AppColors.blueDarker,
              ),
            ),
            const SizedBox(width: 5),
            const Icon(
              Icons.close_rounded,
              size: 9,
              color: AppColors.blueDarker,
            ),
          ],
        ),
      ),
    );
  }
}

class FilterChipData {
  final String label;
  final VoidCallback onRemove;

  FilterChipData({required this.label, required this.onRemove});
}
