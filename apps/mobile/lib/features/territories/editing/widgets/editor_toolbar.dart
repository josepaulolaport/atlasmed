import 'package:atlasmed_mobile_app/features/territories/editing/models/editor_mode.dart';
import 'package:flutter/material.dart';

/// Persistent, fixed-position tool switcher + undo/redo. Never tracks the
/// map — it's app chrome, not a map annotation.
class EditorToolbar extends StatelessWidget {
  final EditorMode mode;
  final bool canUndo;
  final bool canRedo;
  final ValueChanged<EditorMode> onModeChanged;
  final VoidCallback onUndo;
  final VoidCallback onRedo;

  const EditorToolbar({
    super.key,
    required this.mode,
    required this.canUndo,
    required this.canRedo,
    required this.onModeChanged,
    required this.onUndo,
    required this.onRedo,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(6),
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
          _ModeButton(
            icon: Icons.open_with_rounded,
            label: 'Navegar',
            selected: mode == EditorMode.navigate,
            onTap: () => onModeChanged(EditorMode.navigate),
          ),
          const SizedBox(width: 4),
          _ModeButton(
            icon: Icons.touch_app_outlined,
            label: 'Selecionar',
            selected: mode == EditorMode.select,
            onTap: () => onModeChanged(EditorMode.select),
          ),
          const SizedBox(width: 4),
          _ModeButton(
            icon: Icons.edit_outlined,
            label: 'Desenhar',
            selected: mode == EditorMode.drawArea,
            onTap: () => onModeChanged(EditorMode.drawArea),
          ),
          Container(
            width: 1,
            height: 26,
            margin: const EdgeInsets.symmetric(horizontal: 6),
            color: const Color(0xFFE5E7EB),
          ),
          _IconButton(
            icon: Icons.undo_rounded,
            enabled: canUndo,
            onTap: onUndo,
          ),
          _IconButton(
            icon: Icons.redo_rounded,
            enabled: canRedo,
            onTap: onRedo,
          ),
        ],
      ),
    );
  }
}

class _ModeButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _ModeButton({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
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
              Icon(
                icon,
                size: 18,
                color: selected
                    ? const Color(0xFF0A2F7F)
                    : const Color(0xFF6B7280),
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected
                      ? const Color(0xFF0A2F7F)
                      : const Color(0xFF6B7280),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _IconButton extends StatelessWidget {
  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;

  const _IconButton({
    required this.icon,
    required this.enabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: enabled ? onTap : null,
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Icon(
          icon,
          size: 19,
          color: enabled ? const Color(0xFF374151) : const Color(0xFFD1D5DB),
        ),
      ),
    );
  }
}
