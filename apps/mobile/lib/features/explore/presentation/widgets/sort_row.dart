import 'package:flutter/material.dart';

class SortRow extends StatelessWidget {
  final String sort;
  final VoidCallback onSortTap;
  final List<FilterChipData> filterChips;

  const SortRow({
    super.key,
    required this.sort,
    required this.onSortTap,
    required this.filterChips,
  });

  String _sortLabel(String key) {
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
    if (filterChips.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: _SortChip(label: _sortLabel(sort), onTap: onSortTap),
      );
    }

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          _SortChip(label: _sortLabel(sort), onTap: onSortTap),
          const SizedBox(width: 6),
          ...filterChips.map((chip) => Padding(
                padding: const EdgeInsets.only(right: 6),
                child: _FilterChip(
                  label: chip.label,
                  onRemove: chip.onRemove,
                ),
              )),
        ],
      ),
    );
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
            const Icon(Icons.swap_vert_rounded, size: 12, color: Color(0xFF0f1729)),
            const SizedBox(width: 5),
            Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: Color(0xFF0f1729),
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
