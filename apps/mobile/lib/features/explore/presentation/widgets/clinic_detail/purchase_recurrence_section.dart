import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class PurchaseRecurrenceSection extends StatelessWidget {
  const PurchaseRecurrenceSection({
    super.key,
    required this.value,
    this.onViewHistory,
  });

  final PurchaseRecurrenceSnapshot? value;
  final VoidCallback? onViewHistory;

  @override
  Widget build(BuildContext context) {
    final recurrence = value;
    if (recurrence == null) {
      return const ClinicDetailCard(
        margin: EdgeInsets.symmetric(horizontal: 20, vertical: 6),
        child: _EmptyPurchaseRecurrence(),
      );
    }

    return ClinicDetailCard(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
      padding: .zero,
      child: Column(
        crossAxisAlignment: .start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
            child: Wrap(
              spacing: 10,
              runSpacing: 8,
              crossAxisAlignment: .center,
              children: [
                if (recurrence.funnelStage != null)
                  _StageBadge(stage: recurrence.funnelStage!),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: _PurchaseTimeline(recurrence: recurrence),
          ),
          const Divider(
            height: 1,
            indent: 16,
            endIndent: 16,
            color: AppColors.gray200,
          ),
          _PurchaseMetrics(recurrence: recurrence),
          const Divider(
            height: 1,
            indent: 16,
            endIndent: 16,
            color: AppColors.gray200,
          ),
          Semantics(
            button: true,
            label: 'Ver histórico de compras',
            child: InkWell(
              onTap: onViewHistory ?? () => context.push('/orders'),
              child: const Padding(
                padding: EdgeInsets.fromLTRB(16, 14, 12, 14),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Ver histórico de compras',
                        style: TextStyle(
                          color: AppColors.navyBright,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    Icon(
                      Icons.chevron_right_rounded,
                      color: AppColors.gray400,
                      size: 22,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyPurchaseRecurrence extends StatelessWidget {
  const _EmptyPurchaseRecurrence();

  @override
  Widget build(BuildContext context) {
    return const Row(
      children: [
        _MetricIcon(icon: Icons.sync_rounded),
        SizedBox(width: 12),
        Expanded(
          child: Text(
            'Perfil de compras não disponível',
            style: TextStyle(color: AppColors.gray500, fontSize: 13),
          ),
        ),
      ],
    );
  }
}

class _StageBadge extends StatelessWidget {
  const _StageBadge({required this.stage});

  final PurchaseFunnelStage stage;

  @override
  Widget build(BuildContext context) {
    final label = switch (stage) {
      PurchaseFunnelStage.purchaseWindow => 'Janela de compra',
      PurchaseFunnelStage.outsideWindow => 'Fora da janela',
      _ => stage.label,
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: stage.backgroundColor,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: stage.color.withValues(alpha: 0.18)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: stage.color,
          fontSize: 11.5,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _PurchaseTimeline extends StatelessWidget {
  const _PurchaseTimeline({required this.recurrence});

  final PurchaseRecurrenceSnapshot recurrence;

  @override
  Widget build(BuildContext context) {
    final today = DateUtils.dateOnly(DateTime.now());
    final lastPurchase = recurrence.lastPurchaseDate;
    final nextPurchase = lastPurchase == null || recurrence.intervalDays <= 0
        ? null
        : DateUtils.dateOnly(
            lastPurchase.add(Duration(days: recurrence.intervalDays)),
          );

    return Column(
      children: [
        SizedBox(
          height: 52,
          child: LayoutBuilder(
            builder: (context, constraints) {
              final columnWidth = constraints.maxWidth / 3;
              final firstCenter = columnWidth / 2;
              final middleCenter = constraints.maxWidth / 2;
              final lastCenter = constraints.maxWidth - firstCenter;

              return Stack(
                children: [
                  Positioned(
                    left: firstCenter,
                    top: 25,
                    width: middleCenter - firstCenter,
                    child: const _TimelineConnector(),
                  ),
                  Positioned(
                    left: middleCenter,
                    top: 25,
                    width: lastCenter - middleCenter,
                    child: const _TimelineConnector(dashed: true),
                  ),
                  Positioned(
                    left: firstCenter - 22,
                    top: 4,
                    child: const _TimelineMarker(
                      state: _TimelineMarkerState.previous,
                    ),
                  ),
                  Positioned(
                    left: middleCenter - 22,
                    top: 4,
                    child: const _TimelineMarker(
                      state: _TimelineMarkerState.today,
                    ),
                  ),
                  Positioned(
                    left: lastCenter - 22,
                    top: 4,
                    child: const _TimelineMarker(
                      state: _TimelineMarkerState.next,
                    ),
                  ),
                ],
              );
            },
          ),
        ),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _TimelineLabel(
                label: 'Última compra',
                date: _formatLongDate(lastPurchase),
              ),
            ),
            Expanded(
              child: _TimelineLabel(
                label: 'Hoje',
                date: _formatLongDate(today),
                highlighted: true,
              ),
            ),
            Expanded(
              child: _TimelineLabel(
                label: 'Próxima compra',
                date: _formatLongDate(nextPurchase),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

enum _TimelineMarkerState { previous, today, next }

class _TimelineMarker extends StatelessWidget {
  const _TimelineMarker({required this.state});

  final _TimelineMarkerState state;

  @override
  Widget build(BuildContext context) {
    final highlighted = state != _TimelineMarkerState.previous;
    final color = state == _TimelineMarkerState.next
        ? AppColors.blueAccent
        : AppColors.navyBright;

    return SizedBox(
      width: 44,
      height: 44,
      child: DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: highlighted ? AppColors.blueLight : Colors.transparent,
        ),
        child: Center(
          child: Container(
            width: 22,
            height: 22,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white,
              border: Border.all(color: color, width: 2.5),
            ),
            child: state == _TimelineMarkerState.today
                ? Center(
                    child: Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: color,
                      ),
                    ),
                  )
                : null,
          ),
        ),
      ),
    );
  }
}

class _TimelineConnector extends StatelessWidget {
  const _TimelineConnector({this.dashed = false});

  final bool dashed;

  @override
  Widget build(BuildContext context) {
    if (!dashed) {
      return Container(height: 2.5, color: AppColors.navyBright);
    }

    return SizedBox(
      height: 3,
      child: CustomPaint(painter: _DashedLinePainter()),
    );
  }
}

class _DashedLinePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.navyBright.withValues(alpha: 0.38)
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round;
    const dashWidth = 6.0;
    const dashGap = 7.0;
    var startX = 0.0;
    while (startX < size.width) {
      canvas.drawLine(
        Offset(startX, size.height / 2),
        Offset((startX + dashWidth).clamp(0, size.width), size.height / 2),
        paint,
      );
      startX += dashWidth + dashGap;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _TimelineLabel extends StatelessWidget {
  const _TimelineLabel({
    required this.label,
    required this.date,
    this.highlighted = false,
  });

  final String label;
  final String date;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: highlighted ? AppColors.navyBright : AppColors.gray500,
            fontSize: 11.5,
            fontWeight: highlighted ? FontWeight.w600 : FontWeight.w500,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          date,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: AppColors.gray700,
            fontSize: 11.5,
            height: 1.25,
          ),
        ),
      ],
    );
  }
}

class _PurchaseMetrics extends StatelessWidget {
  const _PurchaseMetrics({required this.recurrence});

  final PurchaseRecurrenceSnapshot recurrence;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: _MetricItem(
                  icon: Icons.sync_rounded,
                  label: 'Recorrência média',
                  value: _daysLabel(recurrence.intervalDays),
                ),
              ),
              const VerticalDivider(
                width: 1,
                thickness: 1,
                indent: 14,
                endIndent: 14,
                color: AppColors.gray200,
              ),
              Expanded(
                child: _MetricItem(
                  icon: Icons.show_chart_rounded,
                  label: 'Intervalo observado',
                  value: recurrence.observedIntervalDays == null
                      ? 'Não disponível'
                      : _daysLabel(recurrence.observedIntervalDays!),
                ),
              ),
            ],
          ),
        ),
        const Divider(
          height: 1,
          indent: 16,
          endIndent: 16,
          color: AppColors.gray200,
        ),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: _MetricItem(
                  icon: Icons.layers_outlined,
                  label: 'Base da previsão',
                  value:
                      '${recurrence.sampleSize} ${recurrence.sampleSize == 1 ? 'intervalo' : 'intervalos'}',
                ),
              ),
              const VerticalDivider(
                width: 1,
                thickness: 1,
                indent: 14,
                endIndent: 14,
                color: AppColors.gray200,
              ),
              Expanded(
                child: _MetricItem(
                  icon: Icons.storage_rounded,
                  label: 'Origem',
                  value: _sourceLabel(recurrence.source),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MetricItem extends StatelessWidget {
  const _MetricItem({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          _MetricIcon(icon: icon),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    color: AppColors.gray500,
                    fontSize: 11.5,
                    height: 1.2,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  value,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.gray900,
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    height: 1.2,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MetricIcon extends StatelessWidget {
  const _MetricIcon({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 38,
      height: 38,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        color: AppColors.blueLight,
      ),
      child: Icon(icon, color: AppColors.navyBright, size: 20),
    );
  }
}

String _daysLabel(int days) => '$days ${days == 1 ? 'dia' : 'dias'}';

String _sourceLabel(PurchaseRecurrenceSource? source) => switch (source) {
  PurchaseRecurrenceSource.calculated => 'Histórico de compras',
  PurchaseRecurrenceSource.manual => 'Configuração manual',
  PurchaseRecurrenceSource.defaultValue => 'Padrão do sistema',
  null => 'Não informada',
};

String _formatLongDate(DateTime? date) {
  if (date == null) return 'Não disponível';
  const months = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ];
  return '${date.day} de ${months[date.month - 1]}';
}
