import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('CalendarOccurrence', () {
    test('parses live API list DTO where id is the occurrence key string', () {
      final occurrence = CalendarOccurrence.fromJson({
        'id': '1:2026-08-17T12:00[America/Sao_Paulo]',
        'calendarId': 1,
        'recurrenceKey': '2026-08-17T12:00[America/Sao_Paulo]',
        'ownerUserId': 6,
        'kind': 'PERSONAL_BLOCK',
        'title': 'Alomoco',
        'startsAt': '2026-08-17T15:00:00.000Z',
        'endsAt': '2026-08-17T16:00:00.000Z',
        'timeZone': 'America/Sao_Paulo',
        'durationMinutes': 60,
        'recurrence': 'DAILY',
        'version': 1,
        'calendarVersion': 1,
        'owner': {'id': 6, 'name': 'Admin Local'},
        'facility': null,
        'canMutate': true,
      });

      expect(occurrence.occurrenceId, '1:2026-08-17T12:00[America/Sao_Paulo]');
      expect(occurrence.calendarId, 1);
      expect(occurrence.recurrenceKey, '2026-08-17T12:00[America/Sao_Paulo]');
      expect(occurrence.kind, CalendarEventKind.personalBlock);
      expect(occurrence.owner.id, 6);
      expect(occurrence.owner.name, 'Admin Local');
      expect(occurrence.facility, isNull);
      expect(occurrence.canMutate, isTrue);
    });

    test(
      'parses the canonical Calendar API list DTO without invented local fields',
      () {
        final occurrence = CalendarOccurrence.fromJson({
          'id': 1,
          'occurrenceId': '1:2026-08-03T09:00[America/Sao_Paulo]',
          'calendarId': 1,
          'ownerUserId': 1,
          'kind': 'INTERACTION',
          'title': 'Visita de acompanhamento',
          'startsAt': '2026-08-03T12:00:00.000Z',
          'endsAt': '2026-08-03T13:00:00.000Z',
          'interaction': {
            'id': 1,
            'facilityId': 1,
            'agentUserId': 1,
            'modality': 'IN_PERSON',
            'status': 'SCHEDULED',
          },
          'owner': {'id': 1, 'displayName': 'Ana Souza'},
          'facility': {'id': 1, 'displayName': 'Clínica Central'},
        });
        final localStart = DateTime.parse('2026-08-03T12:00:00.000Z').toLocal();
        final localEnd = DateTime.parse('2026-08-03T13:00:00.000Z').toLocal();

        expect(occurrence.kind, CalendarEventKind.interaction);
        expect(occurrence.occurrenceId, contains('1:'));
        expect(occurrence.owner.id, 1);
        expect(occurrence.owner.name, 'Ana Souza');
        expect(occurrence.facility?.name, 'Clínica Central');
        expect(occurrence.modality, CalendarModality.inPerson);
        expect(occurrence.startsAt.isUtc, isTrue);
        expect(
          occurrence.localDate,
          DateTime(localStart.year, localStart.month, localStart.day),
        );
        expect(
          occurrence.localStartsAt,
          '${localStart.hour.toString().padLeft(2, '0')}:${localStart.minute.toString().padLeft(2, '0')}',
        );
        expect(
          occurrence.localEndsAt,
          '${localEnd.hour.toString().padLeft(2, '0')}:${localEnd.minute.toString().padLeft(2, '0')}',
        );
        expect(occurrence.recurrence, CalendarRecurrence.none);
        expect(occurrence.interaction?.facilityId, 1);
        expect(occurrence.interaction?.agentUserId, 1);
        expect(occurrence.interaction?.status, InteractionStatus.scheduled);
        expect(occurrence.canMutate, isFalse);
      },
    );

    test(
      'parses enriched recurrence bounds, versions and mutation metadata',
      () {
        final occurrence = CalendarOccurrence.fromJson({
          'id': 1,
          'calendarId': 1,
          'occurrenceId': '1:key-1',
          'recurrenceKey': 'key-1',
          'kind': 'INTERACTION',
          'title': 'Interação de acompanhamento',
          'startsAt': '2026-08-03T12:00:00.000Z',
          'endsAt': '2026-08-03T13:00:00.000Z',
          'timeZone': 'America/Sao_Paulo',
          'durationMinutes': 60,
          'recurrence': 'WEEKLY',
          'recurrenceUntil': '2026-10-01',
          'recurrenceCount': null,
          'version': 4,
          'overrideVersion': 2,
          'canMutate': true,
          'owner': {'id': 1, 'displayName': 'Ana Souza'},
          'facility': {'id': 1, 'name': 'Clínica Central'},
          'interaction': {
            'id': 1,
            'facilityId': 1,
            'agentUserId': 1,
            'modality': 'REMOTE',
            'status': 'SCHEDULED',
          },
        });

        expect(occurrence.recurrence, CalendarRecurrence.weekly);
        expect(occurrence.recurrenceUntil, '2026-10-01');
        expect(occurrence.recurrenceCount, isNull);
        expect(occurrence.version, 4);
        expect(occurrence.overrideVersion, 2);
        expect(occurrence.canMutate, isTrue);
        expect(occurrence.owner.name, 'Ana Souza');
        expect(occurrence.facility?.name, 'Clínica Central');
        expect(occurrence.modality, CalendarModality.remote);
      },
    );

    test('falls back to canonical ids when display enrichment is absent', () {
      final occurrence = CalendarOccurrence.fromJson({
        'id': 2,
        'occurrenceId': 'occurrence-2',
        'calendarId': 2,
        'ownerUserId': 2,
        'kind': 'PERSONAL_BLOCK',
        'title': 'Indisponível',
        'startsAt': '2026-08-04T17:00:00.000Z',
        'endsAt': '2026-08-04T17:30:00.000Z',
      });

      expect(occurrence.owner.id, 2);
      expect(occurrence.owner.name, 'Usuário');
      expect(occurrence.facility, isNull);
      expect(occurrence.recurrenceKey, 'occurrence-2');
    });

    test('parses redacted manager personal block without private context', () {
      final occurrence = CalendarOccurrence.fromJson({
        'id': 2,
        'calendarId': 2,
        'occurrenceId': '2:2026-08-04T14:00[America/Sao_Paulo]',
        'recurrenceKey': '2026-08-04T14:00[America/Sao_Paulo]',
        'kind': 'PERSONAL_BLOCK',
        'title': 'Indisponível',
        'owner': {'id': 2, 'name': 'Bruno Lima'},
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

  test(
    'maps recurring interaction detail calendar DTO to an occurrence editor snapshot',
    () {
      final detail = InteractionDetail.fromJson({
        'id': 1,
        'calendarId': 1,
        'recurrenceKey': '2026-08-03T09:00[America/Sao_Paulo]',
        'modality': 'REMOTE',
        'status': 'SCHEDULED',
        'version': 5,
        'canMutate': true,
        'calendar': {
          'id': 1,
          'title': 'Acompanhamento semanal',
          'version': 8,
          'recurrence': 'WEEKLY',
          'recurrenceUntil': '2026-10-05',
          'recurrenceCount': null,
        },
        'occurrence': {
          'recurrenceKey': '2026-08-03T09:00[America/Sao_Paulo]',
          'startsAt': '2026-08-03T12:00:00.000Z',
          'endsAt': '2026-08-03T13:00:00.000Z',
          'timeZone': 'America/Sao_Paulo',
          'overrideVersion': 2,
        },
        'facility': {
          'id': 1,
          'displayName': 'Clínica Central',
          'city': 'São Paulo',
          'state': 'SP',
        },
        'agent': {'id': 1, 'displayName': 'Ana Souza'},
        'linkedOrders': <Map<String, dynamic>>[],
      });

      final occurrence = CalendarOccurrence.fromInteraction(detail);

      expect(
        {
          'recurrence': occurrence.recurrence,
          'recurrenceUntil': occurrence.recurrenceUntil,
          'recurrenceCount': occurrence.recurrenceCount,
          'calendarVersion': occurrence.version,
          'overrideVersion': occurrence.overrideVersion,
          'timeZone': occurrence.timeZone,
          'durationMinutes': occurrence.durationMinutes,
        },
        {
          'recurrence': CalendarRecurrence.weekly,
          'recurrenceUntil': '2026-10-05',
          'recurrenceCount': null,
          'calendarVersion': 8,
          'overrideVersion': 2,
          'timeZone': 'America/Sao_Paulo',
          'durationMinutes': 60,
        },
      );
    },
  );
}
