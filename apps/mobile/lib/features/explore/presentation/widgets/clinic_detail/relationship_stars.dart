import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// "Relacionamento" star rating (1–10 → 5 stars, 2 points each).
///
/// When [onChanged] is set, each star is split into left/right hit zones
/// (half vs full) sized for finger taps. Long-press clears the score.
/// A `null` score means not assessed yet.
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

  static const _filledColor = AppColors.amber;
  static const _emptyColor = AppColors.gray300;
  static const _undeterminedColor = AppColors.gray300;

  /// Icon size when editable — large enough to see half-fill.
  static const _editableIconSize = 34.0;

  /// Per-star touch width (~48dp Material minimum, split into two halves).
  static const _editableStarWidth = 48.0;
  static const _editableStarHeight = 48.0;

  static const _readonlyIconSize = 14.5;

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
          Text(
            'Relacionamento:',
            style: TextStyle(
              fontSize: _editable ? 13 : 11.5,
              fontWeight: FontWeight.w600,
              color: AppColors.gray500,
            ),
          ),
          SizedBox(width: _editable ? 10 : 6),
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

          final star = Icon(
            icon,
            size: _editable ? _editableIconSize : _readonlyIconSize,
            color: color,
          );

          if (!_editable) return star;

          final halfLevel = (i + 1) * 2 - 1;
          final fullLevel = (i + 1) * 2;

          return SizedBox(
            width: _editableStarWidth,
            height: _editableStarHeight,
            child: Stack(
              alignment: Alignment.center,
              children: [
                IgnorePointer(child: star),
                Row(
                  children: [
                    Expanded(
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: () => onChanged!(halfLevel),
                          onLongPress: () => onChanged!(null),
                          borderRadius: const BorderRadius.horizontal(
                            left: Radius.circular(10),
                          ),
                          child: const SizedBox.expand(),
                        ),
                      ),
                    ),
                    Expanded(
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: () => onChanged!(fullLevel),
                          onLongPress: () => onChanged!(null),
                          borderRadius: const BorderRadius.horizontal(
                            right: Radius.circular(10),
                          ),
                          child: const SizedBox.expand(),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          );
        }),
      ],
    );
  }
}
