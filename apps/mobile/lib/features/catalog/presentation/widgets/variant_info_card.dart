import 'package:flutter/material.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_variant.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/formatting.dart';

/// Card shown on the family detail screen for a single variant: name +
/// presentation up top, thumbnail and price side by side, then a dedicated
/// full-width panel for the SIMPRO / BRASÍNDICE / TISS codes so none of
/// them ever get cramped or truncated.
class VariantInfoCard extends StatelessWidget {
  final CatalogVariant variant;
  final VoidCallback? onViewComparison;

  /// Whether this card draws its own bordered/shadowed surface. Set to
  /// `false` when nesting it inside a parent that already provides the
  /// card chrome (e.g. an expanded family accordion) — avoids a
  /// "box-within-a-box" look.
  final bool bordered;

  const VariantInfoCard({
    super.key,
    required this.variant,
    this.onViewComparison,
    this.bordered = true,
  });

  @override
  Widget build(BuildContext context) {
    final column = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          variant.name,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: Color(0xFF0a2f7f),
            letterSpacing: -0.1,
          ),
        ),
        if (variant.presentation.isNotEmpty) ...[
          const SizedBox(height: 2),
          Text(
            variant.presentation,
            style: const TextStyle(fontSize: 12, color: Color(0xFF9ca3af)),
          ),
        ],
        const SizedBox(height: 14),
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: const Color(0xFFf7f8fb),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFeef0f3)),
              ),
              child: const Icon(
                Icons.medication_liquid_outlined,
                size: 26,
                color: Color(0xFFc8cdd5),
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
                    color: Color(0xFF9ca3af),
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
                    color: const Color(0xFFeef4ff),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    brl(variant.price),
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0a2f7f),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 14),
        _CodesPanel(variant: variant),
        if (onViewComparison != null) ...[
          const SizedBox(height: 12),
          const Divider(height: 1, thickness: 1, color: Color(0xFFeef0f3)),
          InkWell(
            onTap: onViewComparison,
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text(
                    'Ver comparativo de preços',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF1e40af),
                    ),
                  ),
                  const SizedBox(width: 2),
                  const Icon(
                    Icons.chevron_right_rounded,
                    size: 16,
                    color: Color(0xFF1e40af),
                  ),
                ],
              ),
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
        border: Border.all(color: const Color(0xFFeef0f3)),
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
        color: const Color(0xFFf7f8fb),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFeef0f3)),
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
      const Divider(height: 1, thickness: 1, color: Color(0xFFeef0f3));

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
              color: Color(0xFF6b7280),
              letterSpacing: 0.4,
            ),
          ),
          const Spacer(),
          Text(
            value,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0f1729),
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }
}
