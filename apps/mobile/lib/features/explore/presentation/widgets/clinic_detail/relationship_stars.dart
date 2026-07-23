import 'package:flutter/material.dart';

/// "Relacionamento" star rating (1–10 → 5 stars, 2 points each).
///
/// When [onChanged] is set, taps adjust the score (tap star N → 2N, or
/// toggle half-step). A `null` score means not assessed yet.
class RelationshipStars extends StatelessWidget {
  const RelationshipStars({
    super.key,
    required this.score,
    this.onChanged,
    this.showLabel = true,
  });

  final int? score;
  final ValueChanged<int?>? onChanged;
  final bool showLabel;

  static const _filledColor = Color(0xFFf5a623);
  static const _emptyColor = Color(0xFFcbd5e1);
  static const _undeterminedColor = Color(0xFFcbd5e1);

  bool get _editable => onChanged != null;

  @override
  Widget build(BuildContext context) {
    final clamped = score?.clamp(0, 10);
    final fullStars = clamped == null ? 0 : clamped ~/ 2;
    final hasHalf = clamped != null && clamped % 2 == 1;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (showLabel) ...[
          const Text(
            'Relacionamento:',
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: Color(0xFF6b7280),
            ),
          ),
          const SizedBox(width: 6),
        ],
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

          final star = Icon(icon, size: _editable ? 22 : 14.5, color: color);
          if (!_editable) return star;

          return InkWell(
            onTap: () => _handleTap(i),
            onLongPress: () => onChanged!(null),
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 1),
              child: star,
            ),
          );
        }),
      ],
    );
  }

  void _handleTap(int starIndex) {
    final onChanged = this.onChanged;
    if (onChanged == null) return;

    final fullLevel = (starIndex + 1) * 2;
    final halfLevel = fullLevel - 1;
    final current = score;

    if (current == fullLevel) {
      onChanged(halfLevel);
    } else if (current == halfLevel) {
      onChanged(null);
    } else {
      onChanged(fullLevel);
    }
  }
}
