import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/calendar_editor_provider.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeCalendarRepository implements CalendarMutationRepositoryContract {
  CalendarCreateCommand? created;
  String? createKey;
  CalendarOccurrenceUpdateCommand? occurrenceUpdate;
  String? occurrenceUpdateKey;
  CalendarCancellationCommand? occurrenceCancellation;
  String? occurrenceCancellationKey;
  Object? submitError;
  Object? cancelError;

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
    occurrenceUpdateKey = idempotencyKey;
    if (submitError case final error?) throw error;
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
    occurrenceCancellationKey = idempotencyKey;
    if (cancelError case final error?) throw error;
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

CalendarEditorNotifier _creating() => CalendarEditorNotifier(
  repository: _FakeCalendarRepository(),
  target: const CalendarEditorTarget.creating(),
  now: () => DateTime(2026, 8, 3, 9, 17),
  timeZoneResolver: (_) => 'America/Sao_Paulo',
);

void main() {
  group('naming a visit from its clinic', () {
    test('choosing the clinic names the visit', () {
      // The choice already answers "what is this"; asking again for a title is
      // the same question twice with the answer on screen.
      final notifier = _creating()
        ..setFacility(const CalendarIdentity(id: 7, name: 'Clínica Central'));

      expect(notifier.state.draft.title, 'Visita · Clínica Central');
      expect(notifier.validationErrors.containsKey('title'), isFalse);
    });

    test('changing the clinic moves the name with it', () {
      final notifier = _creating()
        ..setFacility(const CalendarIdentity(id: 7, name: 'Clínica Central'))
        ..setFacility(const CalendarIdentity(id: 8, name: 'Hospital Sul'));

      expect(notifier.state.draft.title, 'Visita · Hospital Sul');
    });

    test('a title the rep typed survives a change of clinic', () {
      final notifier = _creating()
        ..setFacility(const CalendarIdentity(id: 7, name: 'Clínica Central'))
        ..setTitle('Reunião com o comprador')
        ..setFacility(const CalendarIdentity(id: 8, name: 'Hospital Sul'));

      expect(notifier.state.draft.title, 'Reunião com o comprador');
    });

    test('clearing the clinic clears a name it had given', () {
      // Leaving "Visita · Clínica Central" on an appointment with no clinic
      // would save a title that names somewhere the rep just removed.
      final notifier = _creating()
        ..setFacility(const CalendarIdentity(id: 7, name: 'Clínica Central'))
        ..setFacility(null);

      expect(notifier.state.draft.title, isEmpty);
    });

    test('clearing the clinic leaves a typed name alone', () {
      final notifier = _creating()
        ..setTitle('Almoço com o Dr. Silva')
        ..setFacility(const CalendarIdentity(id: 7, name: 'Clínica Central'))
        ..setFacility(null);

      expect(notifier.state.draft.title, 'Almoço com o Dr. Silva');
    });
  });

  test('a rhythm chosen on the day grid survives into the event', () async {
    // The quick sheet asks about recurrence itself now — it was the one field
    // that used to justify sending the rep to a second form over a block they
    // had already drawn. If the prefill dropped it, the sheet would offer the
    // question and quietly save a one-off.
    final repository = _FakeCalendarRepository();
    final notifier = CalendarEditorNotifier(
      repository: repository,
      target: const CalendarEditorTarget.creating(
        prefill: CalendarEditorPrefill(
          kind: CalendarEventKind.personalBlock,
          title: 'Almoço',
          recurrence: CalendarRecurrence.daily,
        ),
      ),
      now: () => DateTime(2026, 8, 3, 9, 17),
      timeZoneResolver: (_) => 'America/Sao_Paulo',
    );

    expect(notifier.state.draft.recurrence, CalendarRecurrence.daily);
    await notifier.submit();

    expect(repository.created?.recurrence, CalendarRecurrence.daily);
  });

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

  test('refuses a series that ends before it begins', () {
    // Presence of an end date was checked; its order was not. A series from
    // the 20th to the 10th passed every rule and produced no occurrences —
    // a repeating appointment that never repeats, with nothing saying why.
    final notifier = CalendarEditorNotifier(
      repository: _FakeCalendarRepository(),
      target: const CalendarEditorTarget.creating(
        prefill: CalendarEditorPrefill(
          kind: CalendarEventKind.interaction,
          title: 'Visita',
          facilityId: 7,
          facilityName: 'Clínica Central',
        ),
      ),
      now: () => DateTime(2026, 8, 20, 9),
      timeZoneResolver: (_) => 'America/Sao_Paulo',
    );
    notifier.setStartsAt(DateTime(2026, 8, 20, 9));
    notifier.setRecurrence(CalendarRecurrence.weekly);
    notifier.setRecurrenceEnd(CalendarRecurrenceEnd.date);
    notifier.setRecurrenceUntil(DateTime(2026, 8, 10));

    expect(notifier.validationErrors['recurrenceUntil'], isNotNull);
  });

  test('accepts a series ending on the day it begins', () {
    final notifier = CalendarEditorNotifier(
      repository: _FakeCalendarRepository(),
      target: const CalendarEditorTarget.creating(
        prefill: CalendarEditorPrefill(
          kind: CalendarEventKind.interaction,
          title: 'Visita',
          facilityId: 7,
          facilityName: 'Clínica Central',
        ),
      ),
      now: () => DateTime(2026, 8, 20, 9),
      timeZoneResolver: (_) => 'America/Sao_Paulo',
    );
    notifier.setStartsAt(DateTime(2026, 8, 20, 9));
    notifier.setRecurrence(CalendarRecurrence.weekly);
    notifier.setRecurrenceEnd(CalendarRecurrenceEnd.date);
    notifier.setRecurrenceUntil(DateTime(2026, 8, 20));

    expect(notifier.validationErrors['recurrenceUntil'], isNull);
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

      expect(
        notifier.validationErrors['facilityId'],
        'Selecione uma clínica ou um médico.',
      );
      expect(
        notifier.validationErrors['durationMinutes'],
        'Use uma duração em múltiplos de 30 minutos.',
      );

      notifier.setKind(CalendarEventKind.personalBlock);
      expect(notifier.validationErrors, isNot(contains('facilityId')));
    },
  );

  test('a remote contact with a doctor needs no clinic', () {
    // §15.7.5 — the rep phoned a doctor. There is no building to name, and
    // naming one they never entered would poison the record.
    final repository = _FakeCalendarRepository();
    final notifier = CalendarEditorNotifier(
      repository: repository,
      target: const CalendarEditorTarget.creating(),
      now: () => DateTime(2026, 8, 3, 9),
      timeZoneResolver: (_) => 'America/Sao_Paulo',
    );

    notifier.setPerson(
      const CalendarIdentity(id: 7, name: 'Dra. Marina Alves'),
    );
    notifier.setModality(CalendarModality.remote);

    expect(notifier.validationErrors, isNot(contains('facilityId')));
    // The contact names itself, the way a chosen clinic does.
    expect(notifier.state.draft.title, 'Contato · Dra. Marina Alves');
  });

  test('a presencial meeting with a doctor needs no clinic either', () {
    // A coffee, a corridor at a congress, a hospital the rep's book has never
    // heard of. The modality does not decide whether there is a clinic.
    final notifier = CalendarEditorNotifier(
      repository: _FakeCalendarRepository(),
      target: const CalendarEditorTarget.creating(),
      now: () => DateTime(2026, 8, 3, 9),
      timeZoneResolver: (_) => 'America/Sao_Paulo',
    );

    notifier.setPerson(
      const CalendarIdentity(id: 7, name: 'Dra. Marina Alves'),
    );
    notifier.setModality(CalendarModality.inPerson);

    expect(notifier.validationErrors, isNot(contains('facilityId')));
  });

  test('sends the doctor with the appointment', () async {
    final repository = _FakeCalendarRepository();
    final notifier = CalendarEditorNotifier(
      repository: repository,
      target: const CalendarEditorTarget.creating(),
      now: () => DateTime(2026, 8, 3, 9),
      timeZoneResolver: (_) => 'America/Sao_Paulo',
    );

    notifier.setTitle('Ligação de acompanhamento');
    notifier.setPerson(
      const CalendarIdentity(id: 7, name: 'Dra. Marina Alves'),
    );
    notifier.setModality(CalendarModality.remote);
    await notifier.submit();

    expect(repository.created?.toJson()['personId'], 7);
    expect(repository.created?.toJson().containsKey('facilityId'), isFalse);
  });

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

  test(
    'a cancellation does not reuse the key a failed save is holding',
    () async {
      // Receipts are stored per (user, key) and replaying one under a different
      // command kind is a hard error. A save that reached the server and failed
      // on the way back leaves an UPDATE receipt against the key the client is
      // still holding, so sharing it turned the next cancel into an idempotency
      // conflict the rep could only escape by leaving the screen.
      final repository = _FakeCalendarRepository()
        ..submitError = const CalendarNetworkException('Sem conexão.');
      var keys = 0;
      final notifier = CalendarEditorNotifier(
        repository: repository,
        target: CalendarEditorTarget.editingOccurrence(_occurrence(version: 8)),
        idempotencyKeyFactory: () => 'key-${++keys}',
      );

      expect(await notifier.submit(), isFalse);
      expect(repository.occurrenceUpdateKey, 'key-1');

      expect(await notifier.cancel('Clínica fechou'), isTrue);
      expect(repository.occurrenceCancellationKey, isNot('key-1'));
    },
  );

  test('a cancellation retry reuses its own key', () async {
    // The other half of the same rule: retrying the same cancel must not
    // create a second cancellation if the first one landed.
    final repository = _FakeCalendarRepository()
      ..cancelError = const CalendarNetworkException('Sem conexão.');
    var keys = 0;
    final notifier = CalendarEditorNotifier(
      repository: repository,
      target: CalendarEditorTarget.editingOccurrence(_occurrence(version: 8)),
      idempotencyKeyFactory: () => 'key-${++keys}',
    );

    expect(await notifier.cancel('Clínica fechou'), isFalse);
    final first = repository.occurrenceCancellationKey;

    repository.cancelError = null;
    expect(await notifier.cancel('Clínica fechou'), isTrue);

    expect(repository.occurrenceCancellationKey, first);
  });

  test(
    'a blank cancellation reason says so instead of doing nothing',
    () async {
      // It used to return false silently, so the dialog closed, nothing was
      // cancelled, and the screen gave no sign either had happened.
      final notifier = CalendarEditorNotifier(
        repository: _FakeCalendarRepository(),
        target: CalendarEditorTarget.editingOccurrence(_occurrence(version: 8)),
      );

      expect(await notifier.cancel('   '), isFalse);
      expect(notifier.state.errorMessage, isNotNull);
    },
  );

  test('the failure reason is readable the moment submit returns', () async {
    // The day grid's quick sheet is not a ConsumerWidget, so it used to read
    // this off `stream` — which delivers asynchronously. `await submit()`
    // returned before the listener had run, and the sheet showed "Não foi
    // possível salvar." over a conflict the server had just explained.
    final repository = _FakeCalendarRepository()
      ..submitError = const CalendarNetworkException('Sem conexão.');
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
    )..setTitle('Visita');

    expect(await notifier.submit(), isFalse);

    expect(notifier.errorMessage, 'Sem conexão.');
  });

  test(
    'editing a series opens on the series anchor, not the tapped week',
    () async {
      // Found on the simulator: opening the third week of a weekly block and
      // changing only its duration moved the series anchor to that week, so the
      // first two occurrences vanished without a word. `toUpdateCommand` sends
      // `startsAt` and the server writes it as the anchor, so the form has to be
      // seeded with the series' own start.
      final occurrence = CalendarOccurrence.fromJson({
        'id': '3:2026-08-27T17:00[America/Sao_Paulo]',
        'calendarId': 3,
        'recurrenceKey': '2026-08-27T17:00[America/Sao_Paulo]',
        'ownerUserId': 2,
        'kind': 'PERSONAL_BLOCK',
        'title': 'Bloqueio semanal',
        'startsAt': '2026-08-27T20:00:00.000Z',
        'endsAt': '2026-08-27T21:00:00.000Z',
        'timeZone': 'America/Sao_Paulo',
        'durationMinutes': 60,
        'recurrence': 'WEEKLY',
        'anchorLocalDate': '2026-08-20',
        'anchorLocalTime': '17:00',
        'version': 1,
        'canMutate': true,
      });

      final series = CalendarEditorNotifier(
        repository: _FakeCalendarRepository(),
        target: CalendarEditorTarget.editingSeries(occurrence),
      );
      expect(series.state.draft.startsAt, DateTime(2026, 8, 20, 17));

      // One occurrence is still about that occurrence.
      final single = CalendarEditorNotifier(
        repository: _FakeCalendarRepository(),
        target: CalendarEditorTarget.editingOccurrence(occurrence),
      );
      expect(single.state.draft.startsAt.day, 27);
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
