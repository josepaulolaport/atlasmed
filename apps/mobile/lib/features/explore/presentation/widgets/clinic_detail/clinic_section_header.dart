import 'package:flutter/material.dart';

class ClinicSectionHeader extends StatelessWidget {
  const ClinicSectionHeader({
    super.key,
    required this.title,
    this.badge,
    this.trailing,
  });

  final String title;

  /// Small inline badge rendered right next to [title] (e.g. an item count).
  final Widget? badge;

  /// Right-aligned action, e.g. "Editar" or "Ver todos".
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 12),
      child: Row(
        children: [
          // A single `Expanded` claims all the leftover space on its own —
          // sharing flex between the title and a trailing `Spacer` caused
          // the title to only ever grab half of it, leaving `trailing`
          // stranded away from the right edge instead of flush against it.
          Expanded(
            child: Row(
              children: [
                Flexible(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0f1729),
                      letterSpacing: -0.3,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (badge != null) const SizedBox(width: 8),
                ?badge,
              ],
            ),
          ),
          if (trailing != null) const SizedBox(width: 8),
          ?trailing,
        ],
      ),
    );
  }
}
