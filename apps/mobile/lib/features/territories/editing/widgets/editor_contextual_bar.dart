import 'package:atlasmed_mobile_app/features/territories/editing/models/editor_mode.dart';
import 'package:flutter/material.dart';

/// Shown once a polygon part is selected — offers the four choices the
/// user can make about that part. Also fixed chrome, not map-tracked.
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
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _ActionChip(
            icon: Icons.gesture_rounded,
            label: 'Editar contorno',
            selected: action == SelectionAction.boundary,
            onTap: onEditBoundary,
          ),
          const SizedBox(width: 4),
          _ActionChip(
            icon: Icons.open_with_rounded,
            label: 'Mover área',
            selected: action == SelectionAction.move,
            onTap: onMoveArea,
          ),
          const SizedBox(width: 4),
          _ActionChip(
            icon: Icons.delete_outline_rounded,
            label: 'Excluir área',
            selected: false,
            color: const Color(0xFFDC2626),
            onTap: canDelete ? onDeleteArea : null,
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
        ? const Color(0xFFD1D5DB)
        : (color ?? (selected ? const Color(0xFF0A2F7F) : const Color(0xFF374151)));
    return Material(
      color: selected ? const Color(0xFFEEF2FF) : Colors.transparent,
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
