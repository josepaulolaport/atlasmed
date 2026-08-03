import 'package:equatable/equatable.dart';

enum CalendarEventKind { interaction, personalBlock }

enum CalendarModality { inPerson, remote }

enum CalendarRecurrence { none, daily, weekly, monthly, yearly }

enum InteractionStatus {
  scheduled,
  inProgress,
  completed,
  cancelled,
  notCompleted,
}

T _enumFromApi<T extends Enum>(List<T> values, Object? raw) {
  final normalized = raw?.toString().toUpperCase();
  return values.firstWhere(
    (value) =>
        value.name
            .replaceAllMapped(
              RegExp(r'([a-z])([A-Z])'),
              (match) => '${match[1]}_${match[2]}',
            )
            .toUpperCase() ==
        normalized,
  );
}

class CalendarIdentity extends Equatable {
  const CalendarIdentity({required this.id, required this.name});

  final String id;
  final String name;

  factory CalendarIdentity.fromJson(
    Map<String, dynamic> json, {
    required String fallbackId,
    required String fallbackName,
  }) => CalendarIdentity(
    id: (json['id'] as String?) ?? fallbackId,
    name:
        (json['name'] as String?) ??
        (json['displayName'] as String?) ??
        fallbackName,
  );

  @override
  List<Object?> get props => [id, name];
}

class CalendarInteractionContext extends Equatable {
  const CalendarInteractionContext({
    required this.id,
    required this.status,
    this.facilityId,
    this.agentUserId,
    this.modality,
  });

  final String id;
  final String? facilityId;
  final String? agentUserId;
  final CalendarModality? modality;
  final InteractionStatus status;

  factory CalendarInteractionContext.fromJson(Map<String, dynamic> json) =>
      CalendarInteractionContext(
        id: json['id'] as String,
        facilityId: json['facilityId'] as String?,
        agentUserId: json['agentUserId'] as String?,
        modality: json['modality'] == null
            ? null
            : _enumFromApi(CalendarModality.values, json['modality']),
        status: _enumFromApi(InteractionStatus.values, json['status']),
      );

  @override
  List<Object?> get props => [id, facilityId, agentUserId, modality, status];
}

class CalendarOccurrence extends Equatable {
  const CalendarOccurrence({
    required this.calendarId,
    required this.occurrenceId,
    required this.recurrenceKey,
    required this.kind,
    required this.title,
    required this.owner,
    required this.facility,
    required this.modality,
    required this.startsAt,
    required this.endsAt,
    required this.localDate,
    required this.localStartsAt,
    required this.localEndsAt,
    required this.recurrence,
    required this.interaction,
    required this.canMutate,
  });

  final String calendarId;
  final String occurrenceId;
  final String recurrenceKey;
  final CalendarEventKind kind;
  final String title;
  final CalendarIdentity owner;
  final CalendarIdentity? facility;
  final CalendarModality? modality;
  final DateTime startsAt;
  final DateTime endsAt;
  final DateTime localDate;
  final String localStartsAt;
  final String localEndsAt;
  final CalendarRecurrence recurrence;
  final CalendarInteractionContext? interaction;
  final bool canMutate;

  factory CalendarOccurrence.fromJson(Map<String, dynamic> json) {
    final startsAt = DateTime.parse(json['startsAt'] as String).toUtc();
    final endsAt = DateTime.parse(json['endsAt'] as String).toUtc();
    final localStart = startsAt.toLocal();
    final localEnd = endsAt.toLocal();
    final occurrenceId =
        (json['occurrenceId'] as String?) ?? json['id'] as String;
    final calendarId = (json['calendarId'] as String?) ?? json['id'] as String;
    final ownerUserId =
        (json['ownerUserId'] as String?) ??
        ((json['owner'] as Map<String, dynamic>?)?['id'] as String?) ??
        '';
    final interactionJson = json['interaction'] as Map<String, dynamic>?;
    final interaction = interactionJson == null
        ? null
        : CalendarInteractionContext.fromJson(interactionJson);
    final facilityId =
        (json['facilityId'] as String?) ?? interaction?.facilityId ?? '';
    final ownerJson =
        json['owner'] as Map<String, dynamic>? ??
        <String, dynamic>{'name': json['ownerName']};
    final facilityJson = json['facility'] as Map<String, dynamic>?;
    return CalendarOccurrence(
      calendarId: calendarId,
      occurrenceId: occurrenceId,
      recurrenceKey: (json['recurrenceKey'] as String?) ?? occurrenceId,
      kind: _enumFromApi(CalendarEventKind.values, json['kind']),
      title: json['title'] as String,
      owner: CalendarIdentity.fromJson(
        ownerJson,
        fallbackId: ownerUserId,
        fallbackName: 'Usuário',
      ),
      facility: facilityJson == null
          ? null
          : CalendarIdentity.fromJson(
              facilityJson,
              fallbackId: facilityId,
              fallbackName: 'Clínica',
            ),
      modality: json['modality'] == null
          ? interaction?.modality
          : _enumFromApi(CalendarModality.values, json['modality']),
      startsAt: startsAt,
      endsAt: endsAt,
      localDate: json['localDate'] == null
          ? _dateOnly(localStart)
          : DateTime.parse(json['localDate'] as String),
      localStartsAt:
          json['localStartsAt'] as String? ?? _formatTime(localStart),
      localEndsAt: json['localEndsAt'] as String? ?? _formatTime(localEnd),
      recurrence: _enumFromApi(
        CalendarRecurrence.values,
        json['recurrence'] ?? 'NONE',
      ),
      interaction: interaction,
      canMutate: json['canMutate'] as bool? ?? false,
    );
  }

  String get dayLabel => formatAgendaDay(localDate);

  @override
  List<Object?> get props => [
    calendarId,
    occurrenceId,
    recurrenceKey,
    kind,
    title,
    owner,
    facility,
    modality,
    startsAt,
    endsAt,
    localDate,
    localStartsAt,
    localEndsAt,
    recurrence,
    interaction,
    canMutate,
  ];
}

class CalendarAvailabilityInterval extends Equatable {
  const CalendarAvailabilityInterval({
    required this.startsAt,
    required this.endsAt,
    required this.occurrenceId,
  });

  final DateTime startsAt;
  final DateTime endsAt;
  final String? occurrenceId;

  factory CalendarAvailabilityInterval.fromJson(Map<String, dynamic> json) =>
      CalendarAvailabilityInterval(
        startsAt: DateTime.parse(json['startsAt'] as String).toUtc(),
        endsAt: DateTime.parse(json['endsAt'] as String).toUtc(),
        occurrenceId: json['occurrenceId'] as String?,
      );

  @override
  List<Object?> get props => [startsAt, endsAt, occurrenceId];
}

class CalendarConflictInterval extends Equatable {
  const CalendarConflictInterval({
    required this.startsAt,
    required this.endsAt,
    this.id,
  });

  final DateTime startsAt;
  final DateTime endsAt;
  final String? id;

  @override
  List<Object?> get props => [startsAt, endsAt, id];
}

class CalendarConflict extends Equatable {
  const CalendarConflict({required this.candidate, required this.existing});

  final CalendarConflictInterval candidate;
  final CalendarConflictInterval existing;

  factory CalendarConflict.fromJson(Map<String, dynamic> json) =>
      CalendarConflict(
        candidate: CalendarConflictInterval(
          id: json['candidateId'] as String?,
          startsAt: DateTime.parse(
            (json['candidateStartsAt'] ?? json['startsAt']) as String,
          ).toUtc(),
          endsAt: DateTime.parse(
            (json['candidateEndsAt'] ?? json['endsAt']) as String,
          ).toUtc(),
        ),
        existing: CalendarConflictInterval(
          id: (json['existingId'] ?? json['occurrenceId']) as String?,
          startsAt: DateTime.parse(
            (json['existingStartsAt'] ?? json['startsAt']) as String,
          ).toUtc(),
          endsAt: DateTime.parse(
            (json['existingEndsAt'] ?? json['endsAt']) as String,
          ).toUtc(),
        ),
      );

  @override
  List<Object?> get props => [candidate, existing];
}

class AgendaDayGroup extends Equatable {
  const AgendaDayGroup({required this.date, required this.items});

  final DateTime date;
  final List<CalendarOccurrence> items;

  @override
  List<Object?> get props => [date, items];
}

List<AgendaDayGroup> groupCalendarOccurrences(
  Iterable<CalendarOccurrence> occurrences,
) {
  final sorted = occurrences.toList()
    ..sort((left, right) {
      final byDate = left.localDate.compareTo(right.localDate);
      if (byDate != 0) return byDate;
      final byTime = left.localStartsAt.compareTo(right.localStartsAt);
      if (byTime != 0) return byTime;
      return left.occurrenceId.compareTo(right.occurrenceId);
    });
  final grouped = <DateTime, List<CalendarOccurrence>>{};
  for (final occurrence in sorted) {
    grouped
        .putIfAbsent(_dateOnly(occurrence.localDate), () => [])
        .add(occurrence);
  }
  return grouped.entries
      .map((entry) => AgendaDayGroup(date: entry.key, items: entry.value))
      .toList(growable: false);
}

String formatAgendaDay(DateTime date) {
  const weekdays = [
    'segunda-feira',
    'terça-feira',
    'quarta-feira',
    'quinta-feira',
    'sexta-feira',
    'sábado',
    'domingo',
  ];
  const months = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ];
  return '${weekdays[date.weekday - 1]}, ${date.day} de ${months[date.month - 1]}';
}

DateTime _dateOnly(DateTime value) =>
    DateTime(value.year, value.month, value.day);

String _formatTime(DateTime value) =>
    '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';
