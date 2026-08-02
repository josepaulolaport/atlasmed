import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/payer_catalog_mock.dart';
import 'package:atlasmed_mobile_app/features/explore/data/payer_display.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/payer_outros_detail_screen.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// "Fontes Pagadoras" — donut + pacote bar + legend (top-5 / Outros bucket).
class ClinicPayersBarSection extends StatelessWidget {
  const ClinicPayersBarSection({
    super.key,
    required this.payers,
    this.summary,
    this.facilityName,
  });

  final List<PayerShare> payers;
  final PayerMixSummary? summary;
  final String? facilityName;

  @override
  Widget build(BuildContext context) {
    if (payers.isEmpty) {
      return ClinicDetailCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 8),
            CircleAvatar(
              radius: 36,
              backgroundColor: AppColors.navyBright.withValues(alpha: 0.12),
              child: Icon(
                Icons.account_balance_wallet_outlined,
                size: 36,
                color: AppColors.navyBright,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Informação pendente',
              style: TextStyle(
                fontSize: 17,
                height: 1.25,
                fontWeight: FontWeight.w600,
                letterSpacing: -0.2,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 4),
            const Text(
              'Toque em Editar para cadastrar as fontes pagadoras '
              'e visualizar a distribuição do faturamento.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                height: 1.4,
                fontWeight: FontWeight.w400,
                color: AppColors.gray500,
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      );
    }

    final slices = buildPayerDisplaySlices(payers);
    final total = slices.fold<double>(0, (sum, s) => sum + s.sharePercent);
    final mix = packageMixPercents(payers);

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
                        slices: slices,
                        total: total,
                        colors: payerShareColors,
                      ),
                    ),
                    const Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '100%',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.gray900,
                          ),
                        ),
                        Text(
                          'faturamento',
                          style: TextStyle(
                            fontSize: 9,
                            color: AppColors.gray400,
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
                          color: AppColors.gray400,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        summary!.principalSourceName,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.gray900,
                        ),
                      ),
                      Text(
                        '${summary!.principalSourcePercent.toStringAsFixed(0)}% do faturamento',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.gray500,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${summary!.registeredSourceCount} fontes cadastradas'
                        '${summary!.updatedAt != null ? ' · atualizado há ${DateTime.now().difference(summary!.updatedAt!).inDays} dias' : ''}',
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.gray400,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          _PackageMixBar(
            packagePercent: mix.packagePercent,
            nonPackagePercent: mix.nonPackagePercent,
          ),
          const SizedBox(height: 16),
          const Divider(height: 1, color: AppColors.gray100),
          const SizedBox(height: 4),
          ...slices.asMap().entries.map(
            (entry) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: _PayerLegendRow(
                slice: entry.value,
                color: payerShareColorForIndex(entry.key),
                onTap: entry.value.isBucket
                    ? () => _openOutros(context, entry.value.members)
                    : null,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _openOutros(BuildContext context, List<PayerShare> members) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => PayerOutrosDetailScreen(
          members: members,
          facilityName: facilityName,
        ),
      ),
    );
  }
}

class _PackageMixBar extends StatelessWidget {
  const _PackageMixBar({
    required this.packagePercent,
    required this.nonPackagePercent,
  });

  final double packagePercent;
  final double nonPackagePercent;

  static const _packageColor = AppColors.navyBright;
  static const _nonPackageColor = Color(
    0xFF9CA3AF,
  ); // gray-400 — visible on white

  @override
  Widget build(BuildContext context) {
    final total = packagePercent + nonPackagePercent;
    final safeTotal = total > 0 ? total : 100.0;
    final packageFraction = (packagePercent / safeTotal).clamp(0.0, 1.0);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Text(
              '${packagePercent.toStringAsFixed(0)}% pacote',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: _packageColor,
              ),
            ),
            const Spacer(),
            Text(
              '${nonPackagePercent.toStringAsFixed(0)}% não é pacote',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.gray500,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: SizedBox(
            height: 14,
            width: double.infinity,
            child: CustomPaint(
              painter: _PackageMixBarPainter(
                packageFraction: packageFraction,
                packageColor: _packageColor,
                nonPackageColor: _nonPackageColor,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _PackageMixBarPainter extends CustomPainter {
  _PackageMixBarPainter({
    required this.packageFraction,
    required this.packageColor,
    required this.nonPackageColor,
  });

  final double packageFraction;
  final Color packageColor;
  final Color nonPackageColor;

  @override
  void paint(Canvas canvas, Size size) {
    final radius = Radius.circular(size.height / 2);
    final full = RRect.fromRectAndRadius(Offset.zero & size, radius);

    // Track
    canvas.drawRRect(full, Paint()..color = nonPackageColor);

    if (packageFraction <= 0) return;

    final packageWidth = size.width * packageFraction;
    final packageRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(
        0,
        0,
        packageWidth.clamp(size.height, size.width),
        size.height,
      ),
      radius,
    );
    canvas.drawRRect(packageRect, Paint()..color = packageColor);
  }

  @override
  bool shouldRepaint(covariant _PackageMixBarPainter oldDelegate) =>
      oldDelegate.packageFraction != packageFraction ||
      oldDelegate.packageColor != packageColor ||
      oldDelegate.nonPackageColor != nonPackageColor;
}

class _DonutPainter extends CustomPainter {
  _DonutPainter({
    required this.slices,
    required this.total,
    required this.colors,
  });

  final List<PayerDisplaySlice> slices;
  final double total;
  final List<Color> colors;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromLTWH(0, 0, size.width, size.height);
    const strokeWidth = 14.0;
    var startAngle = -math.pi / 2;
    final safeTotal = total > 0 ? total : 100;

    for (var i = 0; i < slices.length; i++) {
      final sweep = slices[i].sharePercent / safeTotal * 2 * math.pi;
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
      oldDelegate.slices != slices || oldDelegate.total != total;
}

class _PayerLegendRow extends StatelessWidget {
  const _PayerLegendRow({required this.slice, required this.color, this.onTap});

  final PayerDisplaySlice slice;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final row = Row(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Row(
            children: [
              Flexible(
                child: Text(
                  slice.name,
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.gray900,
                  ),
                ),
              ),
              if (!slice.isBucket && slice.isPackage) ...[
                const SizedBox(width: 6),
                const _LegendBadge(label: 'Pacote'),
              ],
              if (slice.isBucket && slice.hasPackage) ...[
                const SizedBox(width: 6),
                const _LegendBadge(label: 'tem pacote'),
              ],
              if (slice.isBucket) ...[
                const SizedBox(width: 4),
                Icon(
                  Icons.chevron_right_rounded,
                  size: 18,
                  color: AppColors.gray400,
                ),
              ],
            ],
          ),
        ),
        Text(
          '${slice.sharePercent.toStringAsFixed(0)}%',
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: AppColors.gray600,
          ),
        ),
      ],
    );

    if (onTap == null) return row;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: row,
    );
  }
}

class _LegendBadge extends StatelessWidget {
  const _LegendBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.navyBright.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: AppColors.navyBright,
        ),
      ),
    );
  }
}
