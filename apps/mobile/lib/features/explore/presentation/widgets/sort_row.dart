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

  static String labelFor(String key) {
    switch (key) {
      case 'name-asc':
        return 'Nome A–Z';
      case 'distance':
        return 'Mais próximos';
      case 'oldest-visit':
        return 'Sem visita há mais tempo';
      case 'last-contact':
        return 'Sem contato há mais tempo';
      default:
        return key;
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
              child: _SortChip(label: labelFor(sort), onTap: onSortTap),
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
    return _SortChip(label: SortRow.labelFor(sort), onTap: onTap);
  }
}

class _SortChip extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const _SortChip({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: const Color(0xFFe5e7eb)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.swap_vert_rounded,
              size: 12,
              color: AppColors.gray900,
            ),
            const SizedBox(width: 5),
            Text(
              label,
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
          color: const Color(0xFFeef2ff),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: const Color(0xFFc7d2fe)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: Color(0xFF1e3a8a),
              ),
            ),
            const SizedBox(width: 5),
            const Icon(Icons.close_rounded, size: 9, color: Color(0xFF1e3a8a)),
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
