import 'package:atlasmed_mobile_app/features/territories/data/models/business_vertical.dart';
import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Horizontal row of business-vertical chips, labeled as "Linha comercial".
class VerticalSelector extends StatelessWidget {
  final List<BusinessVertical> verticals;
  final String? selectedVerticalId;
  final ValueChanged<String?> onChanged;

  /// When true, prepends a "Todas as linhas" chip that clears selection (union).
  final bool allowAll;

  /// Section legend above the chips. Pass empty to hide.
  final String label;

  const VerticalSelector({
    super.key,
    required this.verticals,
    required this.selectedVerticalId,
    required this.onChanged,
    this.allowAll = false,
    this.label = 'Linha comercial',
  });

  @override
  Widget build(BuildContext context) {
    if (verticals.isEmpty) return const SizedBox.shrink();

    final itemCount = verticals.length + (allowAll ? 1 : 0);
    final chips = SizedBox(
      height: 34,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: itemCount,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          if (allowAll && index == 0) {
            final selected = selectedVerticalId == null;
            return _Chip(
              label: 'Todas as linhas',
              selected: selected,
              onTap: () => onChanged(null),
            );
          }
          final vertical = verticals[allowAll ? index - 1 : index];
          final selected = vertical.id == selectedVerticalId;
          return _Chip(
            label: vertical.name,
            selected: selected,
            onTap: () => onChanged(vertical.id),
          );
        },
      ),
    );

    if (label.isEmpty) return chips;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w600,
            color: AppColors.gray500,
            letterSpacing: 0.2,
          ),
        ),
        const SizedBox(height: 6),
        chips,
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? AppColors.navyDeep : Colors.white,
          border: Border.all(
            color: selected ? AppColors.navyDeep : AppColors.gray200,
          ),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : AppColors.gray700,
          ),
        ),
      ),
    );
  }
}
