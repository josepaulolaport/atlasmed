import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

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
      padding: const EdgeInsets.fromLTRB(20, 20, 16, 8),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final titleContent = Row(
            children: [
              Flexible(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 17,
                    height: 1.2,
                    fontWeight: FontWeight.w700,
                    color: AppColors.gray900,
                    letterSpacing: -0.2,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (badge != null) const SizedBox(width: 8),
              ?badge,
            ],
          );
          final shouldStack =
              trailing != null &&
              (constraints.maxWidth < 300 ||
                  (constraints.maxWidth < 360 &&
                      MediaQuery.textScalerOf(context).scale(1) > 1));

          if (shouldStack) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 40),
                  child: titleContent,
                ),
                Align(alignment: Alignment.centerRight, child: trailing),
              ],
            );
          }

          return ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 40),
            child: Row(
              children: [
                Expanded(child: titleContent),
                if (trailing != null) const SizedBox(width: 8),
                ?trailing,
              ],
            ),
          );
        },
      ),
    );
  }
}
