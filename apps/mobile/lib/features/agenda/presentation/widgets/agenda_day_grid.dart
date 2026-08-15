import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';

/// Height of one hour. Sets how much of the day fits on screen at once —
/// 64 shows roughly nine hours, which covers a working day with one scroll.
const _hourHeight = 64.0;
const _gutterWidth = 56.0;

/// One day as an hour grid, with events laid out where they actually fall.
///
/// A list of events tells a rep what they have; a grid tells them what they can
/// still fit — which is the question this screen exists to answer, and the one
/// the roteiro needs them to have an opinion about.
class AgendaDayGrid extends StatelessWidget {
  const AgendaDayGrid({
    super.key,
    required this.day,
    required this.occurrences,
    this.onOccurrenceTap,
    this.now,
  });

  final DateTime day;
  final List<CalendarOccurrence> occurrences;
  final ValueChanged<CalendarOccurrence>? onOccurrenceTap;
  final DateTime? now;

  @override
  Widget build(BuildContext context) {
    final current = now ?? DateTime.now();
    final isToday =
        current.year == day.year &&
        current.month == day.month &&
        current.day == day.day;

    return SingleChildScrollView(
      // Opens on the working day rather than at midnight: nobody plans 01:00,
      // and landing there costs a scroll every single time.
      child: SizedBox(
        height: _hourHeight * 24,
        child: Stack(
          children: [
            for (var hour = 0; hour < 24; hour += 1)
              Positioned(
                top: hour * _hourHeight,
                left: 0,
                right: 0,
                child: _HourLine(hour: hour),
              ),
            for (final occurrence in occurrences)
              _positioned(occurrence, context),
            if (isToday) _nowLine(current),
          ],
        ),
      ),
    );
  }

  Widget _positioned(CalendarOccurrence occurrence, BuildContext context) {
    final start = occurrence.startsAt.toLocal();
    final end = occurrence.endsAt.toLocal();
    final top = (start.hour + start.minute / 60) * _hourHeight;
    final height = (end.difference(start).inMinutes / 60 * _hourHeight).clamp(
      28.0,
      24 * _hourHeight,
    );

    return Positioned(
      top: top,
      left: _gutterWidth,
      right: 8,
      height: height,
      child: _EventBlock(
        occurrence: occurrence,
        onTap: onOccurrenceTap == null
            ? null
            : () => onOccurrenceTap!(occurrence),
      ),
    );
  }

  Widget _nowLine(DateTime current) {
    final top = (current.hour + current.minute / 60) * _hourHeight;
    return Positioned(
      top: top,
      left: _gutterWidth - 4,
      right: 0,
      child: Row(
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: const BoxDecoration(
              color: AppColors.red,
              shape: BoxShape.circle,
            ),
          ),
          Expanded(child: Container(height: 1.5, color: AppColors.red)),
        ],
      ),
    );
  }
}

class _HourLine extends StatelessWidget {
  const _HourLine({required this.hour});

  final int hour;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: _hourHeight,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: _gutterWidth,
            child: Transform.translate(
              offset: const Offset(0, -6),
              child: Text(
                '${hour.toString().padLeft(2, '0')}:00',
                textAlign: TextAlign.right,
                style: const TextStyle(fontSize: 11, color: AppColors.gray500),
              ),
            ),
          ),
          Expanded(
            child: Container(
              margin: const EdgeInsets.only(left: 8),
              height: 1,
              color: AppColors.gray200,
            ),
          ),
        ],
      ),
    );
  }
}

class _EventBlock extends StatelessWidget {
  const _EventBlock({required this.occurrence, this.onTap});

  final CalendarOccurrence occurrence;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final isBlock = occurrence.kind == CalendarEventKind.personalBlock;
    // A personal block is the rep's own time, not commercial work, and should
    // not compete visually with an interaction.
    final color = isBlock ? AppColors.gray600 : AppColors.navyBright;
    return Material(
      color: color.withValues(alpha: isBlock ? 0.08 : 0.12),
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border(left: BorderSide(color: color, width: 3)),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                occurrence.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: isBlock ? AppColors.gray700 : AppColors.navyDeep,
                ),
              ),
              Text(
                '${occurrence.localStartsAt}–${occurrence.localEndsAt}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 10, color: AppColors.gray500),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
