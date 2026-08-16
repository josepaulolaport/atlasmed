import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/day_schedule_picker.dart';
import 'package:atlasmed_mobile_app/features/profile/data/user_preferences.dart';
import 'package:atlasmed_mobile_app/features/profile/presentation/providers/profile_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

final _day = DateTime(2026, 8, 15);

CalendarOccurrence _booking({
  required int hour,
  required int minute,
  required int durationMinutes,
  String title = 'Visita · Clínica Central',
  String occurrenceId = '1:key',
  InteractionStatus status = InteractionStatus.scheduled,
}) {
  final start = DateTime(2026, 8, 15, hour, minute);
  return CalendarOccurrence(
    calendarId: 1,
    occurrenceId: occurrenceId,
    recurrenceKey: '2026-08-15T$hour:$minute[America/Sao_Paulo]',
    kind: CalendarEventKind.interaction,
    title: title,
    owner: const CalendarIdentity(id: 1, name: 'Admin'),
    facility: const CalendarIdentity(id: 9, name: 'Clínica Central'),
    modality: CalendarModality.inPerson,
    startsAt: start,
    endsAt: start.add(Duration(minutes: durationMinutes)),
    localDate: _day,
    localStartsAt: '$hour:$minute',
    localEndsAt: '$hour:$minute',
    recurrence: CalendarRecurrence.none,
    interaction: CalendarInteractionContext(id: 1, status: status),
    canMutate: true,
    durationMinutes: durationMinutes,
  );
}

UserPreferences _prefs({String? workdayStart, String? workdayEnd}) =>
    UserPreferences(
      theme: UserPreferenceTheme.system,
      pushNotificationsEnabled: true,
      emailNotificationsEnabled: true,
      smsNotificationsEnabled: false,
      workdayStart: workdayStart,
      workdayEnd: workdayEnd,
    );

Widget _host({
  required List<CalendarOccurrence> booked,
  required DateTime selected,
  int durationMinutes = 60,
  String? excludeOccurrenceId,
  ValueChanged<DateTime>? onPick,
  DateTime? now,
  UserPreferences? preferences,
}) => ProviderScope(
  overrides: [
    agendaProvider(
      AgendaQuery(from: _day, to: _day.add(const Duration(days: 1))),
    ).overrideWith((ref) async => booked),
    // Never left to the real repository: it would reach for the network and
    // the strip's range would depend on whether the machine had one.
    userPreferencesValueProvider.overrideWith((ref) async => preferences),
  ],
  child: MaterialApp(
    home: Scaffold(
      body: Center(
        child: SizedBox(
          width: 402,
          child: DaySchedulePicker(
            day: _day,
            // Fixed so "already gone" does not depend on when the suite runs.
            now: now ?? DateTime(2026, 8, 15, 6),
            durationMinutes: durationMinutes,
            selectedStartsAt: selected,
            excludeOccurrenceId: excludeOccurrenceId,
            onPick: onPick ?? (_) {},
          ),
        ),
      ),
    ),
  ),
);

/// Scoped to the strip: the legend below it uses the same two words.
Finder _inStrip(String text) => find.descendant(
  of: find.byKey(const Key('day-slot-strip')),
  matching: find.text(text),
);

void main() {
  // The rule the strip paints, tested directly: which slots a new appointment
  // of a given length cannot start at.
  group('clashForSlot', () {
    final booked = [_booking(hour: 17, minute: 0, durationMinutes: 60)];

    test('a slot ending exactly when a booking starts is free', () {
      expect(clashForSlot(DateTime(2026, 8, 15, 16), 60, booked), isNull);
    });

    test('a slot that would run into a booking is taken', () {
      expect(
        clashForSlot(DateTime(2026, 8, 15, 16, 30), 60, booked)?.title,
        'Visita · Clínica Central',
      );
    });

    test('a slot starting inside a booking is taken', () {
      expect(
        clashForSlot(DateTime(2026, 8, 15, 17, 30), 30, booked),
        isNotNull,
      );
    });

    test('a longer appointment takes more slots with it', () {
      // 15:30 is free at 60 minutes and not at 120.
      final start = DateTime(2026, 8, 15, 15, 30);
      expect(clashForSlot(start, 60, booked), isNull);
      expect(clashForSlot(start, 120, booked), isNotNull);
    });

    test('a slot after a booking ends is free', () {
      expect(clashForSlot(DateTime(2026, 8, 15, 18), 60, booked), isNull);
    });
  });

  group('bookedOn', () {
    test(
      'drops the appointment being edited, so it cannot clash with itself',
      () {
        final occurrences = [
          _booking(
            hour: 17,
            minute: 0,
            durationMinutes: 60,
            occurrenceId: '1:being-edited',
          ),
        ];
        expect(
          bookedOn(occurrences, excludeOccurrenceId: '1:being-edited'),
          isEmpty,
        );
        expect(bookedOn(occurrences), hasLength(1));
      },
    );

    test('a cancelled appointment frees its time again', () {
      expect(
        bookedOn([
          _booking(
            hour: 17,
            minute: 0,
            durationMinutes: 60,
            status: InteractionStatus.cancelled,
          ),
        ]),
        isEmpty,
      );
    });

    test('orders by start so the day reads top to bottom', () {
      final ordered = bookedOn([
        _booking(hour: 17, minute: 0, durationMinutes: 60, occurrenceId: 'b'),
        _booking(hour: 9, minute: 0, durationMinutes: 30, occurrenceId: 'a'),
      ]);
      expect(ordered.map((item) => item.occurrenceId), ['a', 'b']);
    });
  });

  // The strip used to hardcode 07:00–20:00 while the roteiro engine and the
  // workday auto-close read the rep's own hours, so a rep who said 06:00 was
  // honoured when planning a day and ignored when picking a time in it.
  group('slotWindowFor', () {
    SlotWindow window({
      String? start,
      String? end,
      DateTime? selected,
      int durationMinutes = 60,
      List<CalendarOccurrence> busy = const [],
    }) => slotWindowFor(
      workdayStart: start,
      workdayEnd: end,
      dayStart: _day,
      selectedStartsAt: selected ?? DateTime(2026, 8, 15, 9),
      durationMinutes: durationMinutes,
      busy: busy,
    );

    test('follows the linha when the rep has said nothing', () {
      final result = window();

      expect(result.workStartMinutes, 8 * 60);
      expect(result.workEndMinutes, 18 * 60);
    });

    test("an early riser's strip starts earlier", () {
      final early = window(start: '06:00', selected: DateTime(2026, 8, 15, 7));
      final late = window(start: '10:00', selected: DateTime(2026, 8, 15, 11));

      expect(early.startMinutes, 5 * 60);
      expect(late.startMinutes, 9 * 60);
    });

    test('offers an hour either side of the working day', () {
      // The hours say when the rep plans to work, not what they may write
      // down: a 07:30 breakfast with a director is a real appointment.
      final result = window(start: '08:00', end: '18:00');

      expect(result.startMinutes, 7 * 60);
      expect(result.endMinutes, 19 * 60);
    });

    test('widens to reach the time being edited', () {
      // Otherwise editing a 06:00 appointment opens a strip that cannot show
      // where the appointment already is.
      final result = window(
        start: '09:00',
        end: '17:00',
        selected: DateTime(2026, 8, 15, 6),
      );

      expect(result.startMinutes, lessThanOrEqualTo(6 * 60));
    });

    test('widens to reach an appointment already booked out of hours', () {
      final result = window(
        start: '09:00',
        end: '17:00',
        busy: [_booking(hour: 20, minute: 0, durationMinutes: 60)],
      );

      expect(result.endMinutes, greaterThanOrEqualTo(21 * 60));
    });

    test('never runs past the end of the day', () {
      final result = window(
        start: '09:00',
        end: '17:00',
        busy: [_booking(hour: 23, minute: 30, durationMinutes: 30)],
      );

      expect(result.endMinutes, lessThanOrEqualTo(23 * 60 + 30));
    });

    test('falls back when the rep stored an end before the start', () {
      // The engine reads the same pair; the strip must not be the one place
      // where 18:00–08:00 quietly means something.
      final result = window(start: '18:00', end: '08:00');

      expect(result.workEndMinutes, 18 * 60);
    });

    test('a half-set day keeps the linha for the other half', () {
      final result = window(start: '06:00');

      expect(result.workStartMinutes, 6 * 60);
      expect(result.workEndMinutes, 18 * 60);
    });

    test('a malformed stored hour is not trusted', () {
      expect(window(start: 'manhã').workStartMinutes, 8 * 60);
      expect(window(start: '25:00').workStartMinutes, 8 * 60);
    });

    test('an appointment that overruns the day is outside it', () {
      // 17:30 is inside the day; a 60-minute appointment starting there is
      // not, and the rep should be told before they save it.
      final result = window(start: '08:00', end: '18:00');

      expect(result.isOutsideHours(17 * 60 + 30, 30), isFalse);
      expect(result.isOutsideHours(17 * 60 + 30, 60), isTrue);
      expect(result.isOutsideHours(7 * 60 + 30, 30), isTrue);
    });
  });

  testWidgets('marks a slot outside the working day without refusing it', (
    tester,
  ) async {
    await tester.pumpWidget(
      _host(
        booked: const [],
        // 17:30 is inside the day, but an hour starting there is not — the
        // strip centres on it, so the marked slots are the ones on screen.
        selected: DateTime(2026, 8, 15, 17, 30),
        preferences: _prefs(workdayStart: '08:00', workdayEnd: '18:00'),
      ),
    );
    await tester.pumpAndSettle();

    expect(_inStrip('fora'), findsWidgets);
  });

  testWidgets("uses the rep's own hours, not a hardcoded 07:00", (tester) async {
    await tester.pumpWidget(
      _host(
        booked: const [],
        selected: DateTime(2026, 8, 15, 11),
        now: DateTime(2026, 8, 14, 18),
        preferences: _prefs(workdayStart: '10:00', workdayEnd: '16:00'),
      ),
    );
    await tester.pumpAndSettle();

    // 09:00 is the margin below a 10:00 start; 07:00 is two hours before it
    // and belongs to nobody's day.
    expect(_inStrip('07:00'), findsNothing);
  });

  testWidgets('does not offer slots that have already gone today', (
    tester,
  ) async {
    // Offering 08:00 at half past eight in the evening fills the strip with
    // times nobody can pick and pushes the ones they can off the end.
    await tester.pumpWidget(
      _host(
        booked: const [],
        selected: DateTime(2026, 8, 15, 19),
        now: DateTime(2026, 8, 15, 18, 15),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('08:00'), findsNothing);
    expect(find.text('19:00'), findsOneWidget);
  });

  testWidgets('offers the whole day when the day is not today', (tester) async {
    // A future day has no past, so nothing is filtered out of it. Selecting the
    // first slot keeps the strip parked at the start, where 07:00 is on screen
    // — it centres on the selection otherwise and scrolls the answer away.
    await tester.pumpWidget(
      _host(
        booked: const [],
        selected: DateTime(2026, 8, 15, 7),
        now: DateTime(2026, 8, 14, 18, 15),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('07:00'), findsOneWidget);
  });

  testWidgets('lists the day\'s appointments with their times', (tester) async {
    await tester.pumpWidget(
      _host(
        booked: [_booking(hour: 14, minute: 30, durationMinutes: 60)],
        selected: DateTime(2026, 8, 15, 9),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Compromissos do dia'), findsOneWidget);
    expect(find.text('14:30–15:30'), findsOneWidget);
    expect(find.text('Visita · Clínica Central'), findsOneWidget);
  });

  testWidgets('an empty day says so, and its slots are free', (tester) async {
    await tester.pumpWidget(
      _host(booked: const [], selected: DateTime(2026, 8, 15, 9)),
    );
    await tester.pumpAndSettle();

    expect(find.text('Nenhum compromisso neste dia.'), findsOneWidget);
    expect(_inStrip('livre'), findsWidgets);
    expect(_inStrip('ocupado'), findsNothing);
  });

  testWidgets('a taken slot is marked, and explains itself when tapped', (
    tester,
  ) async {
    DateTime? picked;
    await tester.pumpWidget(
      _host(
        booked: [_booking(hour: 17, minute: 0, durationMinutes: 60)],
        selected: DateTime(2026, 8, 15, 16),
        onPick: (value) => picked = value,
      ),
    );
    await tester.pumpAndSettle();

    // 17:00 sits beside the centred 16:00 selection, so it is on screen.
    expect(_inStrip('ocupado'), findsWidgets);

    await tester.tap(_inStrip('17:00'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 750));

    expect(picked, isNull, reason: 'a busy slot must not be selected');
    expect(find.textContaining('Ocupado das 17:00 às 18:00'), findsOneWidget);
  });

  testWidgets('warns when the chosen time itself became occupied', (
    tester,
  ) async {
    // 16:00 is free at 60 minutes; at 120 it reaches into the 17:00 visit.
    await tester.pumpWidget(
      _host(
        booked: [_booking(hour: 17, minute: 0, durationMinutes: 60)],
        selected: DateTime(2026, 8, 15, 16),
        durationMinutes: 120,
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.textContaining('O horário escolhido conflita com 17:00–18:00'),
      findsOneWidget,
    );
  });

  testWidgets('no warning when the chosen time is free', (tester) async {
    await tester.pumpWidget(
      _host(
        booked: [_booking(hour: 17, minute: 0, durationMinutes: 60)],
        selected: DateTime(2026, 8, 15, 16),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('conflita com'), findsNothing);
  });

  testWidgets('tapping a free slot picks it', (tester) async {
    DateTime? picked;
    await tester.pumpWidget(
      _host(
        booked: [_booking(hour: 17, minute: 0, durationMinutes: 60)],
        selected: DateTime(2026, 8, 15, 16),
        onPick: (value) => picked = value,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(_inStrip('16:00'));
    await tester.pumpAndSettle();

    expect(picked, DateTime(2026, 8, 15, 16));
  });
}
