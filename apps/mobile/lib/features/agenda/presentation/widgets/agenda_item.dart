import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';

class AgendaItem extends StatelessWidget {
  const AgendaItem({super.key, required this.occurrence, this.onTap});

  final CalendarOccurrence occurrence;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final status = _statusPresentation(occurrence);
    final contextLabel = _contextLabel(occurrence);
    return Semantics(
      label: [
        occurrence.localStartsAt,
        occurrence.title,
        ?contextLabel,
        status.label,
      ].join(', '),
      button: onTap != null,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 52,
                child: Text(
                  occurrence.localStartsAt,
                  textAlign: TextAlign.right,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.gray700,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      occurrence.title,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.gray900,
                      ),
                    ),
                    if (contextLabel != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        contextLabel,
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.gray600,
                        ),
                      ),
                    ],
                    const SizedBox(height: 7),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(status.icon, size: 15, color: status.color),
                        const SizedBox(width: 5),
                        Text(
                          status.label,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: status.color,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String? _contextLabel(CalendarOccurrence occurrence) {
  final facility = occurrence.facility?.name;
  final modality = switch (occurrence.modality) {
    CalendarModality.inPerson => 'Presencial',
    CalendarModality.remote => 'Remoto',
    null => null,
  };
  if (facility != null && modality != null) return '$facility · $modality';
  return facility ?? modality;
}

_StatusPresentation _statusPresentation(CalendarOccurrence occurrence) {
  final status = occurrence.interaction?.status;
  return switch (status) {
    InteractionStatus.scheduled => const _StatusPresentation(
      label: 'Agendada',
      icon: Icons.schedule_rounded,
      color: AppColors.blue600,
    ),
    InteractionStatus.inProgress => const _StatusPresentation(
      label: 'Em atendimento',
      icon: Icons.play_circle_outline_rounded,
      color: AppColors.amberDark,
    ),
    InteractionStatus.completed => const _StatusPresentation(
      label: 'Concluída',
      icon: Icons.check_circle_outline_rounded,
      color: AppColors.greenDark,
    ),
    InteractionStatus.cancelled => const _StatusPresentation(
      label: 'Cancelada',
      icon: Icons.cancel_outlined,
      color: AppColors.redDark,
    ),
    InteractionStatus.notCompleted => const _StatusPresentation(
      label: 'Não realizada',
      icon: Icons.error_outline_rounded,
      color: AppColors.redDark,
    ),
    null => const _StatusPresentation(
      label: 'Bloqueio pessoal',
      icon: Icons.block_rounded,
      color: AppColors.gray600,
    ),
  };
}

class _StatusPresentation {
  const _StatusPresentation({
    required this.label,
    required this.icon,
    required this.color,
  });

  final String label;
  final IconData icon;
  final Color color;
}
