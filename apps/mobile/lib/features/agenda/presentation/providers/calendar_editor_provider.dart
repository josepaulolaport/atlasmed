import 'dart:math';

import 'package:atlasmed_mobile_app/core/state/dispose_safe_state_notifier.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class CalendarEditorDraft extends Equatable {
  const CalendarEditorDraft({
    required this.kind,
    required this.title,
    required this.facilityId,
    required this.facilityName,
    required this.personId,
    required this.personName,
    required this.modality,
    required this.startsAt,
    required this.timeZone,
    required this.durationMinutes,
    required this.recurrence,
    required this.recurrenceEnd,
    required this.recurrenceUntil,
    required this.recurrenceCount,
    required this.expectedVersion,
    required this.overrideVersion,
    required this.recurrenceProvided,
  });

  final CalendarEventKind kind;
  final String title;
  final int? facilityId;
  final String? facilityName;

  /// The doctor the contact is with, when the rep booked a person rather than
  /// a place (§15.7.5). Both may be set: a visit to a named doctor at their
  /// clinic is one interaction, not two.
  final int? personId;
  final String? personName;
  final CalendarModality modality;
  final DateTime startsAt;
  final String timeZone;
  final int durationMinutes;
  final CalendarRecurrence recurrence;
  final CalendarRecurrenceEnd recurrenceEnd;
  final DateTime? recurrenceUntil;
  final int? recurrenceCount;
  final int expectedVersion;
  final int? overrideVersion;
  final bool recurrenceProvided;

  CalendarEditorDraft copyWith({
    CalendarEventKind? kind,
    String? title,
    int? facilityId,
    String? facilityName,
    bool clearFacility = false,
    int? personId,
    String? personName,
    bool clearPerson = false,
    CalendarModality? modality,
    DateTime? startsAt,
    String? timeZone,
    int? durationMinutes,
    CalendarRecurrence? recurrence,
    bool? recurrenceProvided,
    CalendarRecurrenceEnd? recurrenceEnd,
    DateTime? recurrenceUntil,
    bool clearRecurrenceUntil = false,
    int? recurrenceCount,
    bool clearRecurrenceCount = false,
  }) => CalendarEditorDraft(
    kind: kind ?? this.kind,
    title: title ?? this.title,
    facilityId: clearFacility ? null : (facilityId ?? this.facilityId),
    facilityName: clearFacility ? null : (facilityName ?? this.facilityName),
    personId: clearPerson ? null : (personId ?? this.personId),
    personName: clearPerson ? null : (personName ?? this.personName),
    modality: modality ?? this.modality,
    startsAt: startsAt ?? this.startsAt,
    timeZone: timeZone ?? this.timeZone,
    durationMinutes: durationMinutes ?? this.durationMinutes,
    recurrence: recurrence ?? this.recurrence,
    recurrenceEnd: recurrenceEnd ?? this.recurrenceEnd,
    recurrenceUntil: clearRecurrenceUntil
        ? null
        : (recurrenceUntil ?? this.recurrenceUntil),
    recurrenceCount: clearRecurrenceCount
        ? null
        : (recurrenceCount ?? this.recurrenceCount),
    expectedVersion: expectedVersion,
    overrideVersion: overrideVersion,
    recurrenceProvided: recurrenceProvided ?? this.recurrenceProvided,
  );

  CalendarCreateCommand toCreateCommand() => CalendarCreateCommand(
    kind: kind,
    title: title.trim(),
    facilityId: kind == CalendarEventKind.interaction ? facilityId : null,
    personId: kind == CalendarEventKind.interaction ? personId : null,
    modality: kind == CalendarEventKind.interaction ? modality : null,
    startsAt: _offsetIso(startsAt),
    timeZone: timeZone,
    durationMinutes: durationMinutes,
    recurrence: recurrence,
    recurrenceUntil:
        recurrenceEnd == CalendarRecurrenceEnd.date && recurrenceUntil != null
        ? _dateOnly(recurrenceUntil!)
        : null,
    recurrenceCount: recurrenceEnd == CalendarRecurrenceEnd.count
        ? recurrenceCount
        : null,
  );

  CalendarUpdateCommand toUpdateCommand() => CalendarUpdateCommand(
    expectedVersion: expectedVersion,
    title: title.trim(),
    startsAt: _offsetIso(startsAt),
    timeZone: timeZone,
    durationMinutes: durationMinutes,
    recurrence: recurrence,
    includeRecurrence: recurrenceProvided,
    recurrenceUntil:
        recurrenceEnd == CalendarRecurrenceEnd.date && recurrenceUntil != null
        ? _dateOnly(recurrenceUntil!)
        : null,
    recurrenceCount: recurrenceEnd == CalendarRecurrenceEnd.count
        ? recurrenceCount
        : null,
  );

  CalendarOccurrenceUpdateCommand toOccurrenceUpdateCommand() =>
      CalendarOccurrenceUpdateCommand(
        expectedVersion: overrideVersion ?? 0,
        startsAt: _offsetIso(startsAt),
        durationMinutes: durationMinutes,
      );

  @override
  List<Object?> get props => [
    kind,
    title,
    facilityId,
    facilityName,
    personId,
    personName,
    modality,
    startsAt,
    timeZone,
    durationMinutes,
    recurrence,
    recurrenceEnd,
    recurrenceUntil,
    recurrenceCount,
    expectedVersion,
    overrideVersion,
    recurrenceProvided,
  ];
}

class CalendarEditorState extends Equatable {
  const CalendarEditorState({
    required this.draft,
    this.isSubmitting = false,
    this.isSaved = false,
    this.errorMessage,
    this.canRetry = false,
  });

  final CalendarEditorDraft draft;
  final bool isSubmitting;
  final bool isSaved;
  final String? errorMessage;
  final bool canRetry;

  CalendarEditorState copyWith({
    CalendarEditorDraft? draft,
    bool? isSubmitting,
    bool? isSaved,
    String? errorMessage,
    bool clearError = false,
    bool? canRetry,
  }) => CalendarEditorState(
    draft: draft ?? this.draft,
    isSubmitting: isSubmitting ?? this.isSubmitting,
    isSaved: isSaved ?? this.isSaved,
    errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    canRetry: canRetry ?? this.canRetry,
  );

  @override
  List<Object?> get props => [
    draft,
    isSubmitting,
    isSaved,
    errorMessage,
    canRetry,
  ];
}

class CalendarEditorNotifier extends StateNotifier<CalendarEditorState>
    with DisposeSafeStateWrites<CalendarEditorState> {
  CalendarEditorNotifier({
    required CalendarMutationRepositoryContract repository,
    required this.target,
    DateTime Function()? now,
    String Function(DateTime date)? timeZoneResolver,
    String Function()? idempotencyKeyFactory,
  }) : _repository = repository,
       _idempotencyKeyFactory = idempotencyKeyFactory ?? _randomKey,
       super(
         CalendarEditorState(
           draft: _initialDraft(
             target,
             (now ?? DateTime.now)(),
             timeZoneResolver ?? resolveDeviceCalendarTimeZone,
           ),
         ),
       );

  final CalendarMutationRepositoryContract _repository;
  final CalendarEditorTarget target;
  final String Function() _idempotencyKeyFactory;
  String? _pendingIdempotencyKey;

  /// Cancelling carries its own key.
  ///
  /// A receipt is stored per (user, key) and replaying one under a different
  /// command kind is a hard error. Sharing one key meant a save that reached
  /// the server but failed on the way back — the receipt says UPDATE, the
  /// client still holds the key — turned the next cancel into an idempotency
  /// conflict the rep could only escape by leaving the screen.
  String? _pendingCancelKey;

  /// Why the last attempt failed, or null.
  ///
  /// Callers outside a `ConsumerWidget` — the day grid's quick sheet — used to
  /// read this off `stream`, which delivers asynchronously: `await submit()`
  /// returned before the listener had run, so the sheet fell back to "Não foi
  /// possível salvar." and threw away the conflict the server had just
  /// explained. A read-only getter is the notifier's own API, not a reach
  /// inside it.
  String? get errorMessage => state.errorMessage;

  Map<String, String> get validationErrors {
    final errors = <String, String>{};
    final draft = state.draft;
    if (draft.title.trim().isEmpty) {
      errors['title'] = 'Informe um título.';
    }
    // §15.7.5 — an interaction is about a clinic, a doctor, or both, and the
    // modality does not change that. A meeting with a doctor may be presencial
    // and still be nowhere the rep's book knows: a coffee, a corridor at a
    // congress. Naming a clinic they never entered is worse than naming none.
    if (draft.kind == CalendarEventKind.interaction &&
        draft.facilityId == null &&
        draft.personId == null) {
      errors['facilityId'] = 'Selecione uma clínica ou um médico.';
    }
    if (draft.durationMinutes <= 0 || draft.durationMinutes % 30 != 0) {
      errors['durationMinutes'] = 'Use uma duração em múltiplos de 30 minutos.';
    }
    if (draft.recurrence == CalendarRecurrence.none &&
        draft.recurrenceEnd != CalendarRecurrenceEnd.none) {
      errors['recurrenceEnd'] = 'Sem repetição não pode ter término.';
    }
    if (draft.recurrenceEnd == CalendarRecurrenceEnd.date &&
        draft.recurrenceUntil == null) {
      errors['recurrenceUntil'] = 'Informe a data final.';
    }
    // Presence was checked; order was not. A series running from the 20th to
    // the 10th passes every other rule and produces no occurrences at all —
    // the rep gets a repeating appointment that never repeats, and nothing
    // says why.
    final until = draft.recurrenceUntil;
    if (draft.recurrenceEnd == CalendarRecurrenceEnd.date &&
        until != null &&
        until.isBefore(
          DateTime(
            draft.startsAt.year,
            draft.startsAt.month,
            draft.startsAt.day,
          ),
        )) {
      errors['recurrenceUntil'] = 'O término não pode ser antes do início.';
    }
    if (draft.recurrenceEnd == CalendarRecurrenceEnd.count &&
        (draft.recurrenceCount == null || draft.recurrenceCount! <= 0)) {
      errors['recurrenceCount'] = 'Informe uma quantidade válida.';
    }
    return errors;
  }

  void setKind(CalendarEventKind value) => _setDraft(
    state.draft.copyWith(
      kind: value,
      clearFacility: value == CalendarEventKind.personalBlock,
    ),
  );
  void setTitle(String value) => _setDraft(state.draft.copyWith(title: value));

  /// Picking the clinic names the visit, unless the rep has named it themselves.
  ///
  /// "Still automatic" means empty, or exactly the title the previous clinic
  /// would have produced — so changing the clinic moves the title with it, and
  /// anything typed by hand survives both.
  void setFacility(CalendarIdentity? facility) {
    final draft = state.draft;
    final previous = draft.facilityName;
    final automatic =
        draft.title.trim().isEmpty ||
        (previous != null && draft.title == visitTitleForFacility(previous));

    _setDraft(
      facility == null
          ? draft.copyWith(
              clearFacility: true,
              title: automatic ? '' : draft.title,
            )
          : draft.copyWith(
              facilityId: facility.id,
              facilityName: facility.name,
              title: automatic
                  ? visitTitleForFacility(facility.name)
                  : draft.title,
            ),
    );
  }

  /// Picking the doctor names the contact, on the same rule as the clinic:
  /// only a title the rep has not written themselves is replaced.
  void setPerson(CalendarIdentity? person) {
    final draft = state.draft;
    final automatic =
        draft.title.trim().isEmpty ||
        (draft.personName != null &&
            draft.title == contactTitleForPerson(draft.personName!)) ||
        (draft.facilityName != null &&
            draft.title == visitTitleForFacility(draft.facilityName!));

    _setDraft(
      person == null
          ? draft.copyWith(
              clearPerson: true,
              title: automatic ? '' : draft.title,
            )
          : draft.copyWith(
              personId: person.id,
              personName: person.name,
              title: automatic
                  ? contactTitleForPerson(person.name)
                  : draft.title,
            ),
    );
  }

  void setModality(CalendarModality value) =>
      _setDraft(state.draft.copyWith(modality: value));
  void setStartsAt(DateTime value) =>
      _setDraft(state.draft.copyWith(startsAt: value));
  void setDurationMinutes(int value) =>
      _setDraft(state.draft.copyWith(durationMinutes: value));
  void setRecurrence(CalendarRecurrence value) => _setDraft(
    state.draft.copyWith(
      recurrence: value,
      recurrenceProvided: true,
      recurrenceEnd: value == CalendarRecurrence.none
          ? CalendarRecurrenceEnd.none
          : state.draft.recurrenceEnd,
      clearRecurrenceUntil: value == CalendarRecurrence.none,
      clearRecurrenceCount: value == CalendarRecurrence.none,
    ),
  );
  void setRecurrenceEnd(CalendarRecurrenceEnd value) => _setDraft(
    state.draft.copyWith(
      recurrenceEnd: value,
      clearRecurrenceUntil: value != CalendarRecurrenceEnd.date,
      clearRecurrenceCount: value != CalendarRecurrenceEnd.count,
    ),
  );
  void setRecurrenceUntil(DateTime value) => _setDraft(
    state.draft.copyWith(
      recurrenceUntil: value,
      recurrenceEnd: CalendarRecurrenceEnd.date,
      clearRecurrenceCount: true,
    ),
  );
  void setRecurrenceCount(int? value) => _setDraft(
    state.draft.copyWith(
      recurrenceCount: value,
      recurrenceEnd: CalendarRecurrenceEnd.count,
      clearRecurrenceUntil: true,
    ),
  );

  Future<bool> submit() async {
    if (validationErrors.isNotEmpty) {
      state = state.copyWith(
        errorMessage: validationErrors.values.first,
        canRetry: false,
      );
      return false;
    }
    final key = _pendingIdempotencyKey ??= _idempotencyKeyFactory();
    state = state.copyWith(
      isSubmitting: true,
      clearError: true,
      canRetry: false,
    );
    try {
      switch (target.mode) {
        case CalendarEditorMode.create:
          await _repository.createCalendar(
            command: state.draft.toCreateCommand(),
            idempotencyKey: key,
          );
        case CalendarEditorMode.series:
          await _repository.updateCalendar(
            calendarId: target.occurrence!.calendarId,
            command: state.draft.toUpdateCommand(),
            idempotencyKey: key,
          );
        case CalendarEditorMode.occurrence:
          await _repository.updateCalendarOccurrence(
            calendarId: target.occurrence!.calendarId,
            recurrenceKey: target.occurrence!.recurrenceKey,
            command: state.draft.toOccurrenceUpdateCommand(),
            idempotencyKey: key,
          );
      }
      _pendingIdempotencyKey = null;
      state = state.copyWith(
        isSubmitting: false,
        isSaved: true,
        canRetry: false,
      );
      return true;
    } on CalendarConflictException catch (error) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: _conflictMessage(error),
        canRetry: true,
      );
    } on CalendarVersionConflictException {
      state = state.copyWith(
        isSubmitting: false,
        errorMessage:
            'Este compromisso foi alterado em outro lugar. Recarregue antes de tentar novamente.',
        canRetry: false,
      );
    } on CalendarValidationException catch (error) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: error.message,
        canRetry: true,
      );
    } on CalendarApiException catch (error) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: error.message,
        canRetry: true,
      );
    }
    return false;
  }

  Future<bool> retry() => submit();

  Future<bool> cancel(String reason) async {
    final occurrence = target.occurrence;
    if (occurrence == null) return false;
    if (reason.trim().isEmpty) {
      state = state.copyWith(
        errorMessage: 'Informe o motivo do cancelamento.',
        canRetry: false,
      );
      return false;
    }
    final key = _pendingCancelKey ??= _idempotencyKeyFactory();
    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      final command = CalendarCancellationCommand(
        expectedVersion: target.mode == CalendarEditorMode.occurrence
            ? occurrence.overrideVersion ?? 0
            : occurrence.version,
        reason: reason.trim(),
      );
      if (target.mode == CalendarEditorMode.occurrence) {
        await _repository.cancelCalendarOccurrence(
          calendarId: occurrence.calendarId,
          recurrenceKey: occurrence.recurrenceKey,
          command: command,
          idempotencyKey: key,
        );
      } else {
        await _repository.cancelCalendar(
          calendarId: occurrence.calendarId,
          command: command,
          idempotencyKey: key,
        );
      }
      _pendingCancelKey = null;
      state = state.copyWith(isSubmitting: false, isSaved: true);
      return true;
    } on CalendarApiException catch (error) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: error.message,
        canRetry: true,
      );
      return false;
    }
  }

  void _setDraft(CalendarEditorDraft draft) {
    state = state.copyWith(
      draft: draft,
      isSaved: false,
      clearError: true,
      canRetry: false,
    );
  }
}

final calendarEditorProvider = StateNotifierProvider.autoDispose
    .family<CalendarEditorNotifier, CalendarEditorState, CalendarEditorTarget>((
      ref,
      target,
    ) {
      final notifier = CalendarEditorNotifier(
        repository: ref.watch(calendarMutationRepositoryProvider),
        target: target,
      );
      return notifier;
    });

/// Where a series edit should open: the series' own anchor, not the occurrence
/// the rep happened to tap.
///
/// Seeding from the occurrence re-anchored the series to that date on save,
/// because the update command sends `startsAt` and the server writes it as the
/// anchor. A rep who opened the third week and changed only the duration lost
/// the first two weeks without being told. Verified on the simulator.
DateTime? _seriesAnchorStart(CalendarOccurrence occurrence) {
  final date = occurrence.anchorLocalDate;
  final time = occurrence.anchorLocalTime;
  if (date == null || time == null) return null;
  final parsed = DateTime.tryParse('${date}T$time:00');
  return parsed;
}

CalendarEditorDraft _initialDraft(
  CalendarEditorTarget target,
  DateTime now,
  String Function(DateTime date) timeZoneResolver,
) {
  final occurrence = target.occurrence;
  if (occurrence != null) {
    return CalendarEditorDraft(
      kind: occurrence.kind,
      title: occurrence.title,
      facilityId: occurrence.facility?.id ?? occurrence.interaction?.facilityId,
      facilityName: occurrence.facility?.name,
      personId: occurrence.interaction?.person?.id,
      personName: occurrence.interaction?.person?.name,
      modality: occurrence.modality ?? CalendarModality.inPerson,
      startsAt: target.mode == CalendarEditorMode.series
          ? (_seriesAnchorStart(occurrence) ?? occurrence.startsAt.toLocal())
          : occurrence.startsAt.toLocal(),
      timeZone: occurrence.timeZone,
      durationMinutes: occurrence.durationMinutes,
      recurrence: occurrence.recurrence,
      recurrenceEnd: occurrence.recurrenceUntil != null
          ? CalendarRecurrenceEnd.date
          : occurrence.recurrenceCount != null
          ? CalendarRecurrenceEnd.count
          : CalendarRecurrenceEnd.none,
      recurrenceUntil: occurrence.recurrenceUntil == null
          ? null
          : DateTime.tryParse(occurrence.recurrenceUntil!),
      recurrenceCount: occurrence.recurrenceCount,
      expectedVersion: occurrence.version,
      overrideVersion: occurrence.overrideVersion,
      recurrenceProvided: occurrence.recurrenceProvided,
    );
  }
  // Round up to the next half hour, in the clock's own zone.
  //
  // The unnamed `DateTime` constructor always builds a *local* value, so
  // rebuilding from `now`'s components used to reinterpret a UTC clock as local
  // — same wall-clock reading, different instant, silently off by the device
  // offset. Production passes `DateTime.now()` (local) so it never showed there;
  // it surfaced as a test that could only pass in one timezone.
  final startOfHalfHour = now.isUtc
      ? DateTime.utc(
          now.year,
          now.month,
          now.day,
          now.hour,
          now.minute < 30 ? 30 : 0,
        )
      : DateTime(
          now.year,
          now.month,
          now.day,
          now.hour,
          now.minute < 30 ? 30 : 0,
        );
  final rounded = startOfHalfHour.add(
    now.minute >= 30 ? const Duration(hours: 1) : Duration.zero,
  );
  final prefill = target.prefill;
  return CalendarEditorDraft(
    kind: prefill?.kind ?? CalendarEventKind.interaction,
    title: prefill?.title ?? '',
    facilityId: prefill?.facilityId,
    facilityName: prefill?.facilityName,
    // Opening the editor from a doctor's page carries them in, so the rep is
    // not asked again for the answer they just gave.
    personId: prefill?.personId,
    personName: prefill?.personName,
    modality: CalendarModality.inPerson,
    // A slot drawn on the day grid wins over the next free half hour: the rep
    // has already said when, and reopening the form on a default time would
    // discard the one decision they had made.
    startsAt: prefill?.startsAt ?? rounded,
    timeZone: timeZoneResolver(now),
    durationMinutes: prefill?.durationMinutes ?? 60,
    recurrence: prefill?.recurrence ?? CalendarRecurrence.none,
    recurrenceEnd: CalendarRecurrenceEnd.none,
    recurrenceUntil: null,
    recurrenceCount: null,
    expectedVersion: 0,
    overrideVersion: null,
    recurrenceProvided: true,
  );
}

String resolveDeviceCalendarTimeZone(DateTime date) {
  final raw = date.timeZoneName.trim();
  if (raw.contains('/')) return raw;
  final offset = date.timeZoneOffset;
  if (offset == const Duration(hours: -2)) return 'America/Noronha';
  if (offset == const Duration(hours: -3)) return 'America/Sao_Paulo';
  if (offset == const Duration(hours: -4)) return 'America/Manaus';
  if (offset == const Duration(hours: -5)) return 'America/Rio_Branco';
  if (offset == Duration.zero) return 'Etc/UTC';
  // Dart core does not expose the device IANA identifier consistently. For
  // unsupported offsets, use an offset-valid Etc/GMT zone (reversed IANA sign).
  final hours = offset.inMinutes ~/ 60;
  if (offset.inMinutes % 60 == 0 && hours.abs() <= 14) {
    return hours < 0 ? 'Etc/GMT+${hours.abs()}' : 'Etc/GMT-${hours.abs()}';
  }
  return 'America/Sao_Paulo';
}

String _conflictMessage(CalendarConflictException error) {
  if (error.conflicts.isEmpty) {
    return 'O horário solicitado está indisponível. Ajuste a data ou a hora.';
  }
  final first = error.conflicts.first;
  return 'O horário solicitado (${_shortDateTime(first.candidate.startsAt)}) '
      'não está disponível: já existe um compromisso '
      'das ${_shortDateTime(first.existing.startsAt)} às ${_shortTime(first.existing.endsAt)}.';
}

String _shortDateTime(DateTime value) {
  final local = value.toLocal();
  return '${local.day.toString().padLeft(2, '0')}/'
      '${local.month.toString().padLeft(2, '0')} '
      '${_shortTime(local)}';
}

String _shortTime(DateTime value) {
  final local = value.toLocal();
  return '${local.hour.toString().padLeft(2, '0')}:'
      '${local.minute.toString().padLeft(2, '0')}';
}

String _offsetIso(DateTime value) {
  if (value.isUtc) return value.toIso8601String();
  final base = value.toIso8601String();
  final offset = value.timeZoneOffset;
  final sign = offset.isNegative ? '-' : '+';
  final minutes = offset.inMinutes.abs();
  return '$base$sign${(minutes ~/ 60).toString().padLeft(2, '0')}:'
      '${(minutes % 60).toString().padLeft(2, '0')}';
}

String _dateOnly(DateTime value) =>
    '${value.year.toString().padLeft(4, '0')}-'
    '${value.month.toString().padLeft(2, '0')}-'
    '${value.day.toString().padLeft(2, '0')}';

String _randomKey() {
  final random = Random.secure();
  final values = List<int>.generate(16, (_) => random.nextInt(256));
  return values.map((value) => value.toRadixString(16).padLeft(2, '0')).join();
}
