import 'package:flutter/material.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_variant.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/formatting.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Card shown on the family detail screen for a single variant: name +
/// presentation up top, thumbnail and price side by side, then a dedicated
/// full-width panel for the SIMPRO / BRASÍNDICE / TISS codes so none of
/// them ever get cramped or truncated.
class VariantInfoCard extends StatelessWidget {
  final CatalogVariant variant;
  final VoidCallback? onViewComparison;

  /// Admin-only actions — `null` hides the corresponding entry point
  /// entirely, so this card looks identical to a regular rep whether or
  /// not these are wired up. Callers gate these with `isAdminProvider`.
  final VoidCallback? onEdit;
  final VoidCallback? onManageCompetitors;

  /// Whether this card draws its own bordered/shadowed surface. Set to
  /// `false` when nesting it inside a parent that already provides the
  /// card chrome (e.g. an expanded family accordion) — avoids a
  /// "box-within-a-box" look.
  final bool bordered;

  const VariantInfoCard({
    super.key,
    required this.variant,
    this.onViewComparison,
    this.onEdit,
    this.onManageCompetitors,
    this.bordered = true,
  });

  @override
  Widget build(BuildContext context) {
    final column = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    variant.name,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.navyDeep,
                      letterSpacing: -0.1,
                    ),
                  ),
                  if (variant.presentation.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      variant.presentation,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.gray400,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (onEdit != null)
              InkWell(
                onTap: onEdit,
                borderRadius: BorderRadius.circular(8),
                child: const Padding(
                  padding: EdgeInsets.all(4),
                  child: Icon(
                    Icons.edit_outlined,
                    size: 18,
                    color: AppColors.gray400,
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 14),
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.surfaceSecondary),
              ),
              child: const Icon(
                Icons.medication_liquid_outlined,
                size: 26,
                color: AppColors.gray300,
              ),
            ),
            const Spacer(),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                const Text(
                  'VALOR',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: AppColors.gray400,
                    letterSpacing: 0.4,
                  ),
                ),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.blueLight,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    brl(variant.price),
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.navyDeep,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 14),
        _CodesPanel(variant: variant),
        if (onViewComparison != null || onManageCompetitors != null) ...[
          const SizedBox(height: 12),
          const Divider(height: 1, thickness: 1, color: AppColors.surfaceSecondary),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Wrap(
              alignment: WrapAlignment.end,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 16,
              runSpacing: 6,
              children: [
                if (onManageCompetitors != null)
                  _CardLink(
                    label: 'Gerenciar concorrentes',
                    icon: Icons.compare_arrows_rounded,
                    onTap: onManageCompetitors!,
                  ),
                if (onViewComparison != null)
                  _CardLink(
                    label: 'Ver comparativo de preços',
                    icon: Icons.chevron_right_rounded,
                    onTap: onViewComparison!,
                  ),
              ],
            ),
          ),
        ],
      ],
    );

    final content = Padding(padding: const EdgeInsets.all(16), child: column);

    if (!bordered) return content;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.surfaceSecondary),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: content,
    );
  }
}

/// Small text+icon action used for both the "Ver comparativo" and
/// admin-only "Gerenciar concorrentes" links at the bottom of the card.
class _CardLink extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onTap;

  const _CardLink({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Row(
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.navyBright,
            ),
          ),
          const SizedBox(width: 2),
          Icon(icon, size: 16, color: AppColors.navyBright),
        ],
      ),
    );
  }
}

/// Full-width panel listing SIMPRO / BRASÍNDICE / TISS as label/value rows
/// separated by hairline dividers — each row gets the whole card's width,
/// so codes are always fully legible, never truncated.
class _CodesPanel extends StatelessWidget {
  final CatalogVariant variant;
  const _CodesPanel({required this.variant});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.surfaceSecondary),
      ),
      child: Column(
        children: [
          _codeRow('SIMPRO', variant.simproCode),
          _rowDivider(),
          _codeRow('BRASÍNDICE', variant.brasindiceCode),
          _rowDivider(),
          _codeRow('TISS', variant.tissCode),
        ],
      ),
    );
  }

  Widget _rowDivider() =>
      const Divider(height: 1, thickness: 1, color: AppColors.surfaceSecondary);

  Widget _codeRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.gray500,
              letterSpacing: 0.4,
            ),
          ),
          const Spacer(),
          Text(
            value,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppColors.gray900,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }
}
