import 'dart:ui' show FontFeature;

import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:atlasmed_mobile_app/features/capture/presentation/capture_queue_provider.dart';
import 'package:atlasmed_mobile_app/features/capture/presentation/pending_captures_banner.dart';
import 'package:atlasmed_mobile_app/features/capture/presentation/visit_actions.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The whole of today, in the order it happens, and the one press that records
/// it.
///
/// It used to list only what was **still ahead**, which meant a visit vanished
/// from the card the moment it was closed — the rep pressed Encerrar and the
/// thing they had just done disappeared, as though the record had failed. A day
/// is also something a rep looks back at ("what time did I leave that clinic?"),
/// and the answer was on a different screen.
///
/// So: everything, scrolled sideways, each stop showing the hour it started on
/// the left and the hour it ended on the right. Finished stops show the hours
/// that were **measured**; the rest show what is planned (§15.6.3 — the plan is
/// not the record). The one in progress says so and stays first in the eye.
class TodayAppointmentsCard extends ConsumerWidget {
  const TodayAppointmentsCard({super.key, this.now});

  /// Injected so "in progress" and the ordering are testable.
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

    // Checked before the agenda, not after it: a rep who pressed Cheguei with no
    // signal usually has no agenda either, and the queue is exactly what they
    // need to see. The snackbar is long gone by then, and without this the only
    // place that admits the press is still waiting is the agenda's day screen.
    final waiting = ref.watch(captureQueueProvider).pending > 0;

    final stops = appointmentsForTheDay(
      agenda.valueOrNull ?? const <CalendarOccurrence>[],
    );
    if (stops.isEmpty && !waiting) return const SizedBox.shrink();

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
          const PendingCapturesBanner(rounded: true),
          if (stops.isNotEmpty)
            SizedBox(
              height: 132,
              child: ListView.separated(
                key: const Key('today-appointments-strip'),
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 14),
                itemCount: stops.length,
                separatorBuilder: (_, _) => const SizedBox(width: 10),
                itemBuilder: (context, index) =>
                    _StopCard(occurrence: stops[index], now: at),
              ),
            ),
        ],
      ),
    );
  }
}

/// Everything on the day, earliest first.
///
/// Cancelled occurrences never reach the client, so what arrives is what
/// happened or is going to. Sorted by when each stop actually *started* where
/// that is known, so the strip reads in the order the rep lived it rather than
/// the order it was booked.
List<CalendarOccurrence> appointmentsForTheDay(List<CalendarOccurrence> all) =>
    all.toList(growable: false)
      ..sort((a, b) => _startOf(a).compareTo(_startOf(b)));

DateTime _startOf(CalendarOccurrence occurrence) =>
    occurrence.interaction?.actualStartedAt ?? occurrence.startsAt;

/// The measured end where there is one, the planned end otherwise.
DateTime _endOf(CalendarOccurrence occurrence) =>
    occurrence.interaction?.actualEndedAt ?? occurrence.endsAt;

String _hhmm(DateTime value) {
  final local = value.toLocal();
  return '${local.hour.toString().padLeft(2, '0')}:'
      '${local.minute.toString().padLeft(2, '0')}';
}

class _StopCard extends ConsumerWidget {
  const _StopCard({required this.occurrence, required this.now});

  final CalendarOccurrence occurrence;
  final DateTime now;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final interaction = occurrence.interaction;
    final status = interaction?.status;
    final running = status == InteractionStatus.inProgress;
    final done = status == InteractionStatus.completed;
    final block = interaction == null;
    final name =
        occurrence.facility?.name ??
        interaction?.person?.name ??
        occurrence.title;

    final accent = running
        ? AppColors.green
        : done
        ? AppColors.gray400
        : AppColors.navyBright;

    return Container(
      width: 208,
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
      decoration: BoxDecoration(
        // The running stop is tinted, not merely labelled: it is the one the
        // rep is standing in and the only one they can end.
        color: running ? AppColors.green.withValues(alpha: 0.06) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: running ? AppColors.green : AppColors.surfaceSecondary,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                _hhmm(_startOf(occurrence)),
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: accent,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
              // While a stop is running there is no end to show — inventing one
              // would be the plan pretending to be the record — so the space
              // the end would occupy says what is true instead.
              if (running) ...[
                const SizedBox(width: 8),
                Container(
                  width: 7,
                  height: 7,
                  decoration: const BoxDecoration(
                    color: AppColors.green,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                const Expanded(
                  child: Text(
                    'em andamento',
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.green,
                    ),
                  ),
                ),
              ] else ...[
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    child: Divider(color: accent.withValues(alpha: 0.35)),
                  ),
                ),
                Text(
                  _hhmm(_endOf(occurrence)),
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.gray600,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 6),
          Expanded(
            child: Text(
              name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
                color: AppColors.gray900,
              ),
            ),
          ),
          _StopFooter(
            occurrence: occurrence,
            running: running,
            done: done,
            block: block,
            name: name,
            now: now,
          ),
        ],
      ),
    );
  }
}

class _StopFooter extends ConsumerWidget {
  const _StopFooter({
    required this.occurrence,
    required this.running,
    required this.done,
    required this.block,
    required this.name,
    required this.now,
  });

  final CalendarOccurrence occurrence;
  final bool running;
  final bool done;
  final bool block;
  final String name;
  final DateTime now;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (running) {
      return _Action(
        label: 'Encerrar',
        icon: Icons.stop_circle_outlined,
        colour: AppColors.gray700,
        semanticKey: const Key('today-finish'),
        onPressed: () => _record(context, ref, finish: true),
      );
    }
    if (done) {
      return const _Tag(
        icon: Icons.check_circle_outline_rounded,
        label: 'Concluído',
        colour: AppColors.gray500,
      );
    }
    // A personal block has nothing to record; it is here because it occupies
    // the rep's day, not because it is a visit.
    if (block) {
      return const _Tag(
        icon: Icons.block_rounded,
        label: 'Bloqueio',
        colour: AppColors.gray500,
      );
    }
    // Missed and still open: the day moved past it and nobody said what
    // happened. The press is the same one, so it stays offered.
    final late = occurrence.endsAt.toLocal().isBefore(now);
    return _Action(
      label: _startLabel(occurrence),
      icon: _startsWithArrival(occurrence)
          ? Icons.where_to_vote_rounded
          : Icons.play_circle_outline_rounded,
      colour: late ? AppColors.amber : AppColors.green,
      semanticKey: const Key('today-cheguei'),
      onPressed: () => _record(context, ref, finish: false),
    );
  }

  Future<void> _record(
    BuildContext context,
    WidgetRef ref, {
    required bool finish,
  }) async {
    final interaction = occurrence.interaction;
    if (interaction == null) return;
    final atFacility = _startsWithArrival(occurrence);
    final recorded = finish
        ? await finishPlannedVisit(
            context,
            ref,
            interactionId: interaction.id,
            expectedVersion: interaction.version,
            facilityName: name,
            atFacility: atFacility,
          )
        : await startPlannedVisit(
            context,
            ref,
            interactionId: interaction.id,
            expectedVersion: interaction.version,
            facilityName: name,
            atFacility: atFacility,
          );
    if (recorded && context.mounted) ref.invalidate(agendaProvider);
  }
}

/// "Cheguei" only where there is somewhere to arrive at (§15.7.5).
bool _startsWithArrival(CalendarOccurrence occurrence) =>
    occurrence.interaction?.facilityId != null &&
    occurrence.interaction?.modality != CalendarModality.remote;

String _startLabel(CalendarOccurrence occurrence) =>
    _startsWithArrival(occurrence) ? 'Cheguei' : 'Iniciar';

class _Action extends StatelessWidget {
  const _Action({
    required this.label,
    required this.icon,
    required this.colour,
    required this.onPressed,
    required this.semanticKey,
  });

  final String label;
  final IconData icon;
  final Color colour;
  final VoidCallback onPressed;
  final Key semanticKey;

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.centerLeft,
    child: TextButton.icon(
      key: semanticKey,
      onPressed: onPressed,
      icon: Icon(icon, size: 16),
      label: Text(label),
      style: TextButton.styleFrom(
        foregroundColor: colour,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        visualDensity: VisualDensity.compact,
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
    ),
  );
}

class _Tag extends StatelessWidget {
  const _Tag({required this.icon, required this.label, required this.colour});

  final IconData icon;
  final String label;
  final Color colour;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(
      children: [
        Icon(icon, size: 14, color: colour),
        const SizedBox(width: 6),
        Text(label, style: TextStyle(fontSize: 12, color: colour)),
      ],
    ),
  );
}
