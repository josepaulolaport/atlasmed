import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/day_grid_geometry.dart';
import 'package:flutter_test/flutter_test.dart';

final _day = DateTime(2026, 8, 14);

CalendarOccurrence _occurrence({
  required int startHour,
  required int endHour,
  String title = 'CRM',
}) {
  return CalendarOccurrence(
    calendarId: 1,
    occurrenceId: 'occ-$startHour',
    recurrenceKey: '2026-08-14T$startHour:00[America/Sao_Paulo]',
    kind: CalendarEventKind.interaction,
    title: title,
    owner: const CalendarIdentity(id: 1, name: 'Rep'),
    facility: null,
    modality: null,
    startsAt: DateTime(2026, 8, 14, startHour),
    endsAt: DateTime(2026, 8, 14, endHour),
    localDate: _day,
    localStartsAt: '$startHour:00',
    localEndsAt: '$endHour:00',
    recurrence: CalendarRecurrence.none,
    interaction: null,
    canMutate: true,
    timeZone: 'America/Sao_Paulo',
    durationMinutes: (endHour - startHour) * 60,
    version: 1,
  );
}

void main() {
  group('snapping', () {
    test('rounds to the nearest slot rather than flooring', () {
      // Flooring would make the last few pixels of every upward drag do
      // nothing, so a handle could never quite reach the slot above it.
      expect(snapToSlot(44), 30);
      expect(snapToSlot(46), 60);
    });

    test('offset and minutes are inverses at slot boundaries', () {
      for (final minutes in [0, 30, 60, 570, 1410]) {
        expect(minutesFromOffset(offsetFromMinutes(minutes)), minutes);
      }
    });
  });

  group('draftAt', () {
    test('a press makes an hour-long block at that time', () {
      final draft = draftAt(offsetFromMinutes(18 * 60));

      expect(draft.startMinutes, 18 * 60);
      expect(draft.endMinutes, 19 * 60);
    });

    test('a press near midnight still produces a whole appointment', () {
      final draft = draftAt(offsetFromMinutes(23 * 60 + 30));

      expect(draft.endMinutes, 24 * 60);
      expect(draft.durationMinutes, 60);
    });
  });

  group('resizing', () {
    test('dragging the bottom edge shortens the block, start unmoved', () {
      // The 18:00–19:00 to 18:00–18:30 drag from the design.
      const draft = DayGridDraft(startMinutes: 18 * 60, endMinutes: 19 * 60);

      final resized = resizeEnd(draft, offsetFromMinutes(18 * 60 + 30));

      expect(resized.startMinutes, 18 * 60);
      expect(resized.endMinutes, 18 * 60 + 30);
    });

    test('dragging the top edge grows the block upward, end unmoved', () {
      const draft = DayGridDraft(startMinutes: 18 * 60, endMinutes: 19 * 60);

      final resized = resizeStart(draft, offsetFromMinutes(17 * 60));

      expect(resized.startMinutes, 17 * 60);
      expect(resized.endMinutes, 19 * 60);
    });

    test('never collapses below the minimum duration', () {
      const draft = DayGridDraft(startMinutes: 18 * 60, endMinutes: 19 * 60);

      final squashed = resizeEnd(draft, offsetFromMinutes(10 * 60));
      final inverted = resizeStart(draft, offsetFromMinutes(23 * 60));

      expect(squashed.durationMinutes, kMinDurationMinutes);
      expect(inverted.durationMinutes, kMinDurationMinutes);
    });
  });

  group('moveDraft', () {
    test('keeps the length the rep already chose', () {
      // Dragging a block to another hour says nothing about how long it is;
      // resizing it too would answer a question they did not ask.
      const draft = DayGridDraft(startMinutes: 18 * 60, endMinutes: 18 * 60 + 30);

      final moved = moveDraft(draft, offsetFromMinutes(120));

      expect(moved.startMinutes, 20 * 60);
      expect(moved.durationMinutes, 30);
    });

    test('stops at the end of the day instead of running past it', () {
      const draft = DayGridDraft(startMinutes: 23 * 60, endMinutes: 24 * 60);

      final moved = moveDraft(draft, offsetFromMinutes(600));

      expect(moved.endMinutes, 24 * 60);
      expect(moved.durationMinutes, 60);
    });
  });

  group('draftClashes', () {
    final booked = [_occurrence(startHour: 17, endHour: 18)];

    test('a block starting exactly when another ends does not clash', () {
      const draft = DayGridDraft(startMinutes: 18 * 60, endMinutes: 19 * 60);

      expect(draftClashes(draft, _day, booked), isEmpty);
    });

    test('an overlap is reported with what it runs into', () {
      const draft = DayGridDraft(startMinutes: 17 * 60 + 30, endMinutes: 18 * 60 + 30);

      final clashes = draftClashes(draft, _day, booked);

      expect(clashes.single.title, 'CRM');
    });

    test('a block wholly inside another still clashes', () {
      const draft = DayGridDraft(startMinutes: 17 * 60, endMinutes: 17 * 60 + 30);

      expect(draftClashes(draft, _day, booked), hasLength(1));
    });
  });

  test('every draft the grid can produce is a whole calendar slot', () {
    // The API stores half hours; anything else is rounded on save, which is
    // the silent shift the spec forbids.
    final drafts = [
      draftAt(37.4),
      resizeEnd(draftAt(100), 412.9),
      moveDraft(draftAt(200), 91.3),
    ];

    for (final draft in drafts) {
      expect(draft.startMinutes % kSlotMinutes, 0);
      expect(draft.durationMinutes % kSlotMinutes, 0);
    }
  });
}
