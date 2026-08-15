import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/calendar_editor_provider.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeCalendarRepository implements CalendarMutationRepositoryContract {
  CalendarCreateCommand? created;
  String? createKey;
  CalendarOccurrenceUpdateCommand? occurrenceUpdate;
  CalendarCancellationCommand? occurrenceCancellation;
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
    required int calendarId,
    required CalendarUpdateCommand command,
    required String idempotencyKey,
  }) async {}

  @override
  Future<void> updateCalendarOccurrence({
    required int calendarId,
    required String recurrenceKey,
    required CalendarOccurrenceUpdateCommand command,
    required String idempotencyKey,
  }) async {
    occurrenceUpdate = command;
  }

  @override
  Future<void> cancelCalendar({
    required int calendarId,
    required CalendarCancellationCommand command,
    required String idempotencyKey,
  }) async {}

  @override
  Future<void> cancelCalendarOccurrence({
    required int calendarId,
    required String recurrenceKey,
    required CalendarCancellationCommand command,
    required String idempotencyKey,
  }) async {
    occurrenceCancellation = command;
  }
}

CalendarOccurrence _occurrence({
  int version = 8,
  int? overrideVersion,
}) => CalendarOccurrence.fromJson({
  'id': 1,
  'occurrenceId': '1:key-1',
  'calendarId': 1,
  'recurrenceKey': 'key-1',
  'ownerUserId': 1,
  'kind': 'PERSONAL_BLOCK',
  'title': 'Bloqueio',
  'startsAt': '2026-08-03T12:00:00.000Z',
  'endsAt': '2026-08-03T13:00:00.000Z',
  'timeZone': 'America/Sao_Paulo',
  'durationMinutes': 60,
  'recurrence': 'WEEKLY',
  'version': version,
  // ignore: use_null_aware_elements — value-nullable map entry, not key-nullable.
  if (overrideVersion != null) 'overrideVersion': overrideVersion,
  'canMutate': true,
});

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

  test('prefill seeds clinic, kind and title so only the time is left', () {
    final notifier = CalendarEditorNotifier(
      repository: _FakeCalendarRepository(),
      target: const CalendarEditorTarget.creating(
        prefill: CalendarEditorPrefill(
          facilityId: 7,
          facilityName: 'Clínica Central',
          kind: CalendarEventKind.interaction,
          title: 'Visita · Clínica Central',
        ),
      ),
      now: () => DateTime(2026, 8, 3, 9, 17),
      timeZoneResolver: (_) => 'America/Sao_Paulo',
    );

    expect(notifier.state.draft.facilityId, 7);
    expect(notifier.state.draft.facilityName, 'Clínica Central');
    expect(notifier.state.draft.title, 'Visita · Clínica Central');
    // Seeded well enough to save without touching the form.
    expect(notifier.validationErrors, isEmpty);
  });

  test('a block drawn on the day grid opens the form on that block', () {
    // Reopening the editor at the next free half hour would discard the one
    // decision the rep had already made by dragging.
    final notifier = CalendarEditorNotifier(
      repository: _FakeCalendarRepository(),
      target: CalendarEditorTarget.creating(
        prefill: CalendarEditorPrefill(
          kind: CalendarEventKind.interaction,
          title: 'Visita',
          facilityId: 7,
          facilityName: 'Clínica Central',
          startsAt: DateTime(2026, 8, 14, 18),
          durationMinutes: 30,
        ),
      ),
      now: () => DateTime(2026, 8, 14, 9, 17),
      timeZoneResolver: (_) => 'America/Sao_Paulo',
    );

    expect(notifier.state.draft.startsAt, DateTime(2026, 8, 14, 18));
    expect(notifier.state.draft.durationMinutes, 30);
    expect(notifier.validationErrors, isEmpty);
  });

  test('without a drawn block the form still opens on the next half hour', () {
    final notifier = CalendarEditorNotifier(
      repository: _FakeCalendarRepository(),
      target: const CalendarEditorTarget.creating(),
      now: () => DateTime(2026, 8, 14, 9, 17),
      timeZoneResolver: (_) => 'America/Sao_Paulo',
    );

    expect(notifier.state.draft.startsAt.hour, 9);
    expect(notifier.state.draft.startsAt.minute, 30);
    expect(notifier.state.draft.durationMinutes, 60);
  });

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
            facilityId: 1,
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

      // The notifier was given a UTC clock and 'Etc/UTC', so the instant is UTC
      // and serializes as `Z` — no device offset in the answer. This assertion
      // used to hardcode whichever offset the machine running it happened to
      // have (`-03:00`, then `+00:00` for CI), so it could only ever pass in one
      // timezone; the rounding in `_initialDraft` was silently localizing it.
      expect(command.startsAt, '2026-08-03T09:30:00.000Z');
      expect(command.recurrence, CalendarRecurrence.monthly);
      expect(command.recurrenceCount, 6);
      expect(command.recurrenceUntil, isNull);
      expect(command.toJson()['recurrence'], 'MONTHLY');
      expect(command.toJson(), isNot(contains('recurrenceUntil')));
    },
  );

  test(
    'series update does not overwrite recurrence when list DTO omitted it',
    () {
      final occurrence = CalendarOccurrence.fromJson({
        'id': 1,
        'occurrenceId': '1:key-1',
        'calendarId': 1,
        'recurrenceKey': 'key-1',
        'ownerUserId': 1,
        'kind': 'PERSONAL_BLOCK',
        'title': 'Bloqueio',
        'startsAt': '2026-08-03T12:00:00.000Z',
        'endsAt': '2026-08-03T13:00:00.000Z',
        'timeZone': 'America/Sao_Paulo',
        'durationMinutes': 60,
        'version': 4,
        'canMutate': true,
      });
      final notifier = CalendarEditorNotifier(
        repository: _FakeCalendarRepository(),
        target: CalendarEditorTarget.editingSeries(occurrence),
      );

      final payload = notifier.state.draft.toUpdateCommand().toJson();

      expect(payload, isNot(contains('recurrence')));
      expect(payload, isNot(contains('recurrenceUntil')));
      expect(payload, isNot(contains('recurrenceCount')));
    },
  );

  test(
    'explicit recurrence change is included after list DTO omitted recurrence',
    () {
      final occurrence = CalendarOccurrence.fromJson({
        'id': 1,
        'occurrenceId': '1:key-1',
        'calendarId': 1,
        'recurrenceKey': 'key-1',
        'ownerUserId': 1,
        'kind': 'PERSONAL_BLOCK',
        'title': 'Bloqueio',
        'startsAt': '2026-08-03T12:00:00.000Z',
        'endsAt': '2026-08-03T13:00:00.000Z',
        'timeZone': 'America/Sao_Paulo',
        'durationMinutes': 60,
        'version': 4,
        'canMutate': true,
      });
      final notifier = CalendarEditorNotifier(
        repository: _FakeCalendarRepository(),
        target: CalendarEditorTarget.editingSeries(occurrence),
      )..setRecurrence(CalendarRecurrence.weekly);

      expect(
        notifier.state.draft.toUpdateCommand().toJson()['recurrence'],
        'WEEKLY',
      );
    },
  );

  test(
    'first occurrence reschedule sends override expectedVersion 0',
    () async {
      final repository = _FakeCalendarRepository();
      final notifier = CalendarEditorNotifier(
        repository: repository,
        target: CalendarEditorTarget.editingOccurrence(_occurrence(version: 8)),
        idempotencyKeyFactory: () => 'occurrence-key',
      );

      expect(await notifier.submit(), isTrue);

      expect(repository.occurrenceUpdate?.expectedVersion, 0);
    },
  );

  test('subsequent occurrence reschedule sends override version', () async {
    final repository = _FakeCalendarRepository();
    final notifier = CalendarEditorNotifier(
      repository: repository,
      target: CalendarEditorTarget.editingOccurrence(
        _occurrence(version: 8, overrideVersion: 3),
      ),
      idempotencyKeyFactory: () => 'occurrence-key',
    );

    expect(await notifier.submit(), isTrue);

    expect(repository.occurrenceUpdate?.expectedVersion, 3);
  });

  test(
    'first occurrence cancellation sends override expectedVersion 0',
    () async {
      final repository = _FakeCalendarRepository();
      final notifier = CalendarEditorNotifier(
        repository: repository,
        target: CalendarEditorTarget.editingOccurrence(_occurrence(version: 8)),
        idempotencyKeyFactory: () => 'occurrence-key',
      );

      expect(await notifier.cancel('Conflito de horário'), isTrue);

      expect(repository.occurrenceCancellation?.expectedVersion, 0);
    },
  );

  test('subsequent occurrence cancellation sends override version', () async {
    final repository = _FakeCalendarRepository();
    final notifier = CalendarEditorNotifier(
      repository: repository,
      target: CalendarEditorTarget.editingOccurrence(
        _occurrence(version: 8, overrideVersion: 3),
      ),
      idempotencyKeyFactory: () => 'occurrence-key',
    );

    expect(await notifier.cancel('Conflito de horário'), isTrue);

    expect(repository.occurrenceCancellation?.expectedVersion, 3);
  });

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
            facilityId: 1,
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
          facilityId: 1,
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
