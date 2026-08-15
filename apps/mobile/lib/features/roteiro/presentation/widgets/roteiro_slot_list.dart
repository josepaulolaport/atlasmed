import 'package:atlasmed_mobile_app/features/roteiro/data/roteiro.dart';
import 'package:atlasmed_mobile_app/features/roteiro/presentation/widgets/roteiro_stop_card.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';

String _hhmm(DateTime at) =>
    '${at.hour.toString().padLeft(2, '0')}:${at.minute.toString().padLeft(2, '0')}';

/// The day as a fixed number of slots, each one of three things.
///
/// A list that only shows what the engine found hides the two facts a rep most
/// needs while planning: how much of the day is already spoken for, and how much
/// room is left. Showing the capacity — filled, committed, or empty — makes
/// "remove this and give me something else" an obvious move rather than a
/// guess.
class RoteiroSlotList extends StatelessWidget {
  const RoteiroSlotList({
    super.key,
    required this.roteiro,
    required this.visibleStops,
    required this.slotCount,
    required this.onRemove,
    required this.onFillEmpty,
  });

  final Roteiro roteiro;

  /// Suggestions the rep has not pulled out.
  final List<RoteiroStop> visibleStops;

  /// How many suggestion slots the day has — the configured daily limit.
  final int slotCount;

  final ValueChanged<RoteiroStop> onRemove;
  final VoidCallback onFillEmpty;

  @override
  Widget build(BuildContext context) {
    final booked = roteiro.fixedPoints;
    final empty = (slotCount - visibleStops.length).clamp(0, slotCount);

    // Committed and suggested interleaved in time order, so the day reads the
    // way it will actually happen rather than as two separate lists.
    final timed = <({DateTime at, Widget card})>[
      for (final point in booked)
        (at: point.startsAt, card: _BookedCard(point: point)),
      for (final stop in visibleStops)
        (
          at: stop.plannedStartsAt,
          card: RoteiroStopCard(
            stop: stop,
            estimatedTravel: roteiro.isEstimated,
            onRemove: () => onRemove(stop),
          ),
        ),
    ]..sort((a, b) => a.at.compareTo(b.at));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final entry in timed) entry.card,
        for (var i = 0; i < empty; i += 1) _EmptySlot(onTap: onFillEmpty),
      ],
    );
  }
}

/// Something the rep already has. Not a suggestion, and not removable here —
/// it lives in the calendar and is changed there.
class _BookedCard extends StatelessWidget {
  const _BookedCard({required this.point});

  final RoteiroFixedPoint point;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceSecondary,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.gray200),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.event_available_outlined,
            size: 18,
            color: AppColors.gray600,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  point.facilityName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.gray700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Já na sua agenda · ${_hhmm(point.startsAt)}–${_hhmm(point.endsAt)}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.gray500,
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

/// Room the day still has. Dashed rather than solid: it is an absence, and it
/// should not read as a card that failed to load.
class _EmptySlot extends StatelessWidget {
  const _EmptySlot({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 18),
        decoration: BoxDecoration(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: AppColors.gray300,
            style: BorderStyle.solid,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.add_circle_outline,
              size: 18,
              color: AppColors.gray400,
            ),
            const SizedBox(width: 8),
            Text(
              'Vaga livre',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: AppColors.gray500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
