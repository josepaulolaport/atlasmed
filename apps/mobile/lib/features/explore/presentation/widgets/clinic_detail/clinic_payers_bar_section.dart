import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/payer_catalog_mock.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';

/// "Fontes Pagadoras" — donut chart with a "principal fonte" callout and a
/// legend list, replacing the previous stacked bar.
class ClinicPayersBarSection extends StatelessWidget {
  const ClinicPayersBarSection({
    super.key,
    required this.payers,
    this.summary,
    this.onEdit,
  });

  final List<PayerShare> payers;
  final PayerMixSummary? summary;

  /// Opens the Fontes Pagadoras editor when the roster is empty.
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) {
    if (payers.isEmpty) {
      return ClinicDetailCard(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
          child: Column(
            children: [
              const Text(
                'Nenhuma fonte pagadora cadastrada',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: Color(0xFF9ca3af)),
              ),
              if (onEdit != null) ...[
                const SizedBox(height: 12),
                TextButton.icon(
                  onPressed: onEdit,
                  icon: const Icon(Icons.edit_outlined, size: 18),
                  label: const Text('Cadastrar fontes'),
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFF1e40af),
                  ),
                ),
              ],
            ],
          ),
        ),
      );
    }

    final total = payers.fold<double>(0, (sum, p) => sum + p.sharePercent);

    return ClinicDetailCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              SizedBox(
                width: 96,
                height: 96,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    CustomPaint(
                      size: const Size(96, 96),
                      painter: _DonutPainter(
                        payers: payers,
                        total: total,
                        colors: payerShareColors,
                      ),
                    ),
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: const [
                        Text(
                          '100%',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0f1729),
                          ),
                        ),
                        Text(
                          'faturamento',
                          style: TextStyle(
                            fontSize: 9,
                            color: Color(0xFF9ca3af),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              if (summary != null)
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'PRINCIPAL FONTE',
                        style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.3,
                          color: Color(0xFF9ca3af),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        summary!.principalSourceName,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0f1729),
                        ),
                      ),
                      Text(
                        '${summary!.principalSourcePercent.toStringAsFixed(0)}% do faturamento',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF6b7280),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${summary!.registeredSourceCount} fontes cadastradas'
                        '${summary!.updatedAt != null ? ' · atualizado há ${DateTime.now().difference(summary!.updatedAt!).inDays} dias' : ''}',
                        style: const TextStyle(
                          fontSize: 11,
                          color: Color(0xFF9ca3af),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 20),
          const Divider(height: 1, color: Color(0xFFf3f4f6)),
          const SizedBox(height: 4),
          ...payers.asMap().entries.map(
            (entry) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: _PayerLegendRow(
                payer: entry.value,
                color: payerShareColorForIndex(entry.key),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DonutPainter extends CustomPainter {
  _DonutPainter({
    required this.payers,
    required this.total,
    required this.colors,
  });

  final List<PayerShare> payers;
  final double total;
  final List<Color> colors;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromLTWH(0, 0, size.width, size.height);
    const strokeWidth = 14.0;
    var startAngle = -math.pi / 2;
    final safeTotal = total > 0 ? total : 100;

    for (var i = 0; i < payers.length; i++) {
      final sweep = payers[i].sharePercent / safeTotal * 2 * math.pi;
      final paint = Paint()
        ..color = colors[i % colors.length]
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
  bool shouldRepaint(covariant _DonutPainter oldDelegate) =>
      oldDelegate.payers != payers || oldDelegate.total != total;
}

class _PayerLegendRow extends StatelessWidget {
  const _PayerLegendRow({required this.payer, required this.color});

  final PayerShare payer;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            payer.name,
            style: const TextStyle(fontSize: 13, color: Color(0xFF0f1729)),
          ),
        ),
        Text(
          '${payer.sharePercent.toStringAsFixed(0)}%',
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: Color(0xFF4b5563),
          ),
        ),
      ],
    );
  }
}
