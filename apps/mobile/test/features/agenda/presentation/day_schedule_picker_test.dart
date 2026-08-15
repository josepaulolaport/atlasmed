import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/day_schedule_picker.dart';
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

Widget _host({
  required List<CalendarOccurrence> booked,
  required DateTime selected,
  int durationMinutes = 60,
  String? excludeOccurrenceId,
  ValueChanged<DateTime>? onPick,
}) => ProviderScope(
  overrides: [
    agendaProvider(
      AgendaQuery(from: _day, to: _day.add(const Duration(days: 1))),
    ).overrideWith((ref) async => booked),
  ],
  child: MaterialApp(
    home: Scaffold(
      body: Center(
        child: SizedBox(
          width: 402,
          child: DaySchedulePicker(
            day: _day,
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
