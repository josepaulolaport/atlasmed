import 'package:flutter/material.dart';

import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// The row every list in the Administração panel is made of.
///
/// A white card, 14px corners, a hairline border, 8px apart — the shape the
/// product and competitor lists already used and that Explorar and Equipe use
/// throughout. The support catalogues and the requirement list were `ListTile`s
/// separated by `Divider`s instead: Material's default list, in a panel where
/// nothing else is one.
///
/// [trailing] sits before the chevron, for a row that carries a value (a price)
/// or its own action. The chevron is drawn whenever the row is tappable —
/// including on inactive rows, where the support catalogues used to swap it for
/// the "Inativo" badge and left exactly the rows an admin most wants to
/// reactivate looking untappable.
class CatalogListRow extends StatelessWidget {
  const CatalogListRow({
    super.key,
    required this.title,
    this.onTap,
    this.subtitle,
    this.leading,
    this.trailing,
    this.isActive = true,
    this.warning,
    this.note,
  });

  final String title;
  final String? subtitle;
  final Widget? leading;
  final Widget? trailing;
  final bool isActive;

  /// A line under the subtitle, in the error colour — "Sem produto
  /// equivalente", "Sem métrica". A list that hides the one row that needs
  /// attention until you open it is not a list anyone can work from.
  final String? warning;

  /// An informational line under the subtitle, in the accent colour — "Pede
  /// validade e frente e verso". Distinct from [warning], which is red because
  /// it means something is missing.
  final String? note;

  /// Null makes the row inert and drops the chevron with it — a row that looks
  /// tappable and is not is worse than one that looks flat.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.surfaceSecondary),
          ),
          child: Row(
            children: [
              if (leading != null) ...[leading!, const SizedBox(width: 12)],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w700,
                              color: isActive
                                  ? AppColors.gray900
                                  : AppColors.gray400,
                              letterSpacing: -0.1,
                            ),
                          ),
                        ),
                        if (!isActive) ...[
                          const SizedBox(width: 6),
                          const InactiveBadge(),
                        ],
                      ],
                    ),
                    if (subtitle != null && subtitle!.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: AppColors.gray400,
                        ),
                      ),
                    ],
                    if (note != null) ...[
                      const SizedBox(height: 3),
                      Text(
                        note!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppColors.navyDeep,
                        ),
                      ),
                    ],
                    if (warning != null) ...[
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          const Icon(
                            Icons.link_off_rounded,
                            size: 12,
                            color: AppColors.error,
                          ),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(
                              warning!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: AppColors.error,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              if (trailing != null) ...[const SizedBox(width: 8), trailing!],
              if (onTap != null) ...[
                const SizedBox(width: 2),
                const Icon(
                  Icons.chevron_right_rounded,
                  size: 18,
                  color: AppColors.gray400,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// The "Inativo" pill. One widget so the panel's six lists cannot disagree on
/// its wording, casing or colour — they previously ran "Inativa"/"Inativo" at
/// two different weights.
class InactiveBadge extends StatelessWidget {
  const InactiveBadge({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.surfaceSecondary,
        borderRadius: BorderRadius.circular(6),
      ),
      child: const Text(
        'Inativo',
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: AppColors.gray700,
        ),
      ),
    );
  }
}

/// The icon tile at the head of a row that has no picture of its own.
class CatalogRowIcon extends StatelessWidget {
  const CatalogRowIcon({super.key, required this.icon, this.tinted = false});

  final IconData icon;

  /// Blue for our own things, neutral gray for other people's.
  final bool tinted;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: tinted ? AppColors.blue50 : AppColors.surfaceSecondary,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Icon(
        icon,
        size: 20,
        color: tinted ? AppColors.navyDeep : AppColors.gray700,
      ),
    );
  }
}
