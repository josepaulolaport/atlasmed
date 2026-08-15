import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// First and last slot offered, in minutes from midnight, and the step between
/// them. 07:00–20:00 in half hours, which is the granularity the API accepts
/// for durations.
const _dayStartMinutes = 7 * 60;
const _dayEndMinutes = 20 * 60;
const _slotMinutes = 30;

/// What the day already holds, and which times are still free for it.
///
/// Saving into an occupied slot is refused by the API with a conflict, and the
/// rep had no way to see that coming — they picked a time, pressed save, and
/// were told the slot was unavailable with no indication of which ones were.
/// This shows the day's appointments and marks every slot the new one would
/// collide with, so the choice is made with the answer in view.
class DaySchedulePicker extends ConsumerStatefulWidget {
  const DaySchedulePicker({
    super.key,
    required this.day,
    required this.durationMinutes,
    required this.selectedStartsAt,
    required this.onPick,
    this.excludeOccurrenceId,
  });

  /// Local day being scheduled into.
  final DateTime day;
  final int durationMinutes;
  final DateTime selectedStartsAt;
  final ValueChanged<DateTime> onPick;

  /// The appointment being edited, which must not count as a clash with itself.
  final String? excludeOccurrenceId;

  @override
  ConsumerState<DaySchedulePicker> createState() => _DaySchedulePickerState();
}

class _DaySchedulePickerState extends ConsumerState<DaySchedulePicker> {
  final _slotsController = ScrollController();
  bool _centredOnSelection = false;

  @override
  void dispose() {
    _slotsController.dispose();
    super.dispose();
  }

  /// Brings the chosen slot into view once the strip has been laid out. Without
  /// it an afternoon appointment opens showing 07:00 and looks empty.
  ///
  /// The scroll is deferred rather than guarded on `hasClients` here: when the
  /// day's appointments are already cached the list is built in this very
  /// frame, so the controller has no clients yet and the check would skip the
  /// only chance to scroll — leaving the strip parked at 07:00.
  void _centreOnSelection() {
    if (_centredOnSelection) return;
    _centredOnSelection = true;
    final index =
        (_minutesOf(widget.selectedStartsAt) - _dayStartMinutes) ~/
        _slotMinutes;
    if (index <= 0) return;
    const slotExtent = 76.0 + 8.0;
    final target = (index * slotExtent) - 80;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_slotsController.hasClients) return;
      _slotsController.jumpTo(
        target.clamp(0, _slotsController.position.maxScrollExtent),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final dayStart = DateTime(
      widget.day.year,
      widget.day.month,
      widget.day.day,
    );
    final query = AgendaQuery(
      from: dayStart,
      to: dayStart.add(const Duration(days: 1)),
    );

    return ref
        .watch(agendaProvider(query))
        .when(
          loading: () => const _ScheduleShell(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 18),
              child: Center(
                child: SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            ),
          ),
          error: (_, _) => _ScheduleShell(
            child: Row(
              children: [
                const Expanded(
                  child: Text(
                    'Não foi possível carregar os compromissos do dia.',
                    style: TextStyle(fontSize: 12.5, color: AppColors.gray500),
                  ),
                ),
                // Not "Tentar novamente": the save button below can offer that
                // too, and two identical retries on one screen say nothing
                // about which one you are pressing.
                TextButton(
                  onPressed: () => ref.invalidate(agendaProvider(query)),
                  child: const Text('Recarregar dia'),
                ),
              ],
            ),
          ),
          data: (occurrences) {
            final busy = bookedOn(
              occurrences,
              excludeOccurrenceId: widget.excludeOccurrenceId,
            );

            _centreOnSelection();

            return _ScheduleShell(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _Header(count: busy.length),
                  const SizedBox(height: 10),
                  if (busy.isEmpty)
                    const Text(
                      'Nenhum compromisso neste dia.',
                      style: TextStyle(
                        fontSize: 12.5,
                        color: AppColors.gray500,
                      ),
                    )
                  else
                    _BusyList(occurrences: busy),
                  const SizedBox(height: 14),
                  _SlotStrip(
                    controller: _slotsController,
                    dayStart: dayStart,
                    durationMinutes: widget.durationMinutes,
                    selectedStartsAt: widget.selectedStartsAt,
                    busy: busy,
                    onPick: widget.onPick,
                  ),
                  const SizedBox(height: 10),
                  const _Legend(),
                  // The chosen time can become occupied without being touched —
                  // lengthening the appointment is enough — so say it here
                  // rather than letting the save fail with a conflict.
                  ?_selectionWarning(
                    clashForSlot(
                      widget.selectedStartsAt,
                      widget.durationMinutes,
                      busy,
                    ),
                  ),
                ],
              ),
            );
          },
        );
  }
}

/// What actually occupies the day, in order.
///
/// A cancelled appointment frees its time again, and the one being edited must
/// not count as a clash with itself — rescheduling it by ten minutes would
/// otherwise collide with where it already is.
List<CalendarOccurrence> bookedOn(
  List<CalendarOccurrence> occurrences, {
  String? excludeOccurrenceId,
}) =>
    occurrences
        .where((item) => item.occurrenceId != excludeOccurrenceId)
        .where(
          (item) => item.interaction?.status != InteractionStatus.cancelled,
        )
        .toList(growable: false)
      ..sort((a, b) => a.startsAt.compareTo(b.startsAt));

Widget? _selectionWarning(CalendarOccurrence? clash) {
  if (clash == null) return null;
  return Padding(
    padding: const EdgeInsets.only(top: 10),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.warning_amber_rounded, size: 15, color: AppColors.red),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            'O horário escolhido conflita com '
            '${_hhmm(clash.startsAt.toLocal())}–'
            '${_hhmm(clash.endsAt.toLocal())} ${clash.title}.',
            style: const TextStyle(
              fontSize: 11.5,
              height: 1.3,
              color: AppColors.red,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    ),
  );
}

int _minutesOf(DateTime value) => value.hour * 60 + value.minute;

String _hhmm(DateTime value) =>
    '${value.hour.toString().padLeft(2, '0')}:'
    '${value.minute.toString().padLeft(2, '0')}';

/// The appointment [start] + [durationMinutes] would run into, if any.
///
/// This is the whole rule the strip paints: a slot is red when a new
/// appointment *of the chosen length* starting there would overlap something,
/// which is not the same as the slot itself being booked — at 120 minutes a
/// free 15:30 still reaches into a 17:00 visit.
CalendarOccurrence? clashForSlot(
  DateTime start,
  int durationMinutes,
  List<CalendarOccurrence> busy,
) {
  final end = start.add(Duration(minutes: durationMinutes));
  for (final item in busy) {
    final itemStart = item.startsAt.toLocal();
    final itemEnd = item.endsAt.toLocal();
    if (start.isBefore(itemEnd) && end.isAfter(itemStart)) return item;
  }
  return null;
}

class _ScheduleShell extends StatelessWidget {
  const _ScheduleShell({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
    decoration: BoxDecoration(
      color: AppColors.surfaceTertiary,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: AppColors.surfaceSecondary),
    ),
    child: child,
  );
}

class _Header extends StatelessWidget {
  const _Header({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      const Icon(Icons.event_note_rounded, size: 16, color: AppColors.gray500),
      const SizedBox(width: 8),
      const Expanded(
        child: Text(
          'Compromissos do dia',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: AppColors.gray700,
            letterSpacing: 0.2,
          ),
        ),
      ),
      Text(
        count == 0 ? 'livre' : '$count',
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: AppColors.gray500,
        ),
      ),
    ],
  );
}

class _BusyList extends StatelessWidget {
  const _BusyList({required this.occurrences});

  final List<CalendarOccurrence> occurrences;

  @override
  Widget build(BuildContext context) {
    // Caps at roughly three rows and scrolls past that, so a full day cannot
    // push the time picker off the screen.
    return ConstrainedBox(
      constraints: const BoxConstraints(maxHeight: 132),
      child: ListView.separated(
        shrinkWrap: true,
        padding: EdgeInsets.zero,
        itemCount: occurrences.length,
        separatorBuilder: (_, _) => const SizedBox(height: 6),
        itemBuilder: (_, index) {
          final item = occurrences[index];
          final start = item.startsAt.toLocal();
          final end = item.endsAt.toLocal();
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 3,
                height: 30,
                decoration: BoxDecoration(
                  color: AppColors.red,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(width: 10),
              SizedBox(
                width: 88,
                child: Text(
                  '${_hhmm(start)}–${_hhmm(end)}',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.gray700,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
              ),
              Expanded(
                child: Text(
                  item.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: AppColors.gray900,
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

class _SlotStrip extends StatelessWidget {
  const _SlotStrip({
    required this.controller,
    required this.dayStart,
    required this.durationMinutes,
    required this.selectedStartsAt,
    required this.busy,
    required this.onPick,
  });

  final ScrollController controller;
  final DateTime dayStart;
  final int durationMinutes;
  final DateTime selectedStartsAt;
  final List<CalendarOccurrence> busy;
  final ValueChanged<DateTime> onPick;

  @override
  Widget build(BuildContext context) {
    final slots = <DateTime>[
      for (var m = _dayStartMinutes; m <= _dayEndMinutes; m += _slotMinutes)
        dayStart.add(Duration(minutes: m)),
    ];
    final selectedMinutes = _minutesOf(selectedStartsAt);

    return SizedBox(
      height: 52,
      child: ListView.separated(
        key: const Key('day-slot-strip'),
        controller: controller,
        scrollDirection: Axis.horizontal,
        padding: EdgeInsets.zero,
        itemCount: slots.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final slot = slots[index];
          final clash = clashForSlot(slot, durationMinutes, busy);
          final selected = _minutesOf(slot) == selectedMinutes;
          return _Slot(
            label: _hhmm(slot),
            taken: clash != null,
            selected: selected,
            // A taken slot stays tappable, but says what is in the way instead
            // of accepting the time and failing on save.
            onTap: () {
              if (clash == null) {
                onPick(slot);
                return;
              }
              ScaffoldMessenger.of(context)
                ..hideCurrentSnackBar()
                ..showSnackBar(
                  SnackBar(
                    behavior: SnackBarBehavior.floating,
                    content: Text(
                      'Ocupado das ${_hhmm(clash.startsAt.toLocal())} '
                      'às ${_hhmm(clash.endsAt.toLocal())}: ${clash.title}',
                    ),
                  ),
                );
            },
          );
        },
      ),
    );
  }
}

class _Slot extends StatelessWidget {
  const _Slot({
    required this.label,
    required this.taken,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool taken;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final background = selected
        ? AppColors.navyBright
        : taken
        ? AppColors.red50
        : Colors.white;
    final border = selected
        ? AppColors.navyBright
        : taken
        ? AppColors.red100
        : AppColors.gray200;
    final foreground = selected
        ? Colors.white
        : taken
        ? AppColors.red
        : AppColors.gray700;

    return Semantics(
      button: true,
      selected: selected,
      label: taken ? '$label, ocupado' : '$label, livre',
      child: Material(
        color: background,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(10),
          child: Container(
            width: 76,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: border),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: foreground,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  taken ? 'ocupado' : 'livre',
                  style: TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.2,
                    color: selected
                        ? Colors.white.withValues(alpha: 0.85)
                        : taken
                        ? AppColors.red.withValues(alpha: 0.85)
                        : AppColors.gray400,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend();

  @override
  Widget build(BuildContext context) => const Row(
    children: [
      _LegendDot(
        color: Colors.white,
        border: AppColors.gray200,
        label: 'livre',
      ),
      SizedBox(width: 12),
      _LegendDot(
        color: AppColors.red50,
        border: AppColors.red100,
        label: 'ocupado',
      ),
      SizedBox(width: 12),
      _LegendDot(
        color: AppColors.navyBright,
        border: AppColors.navyBright,
        label: 'escolhido',
      ),
    ],
  );
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({
    required this.color,
    required this.border,
    required this.label,
  });

  final Color color;
  final Color border;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(3),
          border: Border.all(color: border),
        ),
      ),
      const SizedBox(width: 5),
      Text(
        label,
        style: const TextStyle(fontSize: 11, color: AppColors.gray500),
      ),
    ],
  );
}
