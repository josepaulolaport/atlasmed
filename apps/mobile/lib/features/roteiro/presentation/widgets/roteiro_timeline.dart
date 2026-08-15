import 'package:atlasmed_mobile_app/features/roteiro/data/roteiro.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';

String _hhmm(DateTime at) =>
    '${at.hour.toString().padLeft(2, '0')}:${at.minute.toString().padLeft(2, '0')}';

/// One entry in the day, whether the rep booked it or the engine proposed it.
class _Entry {
  const _Entry({
    required this.startsAt,
    required this.endsAt,
    required this.title,
    required this.booked,
    this.subtitle,
    this.travelSeconds,
    this.bucket,
    this.coverage = false,
  });

  final DateTime startsAt;
  final DateTime endsAt;
  final String title;
  final String? subtitle;
  final bool booked;
  final int? travelSeconds;
  final RoteiroBucket? bucket;
  final bool coverage;
}

/// The day as one column, in time order.
///
/// The list of suggestions alone is unreadable: two proposals floating in an
/// empty screen look arbitrary until the commitments they were planned around
/// are visible too. This is the view that shows a rep *why* their afternoon
/// starts at 15:15 — because they are already at a clinic until 15:08.
class RoteiroTimeline extends StatelessWidget {
  const RoteiroTimeline({super.key, required this.roteiro});

  final Roteiro roteiro;

  @override
  Widget build(BuildContext context) {
    final entries = <_Entry>[
      ...roteiro.fixedPoints.map(
        (f) => _Entry(
          startsAt: f.startsAt,
          endsAt: f.endsAt,
          title: f.facilityName,
          booked: true,
        ),
      ),
      ...roteiro.stops.map(
        (s) => _Entry(
          startsAt: s.plannedStartsAt,
          endsAt: s.plannedEndsAt,
          title: s.facilityName,
          subtitle: s.neighborhood ?? s.municipality,
          booked: false,
          travelSeconds: s.travelSecondsFromPrev,
          bucket: s.bucket,
          coverage: s.isCoverageSlot,
        ),
      ),
    ]..sort((a, b) => a.startsAt.compareTo(b.startsAt));

    if (entries.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < entries.length; i += 1)
          _Row(entry: entries[i], isLast: i == entries.length - 1),
      ],
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.entry, required this.isLast});

  final _Entry entry;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final booked = entry.booked;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 44,
            child: Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                _hhmm(entry.startsAt),
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: booked ? FontWeight.w400 : FontWeight.w700,
                  color: booked ? AppColors.gray500 : AppColors.gray900,
                ),
              ),
            ),
          ),
          Column(
            children: [
              Container(
                width: 10,
                height: 10,
                margin: const EdgeInsets.only(top: 5),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  // Booked entries are outlined, suggestions filled: the rep
                  // should be able to tell at a glance which half of the day is
                  // already theirs and which half is being proposed.
                  color: booked ? AppColors.cardBg : AppColors.navyBright,
                  border: Border.all(
                    color: booked ? AppColors.gray400 : AppColors.navyBright,
                    width: 2,
                  ),
                ),
              ),
              if (!isLast)
                Expanded(
                  child: Container(width: 2, color: AppColors.gray200),
                ),
            ],
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(left: 12, bottom: 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (entry.travelSeconds != null && entry.travelSeconds! > 0)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 3),
                      child: Text(
                        '${(entry.travelSeconds! / 60).round()} min de deslocamento',
                        style: const TextStyle(fontSize: 11, color: AppColors.gray500),
                      ),
                    ),
                  Text(
                    entry.title,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: booked ? FontWeight.w500 : FontWeight.w600,
                      color: booked ? AppColors.gray600 : AppColors.gray900,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Text(
                        booked
                            ? 'Já agendada · ${_hhmm(entry.startsAt)}–${_hhmm(entry.endsAt)}'
                            : '${_hhmm(entry.startsAt)}–${_hhmm(entry.endsAt)}'
                                '${entry.subtitle != null ? " · ${entry.subtitle}" : ""}',
                        style: const TextStyle(fontSize: 11, color: AppColors.gray500),
                      ),
                    ],
                  ),
                  if (!booked && entry.bucket != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 5),
                      child: Wrap(
                        spacing: 6,
                        children: [
                          _MiniChip(
                            label: entry.bucket!.label,
                            color: entry.bucket!.color,
                          ),
                          if (entry.coverage)
                            const _MiniChip(
                              label: 'Cobertura',
                              color: AppColors.blueDark,
                            ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MiniChip extends StatelessWidget {
  const _MiniChip({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(
          label,
          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: color),
        ),
      );
}
