import 'dart:math' as math;

import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_summary.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_bucket.dart';
import 'package:flutter/material.dart';

class PurchaseStatusDonutCard extends StatelessWidget {
  const PurchaseStatusDonutCard({
    super.key,
    required this.data,
    this.onBucketTap,
  });

  final DashboardPurchaseStatus data;

  /// Opens dedicated clinics list for this purchase-status bucket.
  final ValueChanged<String>? onBucketTap;

  static const _activeColor = Color(0xFF16a373);
  static const _inactiveColor = Color(0xFFc6861b);
  static const _neverColor = Color(0xFFdc2626);

  @override
  Widget build(BuildContext context) {
    final slices = [
      _Slice(
        PurchaseBucketFilter.label(PurchaseBucketFilter.active),
        PurchaseBucketFilter.active,
        data.active,
        _activeColor,
      ),
      _Slice(
        PurchaseBucketFilter.label(PurchaseBucketFilter.inactive),
        PurchaseBucketFilter.inactive,
        data.inactive,
        _inactiveColor,
      ),
      _Slice(
        PurchaseBucketFilter.label(PurchaseBucketFilter.neverBought),
        PurchaseBucketFilter.neverBought,
        data.neverBought,
        _neverColor,
      ),
    ].where((s) => s.count > 0 || data.total == 0).toList();

    // Always show all three legend rows even when zero.
    final legend = [
      _Slice(
        PurchaseBucketFilter.label(PurchaseBucketFilter.active),
        PurchaseBucketFilter.active,
        data.active,
        _activeColor,
      ),
      _Slice(
        PurchaseBucketFilter.label(PurchaseBucketFilter.inactive),
        PurchaseBucketFilter.inactive,
        data.inactive,
        _inactiveColor,
      ),
      _Slice(
        PurchaseBucketFilter.label(PurchaseBucketFilter.neverBought),
        PurchaseBucketFilter.neverBought,
        data.neverBought,
        _neverColor,
      ),
    ];

    final paintSlices = data.total == 0
        ? [
            _Slice(
              PurchaseBucketFilter.label(PurchaseBucketFilter.neverBought),
              PurchaseBucketFilter.neverBought,
              1,
              _neverColor,
            ),
          ]
        : slices;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFeef0f3)),
      ),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Text(
                'STATUS DE COMPRAS',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.4,
                  color: Color(0xFF9ca3af),
                ),
              ),
              const Spacer(),
              Text(
                '${data.total} no total',
                style: const TextStyle(fontSize: 12, color: Color(0xFF9ca3af)),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Center(
            child: SizedBox(
              width: 168,
              height: 168,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  CustomPaint(
                    size: const Size(168, 168),
                    painter: _ThickDonutPainter(slices: paintSlices),
                  ),
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '${data.total}',
                        style: const TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0f1729),
                          height: 1,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'clínicas',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF9ca3af),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          for (final slice in legend) ...[
            const Divider(height: 1, color: Color(0xFFf3f4f6)),
            _LegendRow(
              slice: slice,
              total: data.total,
              onTap: onBucketTap == null
                  ? null
                  : () => onBucketTap!(slice.bucket),
            ),
          ],
        ],
      ),
    );
  }
}

class _Slice {
  const _Slice(this.label, this.bucket, this.count, this.color);
  final String label;
  final String bucket;
  final int count;
  final Color color;
}

class _LegendRow extends StatelessWidget {
  const _LegendRow({required this.slice, required this.total, this.onTap});

  final _Slice slice;
  final int total;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final pct = total > 0 ? ((slice.count / total) * 100).round() : 0;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          children: [
            Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                color: slice.color,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                slice.label,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF0f1729),
                ),
              ),
            ),
            Text(
              '${slice.count}',
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0f1729),
              ),
            ),
            const SizedBox(width: 10),
            SizedBox(
              width: 36,
              child: Text(
                '$pct%',
                textAlign: TextAlign.right,
                style: const TextStyle(fontSize: 13, color: Color(0xFF9ca3af)),
              ),
            ),
            if (onTap != null) ...[
              const SizedBox(width: 4),
              const Icon(
                Icons.chevron_right_rounded,
                size: 20,
                color: Color(0xFF9ca3af),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ThickDonutPainter extends CustomPainter {
  _ThickDonutPainter({required this.slices});

  final List<_Slice> slices;

  @override
  void paint(Canvas canvas, Size size) {
    final total = slices.fold<int>(0, (sum, s) => sum + s.count);
    if (total <= 0) return;

    const strokeWidth = 28.0;
    final rect = Offset.zero & size;
    var startAngle = -math.pi / 2;

    for (final slice in slices) {
      final sweep = slice.count / total * 2 * math.pi;
      final paint = Paint()
        ..color = slice.color
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.butt;
      canvas.drawArc(
        rect.deflate(strokeWidth / 2),
        startAngle,
        sweep,
        false,
        paint,
      );
      startAngle += sweep;
    }
  }

  @override
  bool shouldRepaint(covariant _ThickDonutPainter oldDelegate) =>
      oldDelegate.slices != slices;
}
