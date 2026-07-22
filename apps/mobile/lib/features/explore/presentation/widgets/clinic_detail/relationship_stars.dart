import 'package:flutter/material.dart';

/// "Relacionamento" star rating for Médicos.
///
/// [score] is the authenticated user's level from
/// `user_professional_relationships` (1–10 → 5 stars, 2 points each).
/// A `null` score means not assessed yet — faint outline stars.
class RelationshipStars extends StatelessWidget {
  const RelationshipStars({super.key, required this.score});

  final int? score;

  static const _filledColor = Color(0xFFf5a623);
  static const _emptyColor = Color(0xFFcbd5e1);
  static const _undeterminedColor = Color(0xFFcbd5e1);

  @override
  Widget build(BuildContext context) {
    final clamped = score?.clamp(0, 10);
    final fullStars = clamped == null ? 0 : clamped ~/ 2;
    final hasHalf = clamped != null && clamped % 2 == 1;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text(
          'Relacionamento:',
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w600,
            color: Color(0xFF6b7280),
          ),
        ),
        const SizedBox(width: 6),
        ...List.generate(5, (i) {
          IconData icon;
          Color color;
          if (clamped == null) {
            icon = Icons.star_border_rounded;
            color = _undeterminedColor.withValues(alpha: 0.45);
          } else if (i < fullStars) {
            icon = Icons.star_rounded;
            color = _filledColor;
          } else if (i == fullStars && hasHalf) {
            icon = Icons.star_half_rounded;
            color = _filledColor;
          } else {
            icon = Icons.star_border_rounded;
            color = _emptyColor;
          }
          return Icon(icon, size: 14.5, color: color);
        }),
      ],
    );
  }
}
