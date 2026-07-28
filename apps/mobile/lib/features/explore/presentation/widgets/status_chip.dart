import 'package:flutter/material.dart';

/// Small colored pill showing a clinic status label.
///
/// Light surfaces: soft tinted [bg] + [color] text (Explorar lists).
/// Dark / navy surfaces: pass [onNavy] — glass fill + white text; [color]
/// stays on the dot (and a faint border) so contrast stays readable.
class StatusChip extends StatelessWidget {
  final String label;
  final Color color;
  final Color bg;
  final bool small;

  /// Adapt for navy / dark backgrounds (clinic header, immersive chrome).
  final bool onNavy;

  const StatusChip({
    super.key,
    required this.label,
    required this.color,
    required this.bg,
    this.small = false,
    this.onNavy = false,
  });

  @override
  Widget build(BuildContext context) {
    final Color fill;
    final Color fg;
    final Color? border;
    final Color dot;

    if (onNavy) {
      // Match ClinicServiceChips.onNavy chrome; keep status hue on the dot.
      fill = Colors.white.withValues(alpha: 0.12);
      fg = const Color(0xF2FFFFFF);
      border = color.withValues(alpha: 0.55);
      // Lift dark/muted hues so the dot reads on navy (e.g. gray Pré-cadastro).
      dot = _navyDot(color);
    } else {
      fill = bg;
      fg = color;
      border = null;
      dot = color;
    }

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: small ? 8 : 9,
        vertical: small ? 2 : 3,
      ),
      decoration: BoxDecoration(
        color: fill,
        borderRadius: BorderRadius.circular(999),
        border: border == null ? null : Border.all(color: border, width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 5,
            height: 5,
            decoration: BoxDecoration(color: dot, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              fontSize: small ? 10.5 : 11,
              fontWeight: FontWeight.w600,
              color: fg,
              letterSpacing: 0.1,
            ),
          ),
        ],
      ),
    );
  }

  /// Ensure status dots stay visible on navy (avoid near-black gray).
  static Color _navyDot(Color color) {
    final luminance = color.computeLuminance();
    if (luminance >= 0.35) return color;
    // Blend toward white so slate / deep red still pops.
    return Color.lerp(color, Colors.white, 0.45) ?? color;
  }
}
