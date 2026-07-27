import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/data/nao_conformidade_models.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Prominent field + before/after summary used on suggestion cards.
class SuggestionChangeSummary extends StatelessWidget {
  const SuggestionChangeSummary({
    super.key,
    required this.suggestion,
    this.compact = false,
  });

  final NaoConformidadeSuggestion suggestion;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final isDeactivation = suggestion.kind == NaoConformidadeKind.deactivation;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: isDeactivation
                    ? const AppColors.red50
                    : const AppColors.blueLight,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: isDeactivation
                      ? const AppColors.red100
                      : const AppColors.blueLight,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    isDeactivation
                        ? Icons.power_settings_new_rounded
                        : Icons.label_outline_rounded,
                    size: 12,
                    color: isDeactivation
                        ? const AppColors.error
                        : const AppColors.navyBright,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    isDeactivation
                        ? 'Desativação'
                        : 'Campo: ${suggestion.fieldLabel}',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: isDeactivation
                          ? const AppColors.error
                          : const AppColors.navyBright,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        SizedBox(height: compact ? 6 : 8),
        if (isDeactivation) ...[
          Text(
            'Campo: ${suggestion.fieldLabel}',
            style: TextStyle(
              fontSize: compact ? 11.5 : 12,
              fontWeight: FontWeight.w600,
              color: const AppColors.gray500,
            ),
          ),
          const SizedBox(height: 3),
          _ValueLine(
            label: 'Atual',
            value: suggestion.currentValue,
            muted: true,
            strike: true,
            compact: compact,
          ),
          const SizedBox(height: 3),
          _ValueLine(
            label: 'Solicitado',
            value: suggestion.suggestedValue,
            muted: false,
            strike: false,
            compact: compact,
            emphasizeColor: const AppColors.error,
          ),
        ] else ...[
          _ValueLine(
            label: 'Atual',
            value: suggestion.currentValue,
            muted: true,
            strike: true,
            compact: compact,
          ),
          const SizedBox(height: 3),
          _ValueLine(
            label: 'Sugerido',
            value: suggestion.suggestedValue,
            muted: false,
            strike: false,
            compact: compact,
          ),
        ],
      ],
    );
  }
}

class _ValueLine extends StatelessWidget {
  const _ValueLine({
    required this.label,
    required this.value,
    required this.muted,
    required this.strike,
    required this.compact,
    this.emphasizeColor,
  });

  final String label;
  final String value;
  final bool muted;
  final bool strike;
  final bool compact;
  final Color? emphasizeColor;

  @override
  Widget build(BuildContext context) {
    return RichText(
      maxLines: compact ? 2 : 3,
      overflow: TextOverflow.ellipsis,
      text: TextSpan(
        children: [
          TextSpan(
            text: '$label: ',
            style: TextStyle(
              fontSize: compact ? 11.5 : 12,
              fontWeight: FontWeight.w600,
              color: const AppColors.gray400,
            ),
          ),
          TextSpan(
            text: value,
            style: TextStyle(
              fontSize: compact ? 12 : 13,
              fontWeight: muted ? FontWeight.w500 : FontWeight.w700,
              color: muted
                  ? const AppColors.gray500
                  : (emphasizeColor ?? const AppColors.green600),
              decoration: strike ? TextDecoration.lineThrough : null,
              decorationColor: const AppColors.error,
            ),
          ),
        ],
      ),
    );
  }
}
