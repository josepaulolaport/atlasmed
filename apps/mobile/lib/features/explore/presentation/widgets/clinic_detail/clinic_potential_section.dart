import 'dart:math' as math;

import 'package:atlasmed_mobile_app/features/explore/data/models/facility_potential.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_potential_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/competitor_quantity_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_linha_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_potential_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_section_header.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/shared/clinica_empty_section.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Potencial de mercado — our quantity, each competitor's, the total market
/// and our share of it, per Linha (spec 0013).
class ClinicPotentialSection extends ConsumerWidget {
  const ClinicPotentialSection({
    super.key,
    required this.facilityId,
    required this.canEdit,
  });

  final int facilityId;
  final bool canEdit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final verticalId = ref.watch(clinicDetailActiveLinhaIdProvider(facilityId));
    final async = ref.watch(clinicDetailPotentialsProvider(facilityId));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // The rep's editing surface is rebuilt in P4-5 as a competitor picker
        // (spec 0013 §6). The old "Editar potencial" sheet wrote
        // facility_potential_values, which no longer exists.
        const ClinicSectionHeader(title: 'Potencial de mercado'),
        if (verticalId == null)
          const ClinicDetailCard(
            child: Text(
              'Selecione uma linha comercial para ver o potencial.',
              style: TextStyle(
                fontSize: 14,
                height: 1.4,
                color: AppColors.gray500,
              ),
            ),
          )
        else
          async.when(
            loading: () => const ClinicDetailCard(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Center(
                  child: SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
              ),
            ),
            error: (err, _) => ClinicDetailCard(
              child: Column(
                children: [
                  Text(
                    'Não foi possível carregar potencial.',
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.gray500,
                    ),
                  ),
                  TextButton(
                    onPressed: () => ref.invalidate(
                      clinicDetailPotentialsProvider(facilityId),
                    ),
                    child: const Text('Tentar de novo'),
                  ),
                ],
              ),
            ),
            data: (page) {
              if (page == null || page.items.isEmpty) {
                return const ClinicaEmptySection(
                  icon: Icons.insights_outlined,
                  title: 'Nenhum campo de potencial configurado',
                  description:
                      'Os campos de potencial desta linha aparecerão aqui quando forem configurados.',
                );
              }
              return ClinicDetailCard(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                child: Column(
                  children: [
                    for (var i = 0; i < page.items.length; i++) ...[
                      if (i > 0)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 12),
                          child: Divider(height: 1, color: AppColors.gray100),
                        ),
                      _PotentialRow(
                        item: page.items[i],
                        onEdit: canEdit
                            ? (existing) => _editCompetitor(
                                context,
                                ref,
                                facilityId: facilityId,
                                verticalId: verticalId,
                                item: page.items[i],
                                existing: existing,
                              )
                            : null,
                      ),
                    ],
                  ],
                ),
              );
            },
          ),
      ],
    );
  }
}

/// Opens the quantity sheet and refreshes the section from the response.
///
/// The server returns the recomputed page, so nothing re-fetches and risks
/// showing a different answer than the one the write produced.
Future<void> _editCompetitor(
  BuildContext context,
  WidgetRef ref, {
  required int facilityId,
  required int verticalId,
  required FacilityPotentialItem item,
  CompetitorUsage? existing,
}) async {
  final repository = FacilityPotentialRepository(
    facilityId: facilityId,
    verticalId: verticalId,
  );
  try {
    final updated = await showModalBottomSheet<FacilityPotentialsPage>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => CompetitorQuantitySheet(
        definitionLabel: item.label,
        definitionId: item.definitionId,
        repository: repository,
        existing: existing,
      ),
    );
    if (updated != null) {
      ref.invalidate(
        facilityPotentialsProvider((
          facilityId: facilityId,
          verticalId: verticalId,
        )),
      );
    }
  } finally {
    repository.dispose();
  }
}

class _PotentialRow extends StatelessWidget {
  const _PotentialRow({required this.item, this.onEdit});

  final FacilityPotentialItem item;

  /// Null when the user may not edit this clinic — the affordance disappears
  /// rather than appearing and failing.
  final void Function(CompetitorUsage? existing)? onEdit;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const _IconBadge(icon: Icons.medication_liquid_outlined),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                item.label,
                style: const TextStyle(
                  fontSize: 15,
                  height: 1.25,
                  fontWeight: FontWeight.w700,
                  color: AppColors.navyDeep,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        // Two rows of two rather than four across: at 360dp the four-column
        // layout truncated every label to an ellipsis, so the numbers had no
        // readable captions.
        Row(
          children: [
            Expanded(
              child: _MetricTile(
                icon: Icons.apartment_rounded,
                label: 'AtlasMed/mês',
                value: _fmtQty(item.atlasmedMonthlyAvgQty),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _MetricTile(
                icon: Icons.groups_outlined,
                label: 'Concorrentes/mês',
                value: _fmtQty(item.competitorMonthlyQty),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: _MetricTile(
                icon: Icons.pie_chart_outline_rounded,
                label: 'Mercado total',
                value: _fmtQty(item.totalMarketQty),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(child: _ShareTile(share: item.share)),
          ],
        ),
        _CompetitorTable(competitors: item.competitors, onEdit: onEdit),
      ],
    );
  }
}

/// Who makes up "Concorrentes/mês", and how much of it each one is.
///
/// The server has always sent this list; nothing rendered it, so the competitor
/// figure was a lump sum the rep could not check or correct.
class _CompetitorTable extends StatelessWidget {
  const _CompetitorTable({required this.competitors, this.onEdit});

  final List<CompetitorUsage> competitors;
  final void Function(CompetitorUsage? existing)? onEdit;

  @override
  Widget build(BuildContext context) {
    if (competitors.isEmpty) {
      return Padding(
        padding: const EdgeInsets.only(top: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Nenhum concorrente registrado neste mês.',
              style: TextStyle(
                fontSize: 13,
                height: 1.3,
                color: AppColors.gray500,
              ),
            ),
            if (onEdit != null) ...[
              const SizedBox(height: 10),
              _AddCompetitorButton(onPressed: () => onEdit!(null)),
            ],
          ],
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Row(
            children: [
              Expanded(
                child: Text(
                  'Produto concorrente',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.gray500,
                    letterSpacing: 0.2,
                  ),
                ),
              ),
              Text(
                'Qtd/mês',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.gray500,
                  letterSpacing: 0.2,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          for (final competitor in competitors) ...[
            _CompetitorRow(
              competitor: competitor,
              onTap: onEdit == null ? null : () => onEdit!(competitor),
            ),
            const SizedBox(height: 8),
          ],
          if (onEdit != null)
            _AddCompetitorButton(onPressed: () => onEdit!(null)),
        ],
      ),
    );
  }
}

class _CompetitorRow extends StatelessWidget {
  const _CompetitorRow({required this.competitor, this.onTap});

  final CompetitorUsage competitor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.gray200),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              const _IconBadge(
                icon: Icons.medication_liquid_outlined,
                size: 28,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  competitor.productName,
                  style: const TextStyle(
                    fontSize: 13,
                    height: 1.3,
                    fontWeight: FontWeight.w700,
                    color: AppColors.navyDeep,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Text(
                // The rep's own number, in the units they typed it in — the
                // metric-unit conversion belongs to the totals above, not
                // here, or they cannot recognise what they entered.
                _fmtQty(competitor.quantity),
                style: const TextStyle(
                  fontSize: 14,
                  height: 1.3,
                  fontWeight: FontWeight.w700,
                  color: AppColors.navyDeep,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AddCompetitorButton extends StatelessWidget {
  const _AddCompetitorButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: const _DashedRRectPainter(
        color: AppColors.blueAccent,
        radius: 12,
        strokeWidth: 1.2,
        dash: 5,
        gap: 4,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(12),
          child: const Padding(
            padding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.add_circle_outline,
                  size: 18,
                  color: AppColors.navyDeep,
                ),
                SizedBox(width: 8),
                // Wraps rather than clips: at a large text scale on a 320dp
                // screen the label is wider than the card, and an unbounded
                // Text here overflowed the row.
                Flexible(
                  child: Text(
                    'Adicionar concorrente',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.navyDeep,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MetricTile extends StatelessWidget {
  const _MetricTile({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.gray200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _IconBadge(icon: icon),
          const SizedBox(height: 8),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              height: 1.25,
              fontWeight: FontWeight.w500,
              color: AppColors.gray500,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontSize: 20,
              height: 1.15,
              fontWeight: FontWeight.w700,
              color: AppColors.navyDeep,
            ),
          ),
        ],
      ),
    );
  }
}

class _ShareTile extends StatelessWidget {
  const _ShareTile({required this.share});

  final double? share;

  @override
  Widget build(BuildContext context) {
    // Null, not 0 — nothing recorded is not the same as no sales.
    final label = share == null ? '—' : '${(share! * 100).toStringAsFixed(0)}%';
    final fraction = share?.clamp(0.0, 1.0);

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.gray200),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 44,
            height: 44,
            child: CustomPaint(
              painter: _ShareRingPainter(fraction: fraction),
              child: Center(
                child: Text(
                  label,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.navyDeep,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          const Expanded(
            child: Text(
              'Participação',
              style: TextStyle(
                fontSize: 12,
                height: 1.25,
                fontWeight: FontWeight.w500,
                color: AppColors.gray500,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

class _IconBadge extends StatelessWidget {
  const _IconBadge({required this.icon, this.size = 30});

  final IconData icon;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.blue50,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Icon(icon, size: size * 0.55, color: AppColors.navyDeep),
    );
  }
}

class _ShareRingPainter extends CustomPainter {
  const _ShareRingPainter({required this.fraction});

  final double? fraction;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 4.0;
    final rect = Offset.zero & size;
    final arcRect = rect.deflate(stroke / 2);

    final track = Paint()
      ..color = AppColors.gray200
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(arcRect, 0, 2 * math.pi, false, track);

    if (fraction == null || fraction! <= 0) return;

    final fill = Paint()
      ..color = AppColors.navyDeep
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    // Start at 12 o'clock; even tiny shares leave a visible cap.
    final sweep = math.max(fraction! * 2 * math.pi, 0.12);
    canvas.drawArc(arcRect, -math.pi / 2, sweep, false, fill);
  }

  @override
  bool shouldRepaint(covariant _ShareRingPainter oldDelegate) =>
      oldDelegate.fraction != fraction;
}

class _DashedRRectPainter extends CustomPainter {
  const _DashedRRectPainter({
    required this.color,
    required this.radius,
    required this.strokeWidth,
    required this.dash,
    required this.gap,
  });

  final Color color;
  final double radius;
  final double strokeWidth;
  final double dash;
  final double gap;

  @override
  void paint(Canvas canvas, Size size) {
    final rrect = RRect.fromRectAndRadius(
      Offset.zero & size,
      Radius.circular(radius),
    );
    final path = Path()..addRRect(rrect);
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth;

    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        final next = math.min(distance + dash, metric.length);
        canvas.drawPath(metric.extractPath(distance, next), paint);
        distance = next + gap;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedRRectPainter oldDelegate) =>
      oldDelegate.color != color ||
      oldDelegate.radius != radius ||
      oldDelegate.strokeWidth != strokeWidth ||
      oldDelegate.dash != dash ||
      oldDelegate.gap != gap;
}

String _fmtQty(double? value) {
  if (value == null) return '—';
  if (value == value.roundToDouble()) return value.toStringAsFixed(0);
  return value.toStringAsFixed(1);
}

/// The metric row on its own, so its layout can be asserted at a real phone
/// width without standing up providers, a repository and a network.
///
/// The layout is the thing worth testing here: the previous version put four
/// stat tiles across 360dp and silently ellipsised every caption.
@visibleForTesting
class PotentialRowHarness extends StatelessWidget {
  const PotentialRowHarness({super.key, required this.item, this.onEdit});

  final FacilityPotentialItem item;
  final void Function(CompetitorUsage? existing)? onEdit;

  @override
  Widget build(BuildContext context) =>
      _PotentialRow(item: item, onEdit: onEdit);
}
