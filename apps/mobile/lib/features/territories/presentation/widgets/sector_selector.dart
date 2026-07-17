import 'package:atlasmed_mobile_app/features/territories/data/models/sector.dart';
import 'package:flutter/material.dart';

/// Horizontal row of sector chips ("Oncologia", "Cardiologia", ...).
class SectorSelector extends StatelessWidget {
  final List<Sector> sectors;
  final String? selectedSectorId;
  final ValueChanged<String> onChanged;

  const SectorSelector({
    super.key,
    required this.sectors,
    required this.selectedSectorId,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    if (sectors.isEmpty) return const SizedBox.shrink();

    return SizedBox(
      height: 34,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: sectors.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final sector = sectors[index];
          final selected = sector.id == selectedSectorId;
          return GestureDetector(
            onTap: () => onChanged(sector.id),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              padding: const EdgeInsets.symmetric(horizontal: 14),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: selected ? const Color(0xFF0a2f7f) : Colors.white,
                border: Border.all(
                  color: selected
                      ? const Color(0xFF0a2f7f)
                      : const Color(0xFFe1e4ea),
                ),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                sector.name,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: selected ? Colors.white : const Color(0xFF374151),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
