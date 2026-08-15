import 'package:atlasmed_mobile_app/features/roteiro/data/roteiro.dart';
import 'package:atlasmed_mobile_app/features/roteiro/domain/roteiro_schedule.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';

String _hhmm(DateTime at) =>
    '${at.hour.toString().padLeft(2, '0')}:${at.minute.toString().padLeft(2, '0')}';

/// One clinic in the day, with the reasons it is there.
///
/// The reasons are the feature. A ranked list without them is a black box a rep
/// has no way to disagree with, and every reason on this card traces to a
/// component the server sent (spec 0016 §5.2).
class RoteiroStopCard extends StatelessWidget {
  const RoteiroStopCard({
    super.key,
    required this.scheduled,
    required this.estimatedTravel,
    this.onTap,
    this.onRemove,
    this.onDurationChanged,
    this.onTimeChanged,
  });

  final ScheduledStop scheduled;

  RoteiroStop get stop => scheduled.stop;

  /// P1 has no Matrix call, so travel is a straight-line estimate and says so.
  final bool estimatedTravel;
  final VoidCallback? onTap;

  /// An explicit control rather than swipe-to-dismiss. Dismissible removes the
  /// widget synchronously and asserts if the list has not changed with it,
  /// which is what a re-plan cannot promise.
  final VoidCallback? onRemove;

  /// Editable on the card itself, not behind a detail screen. A flat duration
  /// for every clinic is plainly wrong — a first visit to a hospital is not a
  /// check-in at an account the rep knows — and the rep is the only one who
  /// knows which is which until outcome capture can measure it (§15.2).
  final ValueChanged<int>? onDurationChanged;
  final ValueChanged<DateTime>? onTimeChanged;

  @override
  Widget build(BuildContext context) {
    final travel = stop.travelSecondsFromPrev;
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: AppColors.cardBg,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.gray200),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (travel != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.directions_car_outlined,
                        size: 14,
                        color: AppColors.gray500,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '${(travel / 60).round()} min de deslocamento'
                        '${estimatedTravel ? ' (estimado)' : ''}',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.gray500,
                        ),
                      ),
                    ],
                  ),
                ),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _PositionBadge(position: stop.position + 1),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          stop.facilityName,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: AppColors.gray900,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          [
                            '${_hhmm(scheduled.startsAt)}–${_hhmm(scheduled.endsAt)}',
                            // Bairro first — it is what tells two branches of
                            // the same chain apart on screen.
                            if (stop.neighborhood != null)
                              stop.neighborhood!
                            else if (stop.municipality != null)
                              stop.municipality!,
                            if (stop.straightLineKm != null)
                              '${stop.straightLineKm!.toStringAsFixed(1)} km',
                          ].join(' · '),
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.gray500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (onRemove != null)
                    IconButton(
                      tooltip: 'Remover do roteiro',
                      visualDensity: VisualDensity.compact,
                      icon: const Icon(
                        Icons.close,
                        size: 18,
                        color: AppColors.gray400,
                      ),
                      onPressed: onRemove,
                    ),
                ],
              ),
              if (scheduled.shifted)
                const Padding(
                  padding: EdgeInsets.only(top: 8),
                  child: _ShiftedNote(),
                ),
              if (onDurationChanged != null || onTimeChanged != null)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: _TimeControls(
                    scheduled: scheduled,
                    onDurationChanged: onDurationChanged,
                    onTimeChanged: onTimeChanged,
                  ),
                ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  // Never colour alone — every chip carries its own text, per
                  // PRODUCT.md's accessibility rule.
                  _Chip(label: stop.bucket.label, color: stop.bucket.color),
                  _Chip(
                    label: stop.modality.label,
                    color: AppColors.gray600,
                    icon: stop.modality.icon,
                  ),
                  if (stop.isAnchor)
                    const _Chip(label: 'Já combinada', color: AppColors.purple),
                  if (stop.isCoverageSlot)
                    const _Chip(label: 'Cobertura', color: AppColors.blueDark),
                ],
              ),
              const SizedBox(height: 10),
              ...stop.reasons
                  .take(3)
                  .map(
                    (reason) => Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Padding(
                            padding: EdgeInsets.only(top: 5, right: 8),
                            child: Icon(
                              Icons.circle,
                              size: 5,
                              color: AppColors.gray400,
                            ),
                          ),
                          Expanded(
                            child: Text(
                              reason,
                              style: const TextStyle(
                                fontSize: 13,
                                color: AppColors.gray700,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Says why a time the rep did not touch has changed.
///
/// Without it the ripple looks like the app losing the plan. A rep who
/// lengthened one visit needs to see that the two after it moved, before they
/// leave the screen believing the old times.
class _ShiftedNote extends StatelessWidget {
  const _ShiftedNote();

  @override
  Widget build(BuildContext context) => Row(
    children: const [
      Icon(Icons.swap_vert, size: 13, color: AppColors.amber),
      SizedBox(width: 6),
      Expanded(
        child: Text(
          'Horário ajustado pela sua alteração',
          style: TextStyle(fontSize: 11, color: AppColors.amber),
        ),
      ),
    ],
  );
}

/// Duration and start time, one tap each.
class _TimeControls extends StatelessWidget {
  const _TimeControls({
    required this.scheduled,
    required this.onDurationChanged,
    required this.onTimeChanged,
  });

  final ScheduledStop scheduled;
  final ValueChanged<int>? onDurationChanged;
  final ValueChanged<DateTime>? onTimeChanged;

  Future<void> _pickDuration(BuildContext context) async {
    final chosen = await showModalBottomSheet<int>(
      context: context,
      backgroundColor: AppColors.cardBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 18, 20, 4),
              child: Text(
                'Quanto tempo nesta clínica?',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: AppColors.gray900,
                ),
              ),
            ),
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 0, 20, 12),
              child: Text(
                'As visitas seguintes se ajustam ao que você escolher.',
                style: TextStyle(fontSize: 12, color: AppColors.gray500),
              ),
            ),
            for (final minutes in kRoteiroDurationChoices)
              ListTile(
                dense: true,
                title: Text(_durationLabel(minutes)),
                trailing: minutes == scheduled.durationMinutes
                    ? const Icon(
                        Icons.check,
                        size: 18,
                        color: AppColors.navyBright,
                      )
                    : null,
                onTap: () => Navigator.of(sheetContext).pop(minutes),
              ),
          ],
        ),
      ),
    );
    if (chosen != null) onDurationChanged?.call(chosen);
  }

  Future<void> _pickTime(BuildContext context) async {
    final chosen = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(scheduled.startsAt),
      helpText: 'Começar a visita às',
    );
    if (chosen == null) return;
    final day = scheduled.startsAt;
    onTimeChanged?.call(
      DateTime(day.year, day.month, day.day, chosen.hour, chosen.minute),
    );
  }

  @override
  Widget build(BuildContext context) => Row(
    children: [
      if (onTimeChanged != null)
        _ControlChip(
          icon: Icons.schedule,
          label: _hhmm(scheduled.startsAt),
          onTap: () => _pickTime(context),
        ),
      if (onTimeChanged != null && onDurationChanged != null)
        const SizedBox(width: 8),
      if (onDurationChanged != null)
        _ControlChip(
          icon: Icons.hourglass_empty,
          label: _durationLabel(scheduled.durationMinutes),
          onTap: () => _pickDuration(context),
        ),
    ],
  );
}

String _durationLabel(int minutes) {
  if (minutes < 60) return '$minutes min';
  final hours = minutes ~/ 60;
  final rest = minutes % 60;
  return rest == 0
      ? '${hours}h'
      : '${hours}h${rest.toString().padLeft(2, '0')}';
}

class _ControlChip extends StatelessWidget {
  const _ControlChip({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(8),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.gray300),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: AppColors.gray600),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.gray700,
            ),
          ),
          const SizedBox(width: 4),
          const Icon(
            Icons.keyboard_arrow_down,
            size: 14,
            color: AppColors.gray400,
          ),
        ],
      ),
    ),
  );
}

class _PositionBadge extends StatelessWidget {
  const _PositionBadge({required this.position});

  final int position;

  @override
  Widget build(BuildContext context) => Container(
    width: 28,
    height: 28,
    alignment: Alignment.center,
    decoration: const BoxDecoration(
      color: AppColors.navyBright,
      shape: BoxShape.circle,
    ),
    child: Text(
      '$position',
      style: const TextStyle(
        color: Colors.white,
        fontSize: 13,
        fontWeight: FontWeight.w700,
      ),
    ),
  );
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.color, this.icon});

  final String label;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.10),
      borderRadius: BorderRadius.circular(6),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (icon != null) ...[
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
        ],
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: color,
          ),
        ),
      ],
    ),
  );
}
