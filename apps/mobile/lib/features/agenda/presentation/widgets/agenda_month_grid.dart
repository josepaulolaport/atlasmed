import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';

const _weekdayLabels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/// A horizontally scrolling month picker.
///
/// Months rather than a date-picker dialog: a rep moves between *this* month
/// and the next far more often than they jump to an arbitrary date, and a strip
/// makes that one tap. The year sits inline where it changes, so scrolling past
/// December says so without a separate control.
class AgendaMonthStrip extends StatefulWidget {
  const AgendaMonthStrip({
    super.key,
    required this.selected,
    required this.onSelected,
    this.monthsBefore = 6,
    this.monthsAfter = 12,
  });

  final DateTime selected;
  final ValueChanged<DateTime> onSelected;
  final int monthsBefore;
  final int monthsAfter;

  @override
  State<AgendaMonthStrip> createState() => _AgendaMonthStripState();
}

class _AgendaMonthStripState extends State<AgendaMonthStrip> {
  final _controller = ScrollController();
  bool _centred = false;

  DateTime get selected => widget.selected;
  ValueChanged<DateTime> get onSelected => widget.onSelected;
  int get monthsBefore => widget.monthsBefore;
  int get monthsAfter => widget.monthsAfter;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Brings the month being shown into view.
  ///
  /// The strip starts six months back, so without this it opened on February
  /// while the grid below showed August — the one control that says which month
  /// you are looking at was the one place the answer was missing.
  void _centreOnSelected(int index) {
    if (_centred) return;
    _centred = true;
    // Chips are near enough uniform; the goal is "visible", not pixel-exact.
    const extent = 68.0 + 8.0;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_controller.hasClients) return;
      _controller.jumpTo(
        (index * extent - 80).clamp(0.0, _controller.position.maxScrollExtent),
      );
    });
  }

  static const _short = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ];

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final first = DateTime(now.year, now.month - monthsBefore);
    final months = List.generate(
      monthsBefore + monthsAfter + 1,
      (i) => DateTime(first.year, first.month + i),
    );

    _centreOnSelected(
      months.indexWhere(
        (month) => month.year == selected.year && month.month == selected.month,
      ),
    );

    return SizedBox(
      height: 52,
      child: ListView.separated(
        controller: _controller,
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        itemCount: months.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (_, index) {
          final month = months[index];
          final isSelected =
              month.year == selected.year && month.month == selected.month;
          final startsYear = month.month == 1 || index == 0;
          return Row(
            children: [
              if (startsYear)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: Text(
                    '${month.year}',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.gray500,
                    ),
                  ),
                ),
              GestureDetector(
                onTap: () => onSelected(month),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 18,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? AppColors.navyBright
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: isSelected
                          ? AppColors.navyBright
                          : AppColors.gray300,
                    ),
                  ),
                  child: Text(
                    _short[month.month - 1],
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: isSelected ? Colors.white : AppColors.gray700,
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// The month as a grid of days, each showing what is on it.
///
/// Tapping a day opens that day's hour grid — the month answers "how is my
/// month shaped", the day answers "what am I doing and when".
class AgendaMonthGrid extends StatelessWidget {
  const AgendaMonthGrid({
    super.key,
    required this.month,
    required this.occurrences,
    required this.onDayTap,
    this.today,
  });

  final DateTime month;
  final List<CalendarOccurrence> occurrences;
  final ValueChanged<DateTime> onDayTap;
  final DateTime? today;

  @override
  Widget build(BuildContext context) {
    final now = today ?? DateTime.now();
    final firstOfMonth = DateTime(month.year, month.month);
    // Sunday-first, matching the weekday labels.
    final leading = firstOfMonth.weekday % 7;
    final gridStart = firstOfMonth.subtract(Duration(days: leading));

    final byDay = <String, List<CalendarOccurrence>>{};
    for (final occurrence in occurrences) {
      final key = _key(occurrence.localDate);
      byDay.putIfAbsent(key, () => []).add(occurrence);
    }

    return Column(
      children: [
        Row(
          children: [
            for (final label in _weekdayLabels)
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    label,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray500,
                    ),
                  ),
                ),
              ),
          ],
        ),
        Expanded(
          child: GridView.builder(
            padding: EdgeInsets.zero,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              childAspectRatio: 0.62,
            ),
            itemCount: 42,
            itemBuilder: (_, index) {
              final day = gridStart.add(Duration(days: index));
              final inMonth = day.month == month.month;
              final isToday = _key(day) == _key(now);
              return _DayCell(
                day: day,
                inMonth: inMonth,
                isToday: isToday,
                occurrences: byDay[_key(day)] ?? const [],
                onTap: () => onDayTap(day),
              );
            },
          ),
        ),
      ],
    );
  }

  static String _key(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}

class _DayCell extends StatelessWidget {
  const _DayCell({
    required this.day,
    required this.inMonth,
    required this.isToday,
    required this.occurrences,
    required this.onTap,
  });

  final DateTime day;
  final bool inMonth;
  final bool isToday;
  final List<CalendarOccurrence> occurrences;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        decoration: const BoxDecoration(
          border: Border(
            top: BorderSide(color: AppColors.gray200),
            left: BorderSide(color: AppColors.gray200),
          ),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 24,
                height: 24,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: isToday ? AppColors.navyBright : Colors.transparent,
                  shape: BoxShape.circle,
                ),
                child: Text(
                  '${day.day}',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: isToday ? FontWeight.w700 : FontWeight.w500,
                    color: isToday
                        ? Colors.white
                        : inMonth
                        ? AppColors.gray900
                        : AppColors.gray400,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 2),
            // Two chips then a count. A cell tall enough for every event would
            // make the month unreadable, and the month's job is shape, not
            // detail — the day view carries the detail.
            for (final occurrence in occurrences.take(2))
              Padding(
                padding: const EdgeInsets.only(bottom: 2),
                child: _EventChip(occurrence: occurrence),
              ),
            if (occurrences.length > 2)
              Text(
                '+${occurrences.length - 2}',
                style: const TextStyle(fontSize: 9, color: AppColors.gray500),
              ),
          ],
        ),
      ),
    );
  }
}

class _EventChip extends StatelessWidget {
  const _EventChip({required this.occurrence});

  final CalendarOccurrence occurrence;

  @override
  Widget build(BuildContext context) {
    final isBlock = occurrence.kind == CalendarEventKind.personalBlock;
    final color = isBlock ? AppColors.gray500 : AppColors.navyBright;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 1),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(3),
      ),
      child: Text(
        occurrence.title,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: 9,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}
