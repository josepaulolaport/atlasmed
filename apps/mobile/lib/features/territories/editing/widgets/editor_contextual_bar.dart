import 'package:atlasmed_mobile_app/features/territories/editing/models/editor_mode.dart';
import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Shown once a polygon part is selected — offers what the user can do
/// with that part. "Excluir" (delete this part) only ever renders when
/// [canDelete] is true: a valid, single-polygon territory has exactly one
/// part, and deleting the only part isn't a meaningful action, so the
/// button would otherwise sit permanently disabled. It only actually shows
/// up while cleaning up a legacy territory that still has more than one
/// disconnected part.
class EditorContextualBar extends StatelessWidget {
  final SelectionAction action;
  final bool canDelete;
  final VoidCallback onEditBoundary;
  final VoidCallback onMoveArea;
  final VoidCallback onDeleteArea;

  const EditorContextualBar({
    super.key,
    required this.action,
    required this.canDelete,
    required this.onEditBoundary,
    required this.onMoveArea,
    required this.onDeleteArea,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
            color: Color(0x3A111827),
            blurRadius: 18,
            offset: Offset(0, 6),
          ),
        ],
      ),
      // `Wrap` instead of `Row`: keeps the three chips on one centered
      // line normally, but lets them fall onto a second line instead of
      // overflowing on narrow screens or larger accessibility text sizes.
      child: Wrap(
        alignment: WrapAlignment.center,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 4,
        runSpacing: 4,
        children: [
          _ActionChip(
            icon: Icons.gesture_rounded,
            label: 'Editar',
            selected: action == SelectionAction.boundary,
            onTap: onEditBoundary,
          ),
          _ActionChip(
            icon: Icons.open_with_rounded,
            label: 'Mover',
            selected: action == SelectionAction.move,
            onTap: onMoveArea,
          ),
          if (canDelete)
            _ActionChip(
              icon: Icons.delete_outline_rounded,
              label: 'Excluir',
              selected: false,
              color: AppColors.error,
              onTap: onDeleteArea,
            ),
        ],
      ),
    );
  }
}

class _ActionChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final Color? color;
  final VoidCallback? onTap;

  const _ActionChip({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    final tint = !enabled
        ? AppColors.gray300
        : (color ??
              (selected ? AppColors.navyDeep : AppColors.gray700));
    return Material(
      color: selected ? AppColors.blue50 : Colors.transparent,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 17, color: tint),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: tint,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
