import 'package:atlasmed_mobile_app/features/roteiro/data/roteiro.dart';
import 'package:atlasmed_mobile_app/features/roteiro/domain/roteiro_schedule.dart';
import 'package:flutter_test/flutter_test.dart';

RoteiroStop _stop({
  required int id,
  required int hour,
  int minutes = 60,
  int travelSeconds = 900,
  String name = 'Clínica',
}) {
  final start = DateTime(2026, 8, 17, hour);
  return RoteiroStop(
    position: id,
    facilityId: id,
    facilityVerticalProfileId: id,
    facilityName: '$name $id',
    bucket: RoteiroBucket.manter,
    modality: RoteiroModality.inPerson,
    serviceMinutes: minutes,
    plannedStartsAt: start,
    plannedEndsAt: start.add(Duration(minutes: minutes)),
    isCoverageSlot: false,
    isAnchor: false,
    reasons: const ['x'],
    travelSecondsFromPrev: travelSeconds,
  );
}

void main() {
  group('buildSchedule', () {
    test('leaves an unedited day exactly as the engine planned it', () {
      final stops = [_stop(id: 1, hour: 9), _stop(id: 2, hour: 11)];

      final schedule = buildSchedule(stops: stops, fixedPoints: const []);

      expect(schedule.stops.map((s) => s.startsAt.hour), [9, 11]);
      expect(schedule.stops.every((s) => !s.edited && !s.shifted), isTrue);
      expect(schedule.hasWarnings, isFalse);
    });

    test(
      'a longer visit pushes everything after it back by the same amount',
      () {
        final stops = [
          _stop(id: 1, hour: 9),
          _stop(id: 2, hour: 11),
          _stop(id: 3, hour: 14),
        ];

        final schedule = buildSchedule(
          stops: stops,
          fixedPoints: const [],
          durationOverrides: const {1: 120},
        );

        expect(schedule.stops[0].durationMinutes, 120);
        // +60 on the first visit moves the two that follow by 60, and no more.
        expect(schedule.stops[1].startsAt.hour, 12);
        expect(schedule.stops[2].startsAt.hour, 15);
        expect(schedule.stops[0].edited, isTrue);
        expect(schedule.stops[1].shifted, isTrue);
      },
    );

    test('a shorter visit pulls the rest of the day forward', () {
      final stops = [_stop(id: 1, hour: 9), _stop(id: 2, hour: 11)];

      final schedule = buildSchedule(
        stops: stops,
        fixedPoints: const [],
        durationOverrides: const {1: 30},
      );

      expect(schedule.stops[1].startsAt.hour, 10);
      expect(schedule.stops[1].startsAt.minute, 30);
    });

    test('moving a stop later moves what follows, and nothing before it', () {
      final stops = [
        _stop(id: 1, hour: 9),
        _stop(id: 2, hour: 11),
        _stop(id: 3, hour: 14),
      ];

      final schedule = buildSchedule(
        stops: stops,
        fixedPoints: const [],
        startOverrides: {2: DateTime(2026, 8, 17, 12)},
      );

      expect(schedule.stops[0].startsAt.hour, 9);
      expect(schedule.stops[0].shifted, isFalse);
      expect(schedule.stops[1].startsAt.hour, 12);
      expect(schedule.stops[2].startsAt.hour, 15);
    });

    test('moving a stop earlier pulls what comes before it earlier too', () {
      final stops = [
        _stop(id: 1, hour: 9),
        _stop(id: 2, hour: 11),
        _stop(id: 3, hour: 14),
      ];

      final schedule = buildSchedule(
        stops: stops,
        fixedPoints: const [],
        startOverrides: {2: DateTime(2026, 8, 17, 10)},
      );

      // The hour has to come from somewhere: the visit before it moves too.
      expect(schedule.stops[0].startsAt.hour, 8);
      expect(schedule.stops[0].shifted, isTrue);
      expect(schedule.stops[1].startsAt.hour, 10);
      // Nothing after needs to move — the day only got roomier.
      expect(schedule.stops[2].startsAt.hour, 14);
    });

    test('warns when an edit runs into something already in the calendar', () {
      final stops = [_stop(id: 1, hour: 9), _stop(id: 2, hour: 11)];
      final booked = RoteiroFixedPoint(
        facilityId: 99,
        facilityName: 'Reunião regional',
        startsAt: DateTime(2026, 8, 17, 12),
        endsAt: DateTime(2026, 8, 17, 13),
      );

      final schedule = buildSchedule(
        stops: stops,
        fixedPoints: [booked],
        durationOverrides: const {1: 120},
      );

      expect(schedule.hasWarnings, isTrue);
      expect(schedule.warnings.first.message, contains('Reunião regional'));
    });

    test('warns when a shift squeezes out the drive between two stops', () {
      final stops = [
        _stop(id: 1, hour: 9),
        // 15 minutes of driving, and only 15 minutes of gap to hold it.
        _stop(id: 2, hour: 10, travelSeconds: 900),
      ];

      final schedule = buildSchedule(
        stops: stops,
        fixedPoints: const [],
        durationOverrides: const {1: 60},
      );

      expect(schedule.hasWarnings, isTrue);
      expect(schedule.warnings.first.message, contains('deslocamento'));
    });

    test('warns when an edit pushes the day past the rep\'s closing time', () {
      // The engine never plans past it. The rep can, by lengthening a visit,
      // and a day that quietly runs to 18:28 is not a plan anyone can keep.
      final stops = [_stop(id: 1, hour: 16), _stop(id: 2, hour: 17)];

      final schedule = buildSchedule(
        stops: stops,
        fixedPoints: const [],
        durationOverrides: const {1: 120},
        workdayEndsAt: DateTime(2026, 8, 17, 18),
      );

      expect(schedule.hasWarnings, isTrue);
      expect(schedule.warnings.any((w) => w.message.contains('19:00')), isTrue);
    });

    test('says nothing when the day still fits', () {
      final stops = [_stop(id: 1, hour: 9), _stop(id: 2, hour: 11)];

      final schedule = buildSchedule(
        stops: stops,
        fixedPoints: const [],
        workdayEndsAt: DateTime(2026, 8, 17, 18),
      );

      expect(schedule.hasWarnings, isFalse);
    });

    test('every offered duration is a whole calendar slot', () {
      // Anything else is rounded up by the calendar and the rep is shown a
      // number their agenda then quietly changes.
      expect(kRoteiroDurationChoices.every((m) => m % 30 == 0), isTrue);
    });
  });
}
