import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/day_grid_geometry.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';

const _hourHeight = kHourHeight;
const _gutterWidth = kGutterWidth;

/// How far a handle reaches beyond its edge. Bigger than it looks, because a
/// 6px target is a target nobody hits on a moving bus.
const _handleTouchRadius = 22.0;

/// One day as an hour grid, with events laid out where they actually fall.
///
/// A list of events tells a rep what they have; a grid tells them what they can
/// still fit — which is the question this screen exists to answer, and the one
/// the roteiro needs them to have an opinion about.
class AgendaDayGrid extends StatefulWidget {
  const AgendaDayGrid({
    super.key,
    required this.day,
    required this.occurrences,
    this.onOccurrenceTap,
    this.now,
    this.draft,
    this.onDraftStarted,
    this.onDraftChanged,
  });

  final DateTime day;
  final List<CalendarOccurrence> occurrences;
  final ValueChanged<CalendarOccurrence>? onOccurrenceTap;
  final DateTime? now;

  /// The block the rep is drawing, if any. Owned by the screen rather than the
  /// grid: the sheet below has to name and save the same one.
  final DayGridDraft? draft;

  /// A press on empty grid. Null makes the grid read-only, which is what
  /// looking at somebody else's day should be.
  final ValueChanged<DayGridDraft>? onDraftStarted;
  final ValueChanged<DayGridDraft>? onDraftChanged;

  @override
  State<AgendaDayGrid> createState() => _AgendaDayGridState();
}

class _AgendaDayGridState extends State<AgendaDayGrid> {
  final _controller = ScrollController();
  bool _openedOnTheDay = false;

  DateTime get day => widget.day;
  List<CalendarOccurrence> get occurrences => widget.occurrences;
  ValueChanged<CalendarOccurrence>? get onOccurrenceTap =>
      widget.onOccurrenceTap;
  DayGridDraft? get draft => widget.draft;
  ValueChanged<DayGridDraft>? get onDraftStarted => widget.onDraftStarted;
  ValueChanged<DayGridDraft>? get onDraftChanged => widget.onDraftChanged;

  @override
  void didUpdateWidget(covariant AgendaDayGrid oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Only when a block first appears. Doing it on every change would fight the
    // rep's own drag, scrolling the grid out from under the handle they are
    // holding.
    if (oldWidget.draft == null && widget.draft != null) {
      _revealDraft(widget.draft!);
    }
  }

  /// Brings a new block above the sheet that opens under it.
  ///
  /// The sheet takes roughly the bottom third of the screen, so a block drawn
  /// low on the grid is covered the instant it is created — the rep is asked to
  /// name something they can no longer see, and the handles they would drag are
  /// behind a form.
  void _revealDraft(DayGridDraft draft) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_controller.hasClients) return;
      final viewport = _controller.position.viewportDimension;
      final target = offsetFromMinutes(draft.startMinutes) - viewport * 0.25;
      _controller.animateTo(
        target.clamp(0.0, _controller.position.maxScrollExtent),
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Opens on the part of the day that has something in it.
  ///
  /// The grid is 24 hours tall and the working day is a third of that, so
  /// landing at midnight costs a scroll every single time it is opened. The
  /// first appointment wins when there is one — that is what the rep came to
  /// look at — otherwise the current hour, and 07:00 on a day with neither.
  void _openOnTheDay() {
    if (_openedOnTheDay) return;
    _openedOnTheDay = true;

    final current = widget.now ?? DateTime.now();
    final isToday =
        current.year == day.year &&
        current.month == day.month &&
        current.day == day.day;
    final firstEvent = occurrences.isEmpty
        ? null
        : occurrences
              .map((o) => o.startsAt.toLocal())
              .reduce((a, b) => a.isBefore(b) ? a : b);
    final focus = firstEvent ?? (isToday ? current : null);
    final hour = ((focus?.hour ?? 7) - 1).clamp(0, 23);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_controller.hasClients) return;
      _controller.jumpTo(
        (hour * _hourHeight).clamp(0.0, _controller.position.maxScrollExtent),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    _openOnTheDay();
    final current = widget.now ?? DateTime.now();
    final isToday =
        current.year == day.year &&
        current.month == day.month &&
        current.day == day.day;

    final active = draft;

    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        controller: _controller,
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
              // Below the events: a press lands on the canvas, but tapping an
              // appointment must still open it rather than draw over it.
              if (onDraftStarted != null)
                Positioned.fill(
                  left: _gutterWidth,
                  child: GestureDetector(
                    behavior: HitTestBehavior.translucent,
                    // Long-press rather than tap: the grid scrolls, and a plain
                    // tap would plant a block every time a scroll ended early.
                    onLongPressStart: (details) =>
                        onDraftStarted!(draftAt(details.localPosition.dy)),
                  ),
                ),
              for (final lane in layOutOverlaps(occurrences))
                _positioned(lane, context, constraints.maxWidth),
              if (active != null) _draftBlock(active),
              if (isToday) _nowLine(current),
            ],
          ),
        ),
      ),
    );
  }

  /// The block being drawn, with a handle at each end.
  ///
  /// Coloured by whether it runs into anything: the API refuses a clash on
  /// save, so learning about it while dragging is the difference between a
  /// choice and a rejection.
  Widget _draftBlock(DayGridDraft active) {
    final clashes = draftClashes(active, day, occurrences);
    final colour = clashes.isEmpty ? AppColors.navyBright : AppColors.amber;
    final top = offsetFromMinutes(active.startMinutes);
    final height = offsetFromMinutes(active.durationMinutes);

    return Positioned(
      top: top - _handleTouchRadius,
      left: _gutterWidth,
      right: 8,
      height: height + _handleTouchRadius * 2,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            top: _handleTouchRadius,
            left: 0,
            right: 0,
            height: height,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onVerticalDragUpdate: onDraftChanged == null
                  ? null
                  : (details) =>
                        onDraftChanged!(moveDraft(active, details.delta.dy)),
              child: Container(
                decoration: BoxDecoration(
                  color: colour.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: colour, width: 1.5),
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                child: Align(
                  alignment: Alignment.topLeft,
                  child: Text(
                    clashes.isEmpty
                        ? '${formatSlot(active.startMinutes)}–${formatSlot(active.endMinutes)}'
                        : 'Conflita com ${clashes.first.title}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: clashes.isEmpty
                          ? AppColors.navyDeep
                          : AppColors.amber,
                    ),
                  ),
                ),
              ),
            ),
          ),
          _handle(
            centreY: _handleTouchRadius,
            colour: colour,
            onDrag: (dy) => resizeStart(active, top + dy),
          ),
          _handle(
            centreY: _handleTouchRadius + height,
            colour: colour,
            onDrag: (dy) => resizeEnd(active, top + dy),
          ),
        ],
      ),
    );
  }

  Widget _handle({
    required double centreY,
    required Color colour,
    required DayGridDraft Function(double localDy) onDrag,
  }) {
    return Positioned(
      top: centreY - _handleTouchRadius,
      left: -_handleTouchRadius / 2,
      height: _handleTouchRadius * 2,
      width: _handleTouchRadius * 2,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onVerticalDragUpdate: onDraftChanged == null
            ? null
            : (details) {
                // The handle's own box is the frame of reference; the draft
                // maths works in grid coordinates, so the press is converted
                // back before it is used.
                final gridDy = details.localPosition.dy - _handleTouchRadius;
                onDraftChanged!(onDrag(centreY - _handleTouchRadius + gridDy));
              },
        child: Center(
          child: Container(
            width: 14,
            height: 14,
            decoration: BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              border: Border.all(color: colour, width: 3),
            ),
          ),
        ),
      ),
    );
  }

  Widget _positioned(DayGridLane lane, BuildContext context, double width) {
    final occurrence = lane.occurrence;
    final start = occurrence.startsAt.toLocal();
    final end = occurrence.endsAt.toLocal();
    final top = (start.hour + start.minute / 60) * _hourHeight;
    final height = (end.difference(start).inMinutes / 60 * _hourHeight).clamp(
      28.0,
      24 * _hourHeight,
    );

    // Overlapping appointments share the width rather than hiding each other.
    final available = width - _gutterWidth - 8;
    final columnWidth = available / lane.columns;

    return Positioned(
      top: top,
      left: _gutterWidth + lane.column * columnWidth,
      width: columnWidth - (lane.columns > 1 ? 2 : 0),
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
