import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/calendar_editor_provider.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeCalendarRepository implements CalendarMutationRepositoryContract {
  CalendarCreateCommand? created;
  String? createKey;
  Object? submitError;

  @override
  Future<void> createCalendar({
    required CalendarCreateCommand command,
    required String idempotencyKey,
  }) async {
    created = command;
    createKey = idempotencyKey;
    if (submitError case final error?) throw error;
  }

  @override
  Future<void> updateCalendar({
    required String calendarId,
    required CalendarUpdateCommand command,
    required String idempotencyKey,
  }) async {}

  @override
  Future<void> updateCalendarOccurrence({
    required String calendarId,
    required String recurrenceKey,
    required CalendarOccurrenceUpdateCommand command,
    required String idempotencyKey,
  }) async {}

  @override
  Future<void> cancelCalendar({
    required String calendarId,
    required CalendarCancellationCommand command,
    required String idempotencyKey,
  }) async {}

  @override
  Future<void> cancelCalendarOccurrence({
    required String calendarId,
    required String recurrenceKey,
    required CalendarCancellationCommand command,
    required String idempotencyKey,
  }) async {}
}

void main() {
  test(
    'new editor defaults to interaction, in-person, 60 minutes and no recurrence',
    () {
      final notifier = CalendarEditorNotifier(
        repository: _FakeCalendarRepository(),
        target: const CalendarEditorTarget.creating(),
        now: () => DateTime(2026, 8, 3, 9, 17),
        timeZoneResolver: (_) => 'America/Sao_Paulo',
        idempotencyKeyFactory: () => 'create-key',
      );

      expect(notifier.state.draft.kind, CalendarEventKind.interaction);
      expect(notifier.state.draft.modality, CalendarModality.inPerson);
      expect(notifier.state.draft.durationMinutes, 60);
      expect(notifier.state.draft.recurrence, CalendarRecurrence.none);
      expect(notifier.state.draft.timeZone, 'America/Sao_Paulo');
    },
  );

  test(
    'interaction requires clinic and duration must be a positive multiple of 30',
    () {
      final notifier = CalendarEditorNotifier(
        repository: _FakeCalendarRepository(),
        target: const CalendarEditorTarget.creating(),
        now: () => DateTime(2026, 8, 3, 9),
        timeZoneResolver: (_) => 'America/Sao_Paulo',
      );

      notifier.setTitle('Visita');
      notifier.setDurationMinutes(45);

      expect(notifier.validationErrors['facilityId'], 'Selecione uma clínica.');
      expect(
        notifier.validationErrors['durationMinutes'],
        'Use uma duração em múltiplos de 30 minutos.',
      );

      notifier.setKind(CalendarEventKind.personalBlock);
      expect(notifier.validationErrors, isNot(contains('facilityId')));
    },
  );

  test(
    'serializes mutually exclusive recurrence bounds and offset startsAt',
    () {
      final repository = _FakeCalendarRepository();
      final notifier = CalendarEditorNotifier(
        repository: repository,
        target: const CalendarEditorTarget.creating(
          prefill: CalendarEditorPrefill(
            facilityId: 'facility-1',
            facilityName: 'Clínica Central',
            kind: CalendarEventKind.interaction,
          ),
        ),
        now: () => DateTime.utc(2026, 8, 3, 9),
        timeZoneResolver: (_) => 'Etc/UTC',
        idempotencyKeyFactory: () => 'create-key',
      );
      notifier
        ..setTitle('Visita de acompanhamento')
        ..setRecurrence(CalendarRecurrence.monthly)
        ..setRecurrenceEnd(CalendarRecurrenceEnd.count)
        ..setRecurrenceCount(6);

      final command = notifier.state.draft.toCreateCommand();

      expect(command.startsAt, '2026-08-03T09:30:00.000+00:00');
      expect(command.recurrence, CalendarRecurrence.monthly);
      expect(command.recurrenceCount, 6);
      expect(command.recurrenceUntil, isNull);
      expect(command.toJson()['recurrence'], 'MONTHLY');
      expect(command.toJson(), isNot(contains('recurrenceUntil')));
    },
  );

  test(
    'keeps draft and idempotency key after network failure, then clears only on success',
    () async {
      final repository = _FakeCalendarRepository()
        ..submitError = const CalendarNetworkException('Sem conexão.');
      var keys = 0;
      final notifier = CalendarEditorNotifier(
        repository: repository,
        target: const CalendarEditorTarget.creating(
          prefill: CalendarEditorPrefill(
            facilityId: 'facility-1',
            facilityName: 'Clínica Central',
            kind: CalendarEventKind.interaction,
          ),
        ),
        now: () => DateTime.utc(2026, 8, 3, 9),
        timeZoneResolver: (_) => 'Etc/UTC',
        idempotencyKeyFactory: () => 'key-${++keys}',
      )..setTitle('Rascunho importante');

      expect(await notifier.submit(), isFalse);
      expect(notifier.state.draft.title, 'Rascunho importante');
      expect(repository.createKey, 'key-1');
      expect(notifier.state.canRetry, isTrue);

      repository.submitError = null;
      expect(await notifier.retry(), isTrue);
      expect(repository.createKey, 'key-1');
      expect(notifier.state.isSaved, isTrue);
    },
  );

  test('shows first conflict in pt-BR and keeps draft', () async {
    final repository = _FakeCalendarRepository()
      ..submitError = CalendarConflictException(
        'Conflito',
        conflicts: [
          CalendarConflict(
            candidate: CalendarConflictInterval(
              startsAt: DateTime.utc(2026, 8, 3, 12),
              endsAt: DateTime.utc(2026, 8, 3, 13),
            ),
            existing: CalendarConflictInterval(
              startsAt: DateTime.utc(2026, 8, 3, 12, 30),
              endsAt: DateTime.utc(2026, 8, 3, 13, 30),
            ),
          ),
        ],
      );
    final notifier = CalendarEditorNotifier(
      repository: repository,
      target: const CalendarEditorTarget.creating(
        prefill: CalendarEditorPrefill(
          facilityId: 'facility-1',
          facilityName: 'Clínica Central',
          kind: CalendarEventKind.interaction,
        ),
      ),
      now: () => DateTime.utc(2026, 8, 3, 12),
      timeZoneResolver: (_) => 'Etc/UTC',
    )..setTitle('Visita');

    expect(await notifier.submit(), isFalse);
    expect(notifier.state.draft.title, 'Visita');
    expect(notifier.state.errorMessage, contains('O horário solicitado'));
    expect(notifier.state.errorMessage, contains('já existe um compromisso'));
  });
}
