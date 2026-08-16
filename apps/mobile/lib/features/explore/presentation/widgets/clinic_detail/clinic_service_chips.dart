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
    this.onEdit,
  }) : emptyLabel = null;

  const ClinicServiceChips.empty({super.key, this.onNavy = false, this.onEdit})
    : focuses = const [],
      maxVisible = 0,
      emptyLabel = 'Sem foco clínico';

  final List<ClinicalFocus> focuses;
  final int maxVisible;
  final bool onNavy;
  final String? emptyLabel;

  /// Opens the focus editor. Null where the row is a read-only summary — the
  /// Explorar card, for one, where a pencil would be a target the size of the
  /// chip beside it.
  final VoidCallback? onEdit;

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
          if (onEdit != null) _EditChip(onNavy: onNavy, onTap: onEdit!),
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
        if (onEdit != null) _EditChip(onNavy: onNavy, onTap: onEdit!),
      ],
    );
  }
}

/// The affordance that opens the editor, shaped as a chip so it sits in the row
/// rather than as a pencil floating beside the heading — the chips are the
/// thing being edited, and a control detached from them reads as editing the
/// clinic.
class _EditChip extends StatelessWidget {
  const _EditChip({required this.onNavy, required this.onTap});

  final bool onNavy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final fg = onNavy ? Colors.white : AppColors.navyBright;
    return Material(
      color: onNavy ? Colors.white.withValues(alpha: 0.12) : AppColors.gray100,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        key: const Key('clinic-focus-edit'),
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.add_rounded, size: 14, color: fg),
              const SizedBox(width: 4),
              Text(
                'Editar',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: fg,
                ),
              ),
            ],
          ),
        ),
      ),
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
