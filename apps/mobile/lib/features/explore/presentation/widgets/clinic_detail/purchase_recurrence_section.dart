import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';

class PurchaseRecurrenceSection extends StatelessWidget {
  const PurchaseRecurrenceSection({
    super.key,
    required this.value,
  });

  final PurchaseRecurrenceSnapshot? value;

  @override
  Widget build(BuildContext context) {
    final recurrence = value;
    if (recurrence == null) {
      return const ClinicDetailCard(
        margin: EdgeInsets.symmetric(horizontal: 20, vertical: 6),
        child: _EmptyPurchaseRecurrence(),
      );
    }
    final presentation = _PurchasePresentation.from(recurrence);

    return ClinicDetailCard(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
      padding: .zero,
      child: Column(
        crossAxisAlignment: .start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
            child: _PurchaseTimeline(presentation: presentation),
          ),
          const Divider(
            height: 1,
            indent: 16,
            endIndent: 16,
            color: AppColors.gray200,
          ),
          _PurchaseMetrics(recurrence: recurrence, presentation: presentation),
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

enum _PurchaseScenario {
  neverPurchased,
  beforeWindow,
  inWindow,
  dueToday,
  overdue,
  churn,
  inactive,
}

class _PurchasePresentation {
  const _PurchasePresentation({
    required this.scenario,
    required this.today,
    required this.lastPurchase,
    required this.expectedPurchase,
    required this.status,
    required this.timingLabel,
    required this.timingValue,
    required this.accentColor,
    required this.statusIcon,
    required this.timingIcon,
  });

  factory _PurchasePresentation.from(PurchaseRecurrenceSnapshot recurrence) {
    final today = DateUtils.dateOnly(DateTime.now());
    final lastPurchase = recurrence.lastPurchaseDate == null
        ? null
        : DateUtils.dateOnly(recurrence.lastPurchaseDate!);
    final expectedPurchase =
        lastPurchase == null || recurrence.intervalDays <= 0
        ? null
        : DateTime(
            lastPurchase.year,
            lastPurchase.month,
            lastPurchase.day + recurrence.intervalDays,
          );

    if (recurrence.funnelStage == .neverPurchased || lastPurchase == null) {
      return _PurchasePresentation(
        scenario: .neverPurchased,
        today: today,
        lastPurchase: null,
        expectedPurchase: null,
        status: 'Sem histórico',
        timingLabel: 'Próximo passo',
        timingValue: 'Agendar visita',
        accentColor: AppColors.gray600,
        statusIcon: Icons.history_toggle_off_rounded,
        timingIcon: Icons.calendar_month_rounded,
      );
    }

    final daysFromPrediction = expectedPurchase == null
        ? 0
        : expectedPurchase.difference(today).inDays;
    final daysSincePurchase = today.difference(lastPurchase).inDays;

    if (recurrence.funnelStage == PurchaseFunnelStage.inactive) {
      return _PurchasePresentation(
        scenario: _PurchaseScenario.inactive,
        today: today,
        lastPurchase: lastPurchase,
        expectedPurchase: expectedPurchase,
        status: 'Clínica inativa',
        timingLabel: 'Sem comprar',
        timingValue: _daysLabel(daysSincePurchase),
        accentColor: AppColors.redDark,
        statusIcon: Icons.pause_circle_outline_rounded,
        timingIcon: Icons.schedule_rounded,
      );
    }

    if (recurrence.funnelStage == PurchaseFunnelStage.churn) {
      return _PurchasePresentation(
        scenario: _PurchaseScenario.churn,
        today: today,
        lastPurchase: lastPurchase,
        expectedPurchase: expectedPurchase,
        status: 'Risco de churn',
        timingLabel: 'Desde a previsão',
        timingValue: _daysLabel(daysFromPrediction.abs()),
        accentColor: AppColors.redDark,
        statusIcon: Icons.trending_down_rounded,
        timingIcon: Icons.schedule_rounded,
      );
    }

    if (expectedPurchase != null && today.isAfter(expectedPurchase)) {
      return _PurchasePresentation(
        scenario: _PurchaseScenario.overdue,
        today: today,
        lastPurchase: lastPurchase,
        expectedPurchase: expectedPurchase,
        status: 'Recompra atrasada',
        timingLabel: 'Atraso',
        timingValue: _daysLabel(daysFromPrediction.abs()),
        accentColor: AppColors.amberDark,
        statusIcon: Icons.error_outline_rounded,
        timingIcon: Icons.schedule_rounded,
      );
    }

    if (expectedPurchase != null &&
        DateUtils.isSameDay(today, expectedPurchase)) {
      return _PurchasePresentation(
        scenario: _PurchaseScenario.dueToday,
        today: today,
        lastPurchase: lastPurchase,
        expectedPurchase: expectedPurchase,
        status: 'Recompra prevista',
        timingLabel: 'Previsão',
        timingValue: 'Hoje',
        accentColor: AppColors.green600,
        statusIcon: Icons.check_circle_outline_rounded,
        timingIcon: Icons.today_rounded,
      );
    }

    if (recurrence.funnelStage == PurchaseFunnelStage.outsideWindow) {
      final daysUntilWindow = recurrence.nextTransitionDate == null
          ? null
          : DateUtils.dateOnly(
              recurrence.nextTransitionDate!,
            ).difference(today).inDays;
      return _PurchasePresentation(
        scenario: _PurchaseScenario.beforeWindow,
        today: today,
        lastPurchase: lastPurchase,
        expectedPurchase: expectedPurchase,
        status: 'Antes da janela',
        timingLabel: 'Próximo marco',
        timingValue: daysUntilWindow == null
            ? 'Acompanhar'
            : daysUntilWindow <= 0
            ? 'Janela hoje'
            : 'Janela em ${_daysLabel(daysUntilWindow)}',
        accentColor: AppColors.blue600,
        statusIcon: Icons.hourglass_top_rounded,
        timingIcon: Icons.calendar_month_rounded,
      );
    }

    return _PurchasePresentation(
      scenario: _PurchaseScenario.inWindow,
      today: today,
      lastPurchase: lastPurchase,
      expectedPurchase: expectedPurchase,
      status: 'Janela de compra',
      timingLabel: 'Previsão',
      timingValue: expectedPurchase == null
          ? 'Não disponível'
          : 'Em ${_daysLabel(daysFromPrediction)}',
      accentColor: AppColors.green600,
      statusIcon: Icons.shopping_bag_outlined,
      timingIcon: Icons.calendar_month_rounded,
    );
  }

  final _PurchaseScenario scenario;
  final DateTime today;
  final DateTime? lastPurchase;
  final DateTime? expectedPurchase;
  final String status;
  final String timingLabel;
  final String timingValue;
  final Color accentColor;
  final IconData statusIcon;
  final IconData timingIcon;

  bool get isPastPrediction =>
      scenario == _PurchaseScenario.overdue ||
      scenario == _PurchaseScenario.churn ||
      scenario == _PurchaseScenario.inactive;

  Color get timingAccentColor => scenario == _PurchaseScenario.neverPurchased
      ? AppColors.navyBright
      : accentColor;

  List<_TimelinePointData> get timelinePoints {
    if (scenario == _PurchaseScenario.neverPurchased) {
      return [
        const _TimelinePointData(
          label: 'Última compra',
          value: 'Nunca',
          marker: _TimelineMarkerState.never,
        ),
        _TimelinePointData(
          label: 'Hoje',
          value: _formatLongDate(today),
          marker: _TimelineMarkerState.today,
          accentColor: AppColors.navyBright,
        ),
        const _TimelinePointData(
          label: 'Próxima compra',
          value: 'Agendar visita',
          marker: _TimelineMarkerState.next,
          accentColor: AppColors.navyBright,
        ),
      ];
    }

    if (isPastPrediction) {
      return [
        _TimelinePointData(
          label: 'Última compra',
          value: _formatLongDate(lastPurchase),
          marker: _TimelineMarkerState.previous,
        ),
        _TimelinePointData(
          label: 'Compra prevista',
          value: _formatLongDate(expectedPurchase),
          marker: _TimelineMarkerState.missed,
          accentColor: accentColor,
        ),
        _TimelinePointData(
          label: 'Hoje',
          value: _formatLongDate(today),
          marker: _TimelineMarkerState.today,
          accentColor: accentColor,
        ),
      ];
    }

    return [
      _TimelinePointData(
        label: 'Última compra',
        value: _formatLongDate(lastPurchase),
        marker: _TimelineMarkerState.previous,
      ),
      _TimelinePointData(
        label: 'Hoje',
        value: _formatLongDate(today),
        marker: _TimelineMarkerState.today,
        accentColor: AppColors.navyBright,
      ),
      _TimelinePointData(
        label: scenario == _PurchaseScenario.dueToday
            ? 'Previsão'
            : 'Próxima compra',
        value: scenario == _PurchaseScenario.dueToday
            ? 'Para hoje'
            : _formatLongDate(expectedPurchase),
        marker: _TimelineMarkerState.next,
        accentColor: scenario == _PurchaseScenario.dueToday
            ? AppColors.green600
            : null,
      ),
    ];
  }
}

class _TimelinePointData {
  const _TimelinePointData({
    required this.label,
    required this.value,
    required this.marker,
    this.accentColor,
  });

  final String label;
  final String value;
  final _TimelineMarkerState marker;
  final Color? accentColor;
}

class _PurchaseTimeline extends StatelessWidget {
  const _PurchaseTimeline({required this.presentation});

  final _PurchasePresentation presentation;

  @override
  Widget build(BuildContext context) {
    final points = presentation.timelinePoints;
    final overdue = presentation.isPastPrediction;
    final neverPurchased =
        presentation.scenario == _PurchaseScenario.neverPurchased;

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
                    child: _TimelineConnector(
                      dashed: neverPurchased,
                      color: neverPurchased
                          ? AppColors.gray300
                          : AppColors.navyBright,
                    ),
                  ),
                  Positioned(
                    left: middleCenter,
                    top: 25,
                    width: lastCenter - middleCenter,
                    child: _TimelineConnector(
                      dashed: !overdue,
                      color: overdue
                          ? presentation.accentColor
                          : neverPurchased
                          ? AppColors.gray300
                          : AppColors.navyBright.withValues(alpha: 0.38),
                    ),
                  ),
                  Positioned(
                    left: firstCenter - 22,
                    top: 4,
                    child: _TimelineMarker(
                      state: points[0].marker,
                      color: points[0].accentColor,
                    ),
                  ),
                  Positioned(
                    left: middleCenter - 22,
                    top: 4,
                    child: _TimelineMarker(
                      state: points[1].marker,
                      color: points[1].accentColor,
                    ),
                  ),
                  Positioned(
                    left: lastCenter - 22,
                    top: 4,
                    child: _TimelineMarker(
                      state: points[2].marker,
                      color: points[2].accentColor,
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
            for (final point in points)
              Expanded(
                child: _TimelineLabel(
                  label: point.label,
                  value: point.value,
                  accentColor: point.accentColor,
                ),
              ),
          ],
        ),
      ],
    );
  }
}

enum _TimelineMarkerState { previous, today, next, missed, never }

class _TimelineMarker extends StatelessWidget {
  const _TimelineMarker({required this.state, this.color});

  final _TimelineMarkerState state;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final highlighted = switch (state) {
      _TimelineMarkerState.today ||
      _TimelineMarkerState.next ||
      _TimelineMarkerState.missed => true,
      _TimelineMarkerState.previous || _TimelineMarkerState.never => false,
    };
    final resolvedColor =
        color ??
        switch (state) {
          _TimelineMarkerState.next => AppColors.blueAccent,
          _TimelineMarkerState.missed => AppColors.amberDark,
          _TimelineMarkerState.never => AppColors.gray400,
          _ => AppColors.navyBright,
        };
    final background = state == _TimelineMarkerState.missed
        ? AppColors.amber50
        : AppColors.blueLight;

    return SizedBox(
      width: 44,
      height: 44,
      child: DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: highlighted ? background : Colors.transparent,
        ),
        child: Center(
          child: Container(
            width: 22,
            height: 22,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white,
              border: Border.all(color: resolvedColor, width: 2.5),
            ),
            child: state == _TimelineMarkerState.today
                ? Center(
                    child: Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: resolvedColor,
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
  const _TimelineConnector({
    this.dashed = false,
    this.color = AppColors.navyBright,
  });

  final bool dashed;
  final Color color;

  @override
  Widget build(BuildContext context) {
    if (!dashed) {
      return Container(height: 2.5, color: color);
    }

    return SizedBox(
      height: 3,
      child: CustomPaint(painter: _DashedLinePainter(color: color)),
    );
  }
}

class _DashedLinePainter extends CustomPainter {
  const _DashedLinePainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
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
    required this.value,
    this.accentColor,
  });

  final String label;
  final String value;
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: accentColor ?? AppColors.gray500,
            fontSize: 11.5,
            fontWeight: accentColor == null ? FontWeight.w500 : FontWeight.w600,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: accentColor ?? AppColors.gray700,
            fontSize: 11.5,
            height: 1.25,
            fontWeight: accentColor == null ? FontWeight.w400 : FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _PurchaseMetrics extends StatelessWidget {
  const _PurchaseMetrics({
    required this.recurrence,
    required this.presentation,
  });

  final PurchaseRecurrenceSnapshot recurrence;
  final _PurchasePresentation presentation;

  @override
  Widget build(BuildContext context) {
    final neverPurchased =
        presentation.scenario == _PurchaseScenario.neverPurchased;

    return Column(
      children: [
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: _MetricItem(
                  icon: presentation.statusIcon,
                  label: 'Situação atual',
                  value: presentation.status,
                  accentColor: presentation.accentColor,
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
                  icon: presentation.timingIcon,
                  label: presentation.timingLabel,
                  value: presentation.timingValue,
                  accentColor: presentation.timingAccentColor,
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
                  icon: neverPurchased
                      ? Icons.shopping_cart_outlined
                      : Icons.sync_rounded,
                  label: neverPurchased
                      ? 'Compras registradas'
                      : 'Ciclo utilizado',
                  value: neverPurchased
                      ? '0'
                      : _daysLabel(recurrence.intervalDays),
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
                  icon: neverPurchased
                      ? Icons.auto_graph_rounded
                      : Icons.layers_outlined,
                  label: neverPurchased ? 'Previsão' : 'Base da previsão',
                  value: neverPurchased
                      ? 'Após a primeira compra'
                      : '${recurrence.sampleSize} ${recurrence.sampleSize == 1 ? 'intervalo' : 'intervalos'}',
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
    this.accentColor,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          _MetricIcon(icon: icon, color: accentColor),
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
                  style: TextStyle(
                    color: accentColor ?? AppColors.gray900,
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
  const _MetricIcon({required this.icon, this.color});

  final IconData icon;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color?.withValues(alpha: 0.1) ?? AppColors.blueLight,
      ),
      child: Icon(icon, color: color ?? AppColors.navyBright, size: 20),
    );
  }
}

String _daysLabel(int days) => '$days ${days == 1 ? 'dia' : 'dias'}';

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
