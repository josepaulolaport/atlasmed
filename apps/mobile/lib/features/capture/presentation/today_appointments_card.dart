import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:atlasmed_mobile_app/features/capture/presentation/visit_actions.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// What is left of today, and the one press that records it.
///
/// Desempenho is the screen a rep opens every morning, and until now it only
/// answered questions about the past. This answers "what am I doing next", and
/// lets them say they have arrived without going to find the clinic's profile
/// first — the planned path had no entry point of its own.
///
/// Deliberately only what is **ahead plus in progress**: a card still listing
/// this morning's finished visit at five in the afternoon is noise, and the
/// count of what is done belongs in the day's own summary rather than here.
class TodayAppointmentsCard extends ConsumerWidget {
  const TodayAppointmentsCard({super.key, this.now});

  /// Injected so "still ahead" is testable.
  final DateTime? now;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final at = now ?? DateTime.now();
    final day = DateTime(at.year, at.month, at.day);
    final agenda = ref.watch(
      agendaProvider(
        AgendaQuery(from: day, to: day.add(const Duration(days: 1))),
      ),
    );

    final all = agenda.valueOrNull;
    if (all == null) return const SizedBox.shrink();

    final upcoming = appointmentsStillAhead(all, at);
    final doneCount = all.length - upcoming.length;
    if (upcoming.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.surfaceSecondary),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 8, 6),
            child: Row(
              children: [
                const Icon(
                  Icons.today_rounded,
                  size: 18,
                  color: AppColors.navyBright,
                ),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text(
                    'Meus compromissos hoje',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.gray900,
                    ),
                  ),
                ),
                TextButton(
                  key: const Key('today-appointments-see-more'),
                  onPressed: () => AgendaDayRoute(
                    '${day.year}-${day.month.toString().padLeft(2, '0')}'
                    '-${day.day.toString().padLeft(2, '0')}',
                  ).push(context),
                  child: const Text('Ver mais'),
                ),
              ],
            ),
          ),
          for (final occurrence in upcoming)
            _AppointmentRow(occurrence: occurrence),
          if (doneCount > 0)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: Text(
                doneCount == 1
                    ? '1 visita já registrada hoje'
                    : '$doneCount visitas já registradas hoje',
                style: const TextStyle(
                  fontSize: 11.5,
                  color: AppColors.gray500,
                ),
              ),
            )
          else
            const SizedBox(height: 8),
        ],
      ),
    );
  }
}

/// Today's visits that still need the rep — ahead of [now], or already running.
///
/// A visit in progress stays whatever the clock says: it is the one the rep is
/// standing in, and it is the only one that can be ended.
List<CalendarOccurrence> appointmentsStillAhead(
  List<CalendarOccurrence> all,
  DateTime now,
) {
  final rows =
      all
          .where((item) {
            final status = item.interaction?.status;
            if (status == InteractionStatus.inProgress) return true;
            if (status == InteractionStatus.completed) return false;
            if (status == InteractionStatus.cancelled) return false;
            return item.endsAt.toLocal().isAfter(now);
          })
          .toList(growable: false)
        ..sort((a, b) => a.startsAt.compareTo(b.startsAt));
  return rows;
}

class _AppointmentRow extends ConsumerWidget {
  const _AppointmentRow({required this.occurrence});

  final CalendarOccurrence occurrence;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final start = occurrence.startsAt.toLocal();
    final running =
        occurrence.interaction?.status == InteractionStatus.inProgress;
    final interactionId = occurrence.interaction?.id;
    final name = occurrence.facility?.name ?? occurrence.title;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 6, 12, 6),
      child: Row(
        children: [
          SizedBox(
            width: 46,
            child: Text(
              '${start.hour.toString().padLeft(2, '0')}:'
              '${start.minute.toString().padLeft(2, '0')}',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: running ? AppColors.green : AppColors.gray700,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.gray900,
                  ),
                ),
                if (running)
                  const Text(
                    'em andamento',
                    style: TextStyle(fontSize: 11, color: AppColors.green),
                  ),
              ],
            ),
          ),
          // A personal block has nothing to record; it is here because it
          // occupies the rep's day, not because it is a visit.
          if (interactionId != null)
            _RowAction(
              running: running,
              onPressed: () async {
                final done = running
                    ? await finishPlannedVisit(
                        context,
                        ref,
                        interactionId: interactionId,
                        expectedVersion: occurrence.interaction!.version,
                        facilityName: name,
                      )
                    : await startPlannedVisit(
                        context,
                        ref,
                        interactionId: interactionId,
                        expectedVersion: occurrence.interaction!.version,
                        facilityName: name,
                      );
                if (done && context.mounted) {
                  ref.invalidate(agendaProvider);
                }
              },
            ),
        ],
      ),
    );
  }
}

class _RowAction extends StatelessWidget {
  const _RowAction({required this.running, required this.onPressed});

  final bool running;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => TextButton.icon(
    key: Key(running ? 'today-finish' : 'today-cheguei'),
    onPressed: onPressed,
    icon: Icon(
      running ? Icons.stop_circle_outlined : Icons.where_to_vote_rounded,
      size: 16,
    ),
    label: Text(running ? 'Encerrar' : 'Cheguei'),
    style: TextButton.styleFrom(
      foregroundColor: running ? AppColors.gray700 : AppColors.green,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      visualDensity: VisualDensity.compact,
    ),
  );
}
