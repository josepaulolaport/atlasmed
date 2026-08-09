import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/clinical_focus_labels.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Compact clinical focus chips for clinic surfaces (header / body).
class ClinicServiceChips extends StatelessWidget {
  const ClinicServiceChips({
    super.key,
    required this.focuses,
    this.maxVisible = 6,
    this.onNavy = false,
  }) : emptyLabel = null;

  const ClinicServiceChips.empty({super.key, this.onNavy = false})
    : focuses = const [],
      maxVisible = 0,
      emptyLabel = 'Sem foco clínico';

  final List<ClinicalFocus> focuses;
  final int maxVisible;
  final bool onNavy;
  final String? emptyLabel;

  @override
  Widget build(BuildContext context) {
    if (focuses.isEmpty) {
      return Wrap(
        spacing: 6,
        runSpacing: 6,
        children: [
          _Chip(
            label: emptyLabel ?? 'Sem foco clínico',
            onNavy: onNavy,
            muted: true,
          ),
        ],
      );
    }

    final ordered = ClinicalFocusLabels.prioritize(focuses);
    final visible = ordered.take(maxVisible).toList(growable: false);
    final overflow = ordered.length - visible.length;

    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        for (final focus in visible)
          _Chip(
            label: ClinicalFocusLabels.formatName(focus.name),
            onNavy: onNavy,
          ),
        if (overflow > 0) _Chip(label: '+$overflow', onNavy: onNavy),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.onNavy, this.muted = false});

  final String label;
  final bool onNavy;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final Color bg;
    final Color border;
    final Color fg;
    if (muted && onNavy) {
      bg = Colors.white.withValues(alpha: 0.08);
      border = Colors.white.withValues(alpha: 0.16);
      fg = const Color(0xB3FFFFFF);
    } else if (muted) {
      bg = AppColors.gray100;
      border = AppColors.gray200;
      fg = AppColors.gray500;
    } else if (onNavy) {
      bg = Colors.white.withValues(alpha: 0.12);
      border = Colors.white.withValues(alpha: 0.22);
      fg = const Color(0xF2FFFFFF);
    } else {
      bg = AppColors.navyBright.withValues(alpha: 0.08);
      border = AppColors.navyBright.withValues(alpha: 0.18);
      fg = AppColors.navyDeep;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: border),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: fg,
          height: 1.1,
        ),
      ),
    );
  }
}
