import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';

/// One thing the "+" can do.
class AgendaAction {
  const AgendaAction({
    required this.label,
    required this.icon,
    required this.onTap,
    this.emphasis = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;

  /// Drawn filled rather than outlined. Reserved for the roteiro: it is the
  /// one action that decides a rep's whole day rather than adding a single row
  /// to it, and it should not read as a third kind of event.
  final bool emphasis;
}

/// The agenda's "+", expanded into labelled actions.
///
/// A plain FAB that jumps straight to the event form makes roteirização
/// unreachable from the screen where a rep plans their day — which is the only
/// screen they would look for it on. Labels are always visible rather than
/// icon-only: three options where one is unfamiliar is exactly the case
/// icon-only menus fail.
class AgendaSpeedDial extends StatefulWidget {
  const AgendaSpeedDial({super.key, required this.actions});

  final List<AgendaAction> actions;

  @override
  State<AgendaSpeedDial> createState() => _AgendaSpeedDialState();
}

class _AgendaSpeedDialState extends State<AgendaSpeedDial>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 180),
  );
  bool _open = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _toggle() {
    setState(() => _open = !_open);
    if (_open) {
      _controller.forward();
    } else {
      _controller.reverse();
    }
  }

  void _run(VoidCallback action) {
    _toggle();
    action();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        for (final action in widget.actions.reversed)
          _ActionPill(
            action: action,
            controller: _controller,
            onTap: () => _run(action.onTap),
          ),
        const SizedBox(height: 4),
        FloatingActionButton(
          onPressed: _toggle,
          backgroundColor: _open ? AppColors.blueLight : AppColors.navyBright,
          foregroundColor: _open ? AppColors.navyDeep : Colors.white,
          elevation: 2,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          // Semantics matter more than the glyph here: a rotating "+" reads as
          // a close button to sighted users and as nothing at all otherwise.
          tooltip: _open ? 'Fechar' : 'Adicionar',
          child: AnimatedRotation(
            turns: _open ? 0.125 : 0,
            duration: const Duration(milliseconds: 180),
            child: const Icon(Icons.add, size: 28),
          ),
        ),
      ],
    );
  }
}

class _ActionPill extends StatelessWidget {
  const _ActionPill({
    required this.action,
    required this.controller,
    required this.onTap,
  });

  final AgendaAction action;
  final AnimationController controller;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final filled = action.emphasis;
    return FadeTransition(
      opacity: controller,
      child: SizeTransition(
        sizeFactor: controller,
        alignment: Alignment.bottomRight,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Material(
            color: filled ? AppColors.navyBright : AppColors.cardBg,
            elevation: 2,
            borderRadius: BorderRadius.circular(24),
            child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(24),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 18,
                  vertical: 12,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      action.icon,
                      size: 18,
                      color: filled ? Colors.white : AppColors.navyBright,
                    ),
                    const SizedBox(width: 10),
                    Text(
                      action.label,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: filled ? Colors.white : AppColors.gray900,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
