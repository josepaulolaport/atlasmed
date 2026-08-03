import 'dart:math';

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
  final String? facilityId;
  final String? facilityName;
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
    String? facilityId,
    String? facilityName,
    bool clearFacility = false,
    CalendarModality? modality,
    DateTime? startsAt,
    String? timeZone,
    int? durationMinutes,
    CalendarRecurrence? recurrence,
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
    recurrenceProvided: recurrenceProvided,
  );

  CalendarCreateCommand toCreateCommand() => CalendarCreateCommand(
    kind: kind,
    title: title.trim(),
    facilityId: kind == CalendarEventKind.interaction ? facilityId : null,
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
        expectedVersion: overrideVersion ?? expectedVersion,
        startsAt: _offsetIso(startsAt),
        durationMinutes: durationMinutes,
      );

  @override
  List<Object?> get props => [
    kind,
    title,
    facilityId,
    facilityName,
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

class CalendarEditorNotifier extends StateNotifier<CalendarEditorState> {
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

  Map<String, String> get validationErrors {
    final errors = <String, String>{};
    final draft = state.draft;
    if (draft.title.trim().isEmpty) {
      errors['title'] = 'Informe um título.';
    }
    if (draft.kind == CalendarEventKind.interaction &&
        (draft.facilityId == null || draft.facilityId!.isEmpty)) {
      errors['facilityId'] = 'Selecione uma clínica.';
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
  void setFacility(CalendarIdentity? facility) => _setDraft(
    facility == null
        ? state.draft.copyWith(clearFacility: true)
        : state.draft.copyWith(
            facilityId: facility.id,
            facilityName: facility.name,
          ),
  );
  void setModality(CalendarModality value) =>
      _setDraft(state.draft.copyWith(modality: value));
  void setStartsAt(DateTime value) =>
      _setDraft(state.draft.copyWith(startsAt: value));
  void setDurationMinutes(int value) =>
      _setDraft(state.draft.copyWith(durationMinutes: value));
  void setRecurrence(CalendarRecurrence value) => _setDraft(
    state.draft.copyWith(
      recurrence: value,
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
    if (occurrence == null || reason.trim().isEmpty) return false;
    final key = _pendingIdempotencyKey ??= _idempotencyKeyFactory();
    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      final command = CalendarCancellationCommand(
        expectedVersion: target.mode == CalendarEditorMode.occurrence
            ? occurrence.overrideVersion ?? occurrence.version
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
      _pendingIdempotencyKey = null;
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
      modality: occurrence.modality ?? CalendarModality.inPerson,
      startsAt: occurrence.startsAt.toLocal(),
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
  final rounded = DateTime(
    now.year,
    now.month,
    now.day,
    now.hour,
    now.minute < 30 ? 30 : 0,
  ).add(now.minute >= 30 ? const Duration(hours: 1) : Duration.zero);
  final prefill = target.prefill;
  return CalendarEditorDraft(
    kind: prefill?.kind ?? CalendarEventKind.interaction,
    title: '',
    facilityId: prefill?.facilityId,
    facilityName: prefill?.facilityName,
    modality: CalendarModality.inPerson,
    startsAt: rounded,
    timeZone: timeZoneResolver(now),
    durationMinutes: 60,
    recurrence: CalendarRecurrence.none,
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
