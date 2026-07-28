import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';

/// Compact "Linha" chips for nearby-clinic cards (commercial vertical).
class NearbyVerticalBadges extends StatelessWidget {
  const NearbyVerticalBadges({
    super.key,
    required this.verticals,
    this.maxVisible = 2,
  });

  final List<NearbyVerticalBadge> verticals;
  final int maxVisible;

  @override
  Widget build(BuildContext context) {
    if (verticals.isEmpty) return const SizedBox.shrink();

    final shown = verticals.take(maxVisible).toList(growable: false);
    final overflow = verticals.length - shown.length;

    return Wrap(
      spacing: 4,
      runSpacing: 4,
      children: [
        for (final v in shown) _Badge(label: 'Linha · ${_shortName(v.name)}'),
        if (overflow > 0) _Badge(label: '+$overflow'),
      ],
    );
  }

  static String _shortName(String name) {
    final trimmed = name.trim();
    if (trimmed.length <= 14) return trimmed;
    return '${trimmed.substring(0, 13)}…';
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.navyBright.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: AppColors.navyBright.withValues(alpha: 0.2)),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 9.5,
          fontWeight: FontWeight.w600,
          color: AppColors.navyDeep,
          height: 1.1,
        ),
      ),
    );
  }
}
