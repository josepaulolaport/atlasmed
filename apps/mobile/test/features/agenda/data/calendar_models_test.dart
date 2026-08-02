import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('CalendarOccurrence', () {
    test('parses interaction calendar DTO and local display values', () {
      final occurrence = CalendarOccurrence.fromJson({
        'id': 'calendar-1',
        'occurrenceId': 'calendar-1:2026-08-03T09:00[America/Sao_Paulo]',
        'recurrenceKey': '2026-08-03T09:00[America/Sao_Paulo]',
        'kind': 'INTERACTION',
        'title': 'Visita de acompanhamento',
        'owner': {'id': 'user-1', 'name': 'Ana Souza'},
        'facility': {'id': 'facility-1', 'name': 'Clínica Central'},
        'modality': 'IN_PERSON',
        'startsAt': '2026-08-03T12:00:00.000Z',
        'endsAt': '2026-08-03T13:00:00.000Z',
        'localDate': '2026-08-03',
        'localStartsAt': '09:00',
        'localEndsAt': '10:00',
        'recurrence': 'WEEKLY',
        'interaction': {'id': 'interaction-1', 'status': 'SCHEDULED'},
        'canMutate': true,
      });

      expect(occurrence.kind, CalendarEventKind.interaction);
      expect(occurrence.occurrenceId, contains('calendar-1:'));
      expect(occurrence.owner.name, 'Ana Souza');
      expect(occurrence.facility?.name, 'Clínica Central');
      expect(occurrence.modality, CalendarModality.inPerson);
      expect(occurrence.startsAt.isUtc, isTrue);
      expect(occurrence.localDate, DateTime(2026, 8, 3));
      expect(occurrence.localStartsAt, '09:00');
      expect(occurrence.recurrence, CalendarRecurrence.weekly);
      expect(occurrence.interaction?.status, InteractionStatus.scheduled);
      expect(occurrence.canMutate, isTrue);
      expect(occurrence.dayLabel, 'segunda-feira, 3 de agosto');
    });

    test('parses redacted manager personal block without private context', () {
      final occurrence = CalendarOccurrence.fromJson({
        'id': 'calendar-2',
        'occurrenceId': 'calendar-2:2026-08-04T14:00[America/Sao_Paulo]',
        'recurrenceKey': '2026-08-04T14:00[America/Sao_Paulo]',
        'kind': 'PERSONAL_BLOCK',
        'title': 'Indisponível',
        'owner': {'id': 'user-2', 'name': 'Bruno Lima'},
        'facility': null,
        'modality': null,
        'startsAt': '2026-08-04T17:00:00.000Z',
        'endsAt': '2026-08-04T17:30:00.000Z',
        'localDate': '2026-08-04',
        'localStartsAt': '14:00',
        'localEndsAt': '14:30',
        'recurrence': 'NONE',
        'interaction': null,
        'canMutate': false,
      });

      expect(occurrence.kind, CalendarEventKind.personalBlock);
      expect(occurrence.title, 'Indisponível');
      expect(occurrence.facility, isNull);
      expect(occurrence.interaction, isNull);
      expect(occurrence.canMutate, isFalse);
    });
  });

  test('groups and sorts occurrences by local day and local start time', () {
    CalendarOccurrence occurrence(String id, String localDate, String time) =>
        CalendarOccurrence.fromJson({
          'id': id,
          'occurrenceId': '$id:$localDate-$time',
          'recurrenceKey': '$localDate-${time.replaceAll(':', '')}',
          'kind': 'PERSONAL_BLOCK',
          'title': id,
          'owner': {'id': 'user-1', 'name': 'Ana'},
          'facility': null,
          'modality': null,
          'startsAt': '${localDate}T${time}:00.000Z',
          'endsAt': '${localDate}T${time}:30.000Z',
          'localDate': localDate,
          'localStartsAt': time,
          'localEndsAt': time,
          'recurrence': 'NONE',
          'interaction': null,
          'canMutate': true,
        });

    final sections = groupCalendarOccurrences([
      occurrence('late', '2026-08-04', '16:00'),
      occurrence('second', '2026-08-03', '11:00'),
      occurrence('first', '2026-08-03', '08:30'),
    ]);

    expect(sections.map((section) => section.date), [
      DateTime(2026, 8, 3),
      DateTime(2026, 8, 4),
    ]);
    expect(sections.first.items.map((item) => item.title), ['first', 'second']);
  });
}
