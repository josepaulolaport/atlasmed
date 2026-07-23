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

/// Editable 1–10 relationship picker (5 stars × 2).
/// Tap the left half of a star for half (odd), right half for full (even).
/// Tap the current level again to clear.
class RelationshipLevelPicker extends StatelessWidget {
  const RelationshipLevelPicker({
    super.key,
    required this.value,
    required this.onChanged,
  });

  final int? value;
  final ValueChanged<int?> onChanged;

  static const _filledColor = Color(0xFFf5a623);
  static const _emptyColor = Color(0xFFcbd5e1);
  static const _starSize = 32.0;

  @override
  Widget build(BuildContext context) {
    final clamped = value?.clamp(1, 10);
    final fullStars = clamped == null ? 0 : clamped ~/ 2;
    final hasHalf = clamped != null && clamped % 2 == 1;

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFe5e7eb)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Seu relacionamento',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0f1729),
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Toque na metade esquerda ou direita da estrela (1–10).',
            style: TextStyle(fontSize: 12, color: Color(0xFF6b7280)),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              ...List.generate(5, (i) {
                final halfLevel = i * 2 + 1;
                final fullLevel = i * 2 + 2;
                IconData icon;
                Color color;
                if (clamped == null) {
                  icon = Icons.star_border_rounded;
                  color = _emptyColor;
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

                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 1),
                  child: SizedBox(
                    width: _starSize,
                    height: _starSize,
                    child: Stack(
                      children: [
                        Icon(icon, size: _starSize, color: color),
                        Row(
                          children: [
                            Expanded(
                              child: GestureDetector(
                                behavior: HitTestBehavior.opaque,
                                onTap: () => _select(clamped, halfLevel),
                              ),
                            ),
                            Expanded(
                              child: GestureDetector(
                                behavior: HitTestBehavior.opaque,
                                onTap: () => _select(clamped, fullLevel),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              }),
              const SizedBox(width: 10),
              Text(
                clamped == null ? 'Não definido' : '$clamped/10',
                style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF6b7280),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _select(int? current, int level) {
    if (current == level) {
      onChanged(null);
    } else {
      onChanged(level);
    }
  }
}
