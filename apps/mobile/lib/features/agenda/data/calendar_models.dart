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

enum CalendarRecurrenceEnd { none, date, count }

enum CalendarEditorMode { create, series, occurrence }

String calendarEventKindToApi(CalendarEventKind value) => switch (value) {
  CalendarEventKind.interaction => 'INTERACTION',
  CalendarEventKind.personalBlock => 'PERSONAL_BLOCK',
};

String calendarModalityToApi(CalendarModality value) => switch (value) {
  CalendarModality.inPerson => 'IN_PERSON',
  CalendarModality.remote => 'REMOTE',
};

String calendarRecurrenceToApi(CalendarRecurrence value) =>
    value.name.toUpperCase();

class CalendarEditorPrefill extends Equatable {
  const CalendarEditorPrefill({this.facilityId, this.facilityName, this.kind});

  final String? facilityId;
  final String? facilityName;
  final CalendarEventKind? kind;

  @override
  List<Object?> get props => [facilityId, facilityName, kind];
}

class CalendarEditorTarget extends Equatable {
  const CalendarEditorTarget.creating({this.prefill})
    : mode = CalendarEditorMode.create,
      occurrence = null;

  const CalendarEditorTarget.editingSeries(CalendarOccurrence this.occurrence)
    : mode = CalendarEditorMode.series,
      prefill = null;

  const CalendarEditorTarget.editingOccurrence(
    CalendarOccurrence this.occurrence,
  ) : mode = CalendarEditorMode.occurrence,
      prefill = null;

  final CalendarEditorMode mode;
  final CalendarEditorPrefill? prefill;
  final CalendarOccurrence? occurrence;

  @override
  List<Object?> get props => [mode, prefill, occurrence];
}

class CalendarCreateCommand extends Equatable {
  const CalendarCreateCommand({
    required this.kind,
    required this.title,
    required this.startsAt,
    required this.timeZone,
    required this.durationMinutes,
    required this.recurrence,
    this.facilityId,
    this.modality,
    this.recurrenceUntil,
    this.recurrenceCount,
  });

  final CalendarEventKind kind;
  final String title;
  final String? facilityId;
  final CalendarModality? modality;
  final String startsAt;
  final String timeZone;
  final int durationMinutes;
  final CalendarRecurrence recurrence;
  final String? recurrenceUntil;
  final int? recurrenceCount;

  Map<String, dynamic> toJson() => {
    'kind': calendarEventKindToApi(kind),
    'title': title,
    if (facilityId != null) 'facilityId': facilityId,
    if (modality != null) 'modality': calendarModalityToApi(modality!),
    'startsAt': startsAt,
    'timeZone': timeZone,
    'durationMinutes': durationMinutes,
    'recurrence': calendarRecurrenceToApi(recurrence),
    if (recurrenceUntil != null) 'recurrenceUntil': recurrenceUntil,
    if (recurrenceCount != null) 'recurrenceCount': recurrenceCount,
  };

  @override
  List<Object?> get props => [
    kind,
    title,
    facilityId,
    modality,
    startsAt,
    timeZone,
    durationMinutes,
    recurrence,
    recurrenceUntil,
    recurrenceCount,
  ];
}

class CalendarUpdateCommand extends Equatable {
  const CalendarUpdateCommand({
    required this.expectedVersion,
    this.title,
    this.startsAt,
    this.timeZone,
    this.durationMinutes,
    this.recurrence,
    this.recurrenceUntil,
    this.recurrenceCount,
    this.includeRecurrence = true,
  });

  final int expectedVersion;
  final String? title;
  final String? startsAt;
  final String? timeZone;
  final int? durationMinutes;
  final CalendarRecurrence? recurrence;
  final String? recurrenceUntil;
  final int? recurrenceCount;
  final bool includeRecurrence;

  Map<String, dynamic> toJson() => {
    'expectedVersion': expectedVersion,
    if (title != null) 'title': title,
    if (startsAt != null) 'startsAt': startsAt,
    if (timeZone != null) 'timeZone': timeZone,
    if (durationMinutes != null) 'durationMinutes': durationMinutes,
    if (includeRecurrence && recurrence != null)
      'recurrence': calendarRecurrenceToApi(recurrence!),
    if (includeRecurrence) 'recurrenceUntil': recurrenceUntil,
    if (includeRecurrence) 'recurrenceCount': recurrenceCount,
  };

  @override
  List<Object?> get props => [
    expectedVersion,
    title,
    startsAt,
    timeZone,
    durationMinutes,
    recurrence,
    recurrenceUntil,
    recurrenceCount,
    includeRecurrence,
  ];
}

class CalendarOccurrenceUpdateCommand extends Equatable {
  const CalendarOccurrenceUpdateCommand({
    required this.expectedVersion,
    required this.startsAt,
    required this.durationMinutes,
  });

  final int expectedVersion;
  final String startsAt;
  final int durationMinutes;

  Map<String, dynamic> toJson() => {
    'expectedVersion': expectedVersion,
    'startsAt': startsAt,
    'durationMinutes': durationMinutes,
  };

  @override
  List<Object?> get props => [expectedVersion, startsAt, durationMinutes];
}

class CalendarCancellationCommand extends Equatable {
  const CalendarCancellationCommand({
    required this.expectedVersion,
    required this.reason,
  });

  final int expectedVersion;
  final String reason;

  Map<String, dynamic> toJson() => {
    'expectedVersion': expectedVersion,
    'reason': reason,
  };

  @override
  List<Object?> get props => [expectedVersion, reason];
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

class InteractionFacility extends Equatable {
  const InteractionFacility({
    required this.id,
    required this.displayName,
    this.city,
    this.state,
  });

  final String id;
  final String displayName;
  final String? city;
  final String? state;

  factory InteractionFacility.fromJson(Map<String, dynamic> json) =>
      InteractionFacility(
        id: json['id'] as String,
        displayName:
            (json['displayName'] as String?) ??
            (json['name'] as String?) ??
            'Clínica',
        city: json['city'] as String?,
        state: json['state'] as String?,
      );

  String get locationLabel => [
    city,
    state,
  ].whereType<String>().where((value) => value.trim().isNotEmpty).join(' - ');

  @override
  List<Object?> get props => [id, displayName, city, state];
}

class InteractionAgent extends Equatable {
  const InteractionAgent({required this.id, required this.displayName});

  final String id;
  final String displayName;

  factory InteractionAgent.fromJson(Map<String, dynamic> json) =>
      InteractionAgent(
        id: json['id'] as String,
        displayName:
            (json['displayName'] as String?) ??
            [json['firstName'], json['lastName']]
                .whereType<String>()
                .where((value) => value.trim().isNotEmpty)
                .join(' '),
      );

  @override
  List<Object?> get props => [id, displayName];
}

class InteractionLinkedOrder extends Equatable {
  const InteractionLinkedOrder({
    required this.id,
    required this.status,
    required this.type,
    required this.orderedAt,
  });

  final String id;
  final String status;
  final String type;
  final DateTime orderedAt;

  factory InteractionLinkedOrder.fromJson(Map<String, dynamic> json) =>
      InteractionLinkedOrder(
        id: json['id'] as String,
        status: json['status'] as String,
        type: json['type'] as String,
        orderedAt: DateTime.parse(json['orderedAt'] as String),
      );

  @override
  List<Object?> get props => [id, status, type, orderedAt];
}

class InteractionDetail extends Equatable {
  const InteractionDetail({
    required this.id,
    required this.calendarId,
    required this.recurrenceKey,
    required this.title,
    required this.modality,
    required this.status,
    required this.occurrenceStartsAt,
    required this.occurrenceEndsAt,
    required this.timeZone,
    required this.facility,
    required this.agent,
    required this.linkedOrders,
    required this.version,
    required this.canMutate,
    this.actualStartedAt,
    this.actualEndedAt,
    this.correctionReason,
  });

  final String id;
  final String calendarId;
  final String recurrenceKey;
  final String title;
  final CalendarModality modality;
  final InteractionStatus status;
  final DateTime occurrenceStartsAt;
  final DateTime occurrenceEndsAt;
  final String timeZone;
  final InteractionFacility facility;
  final InteractionAgent agent;
  final List<InteractionLinkedOrder> linkedOrders;
  final int version;
  final bool canMutate;
  final DateTime? actualStartedAt;
  final DateTime? actualEndedAt;
  final String? correctionReason;

  factory InteractionDetail.fromJson(Map<String, dynamic> json) {
    final occurrence = json['occurrence'] as Map<String, dynamic>;
    final calendar = json['calendar'] as Map<String, dynamic>;
    return InteractionDetail(
      id: json['id'] as String,
      calendarId: json['calendarId'] as String,
      recurrenceKey: json['recurrenceKey'] as String,
      title: calendar['title'] as String? ?? 'Atendimento',
      modality: _enumFromApi(CalendarModality.values, json['modality']),
      status: _enumFromApi(InteractionStatus.values, json['status']),
      occurrenceStartsAt: DateTime.parse(
        occurrence['startsAt'] as String,
      ).toUtc(),
      occurrenceEndsAt: DateTime.parse(occurrence['endsAt'] as String).toUtc(),
      timeZone: occurrence['timeZone'] as String? ?? 'America/Sao_Paulo',
      facility: InteractionFacility.fromJson(
        json['facility'] as Map<String, dynamic>,
      ),
      agent: InteractionAgent.fromJson(json['agent'] as Map<String, dynamic>),
      linkedOrders: (json['linkedOrders'] as List<dynamic>? ?? const [])
          .map(
            (order) =>
                InteractionLinkedOrder.fromJson(order as Map<String, dynamic>),
          )
          .toList(growable: false),
      version: json['version'] as int,
      canMutate: json['canMutate'] as bool? ?? false,
      actualStartedAt: json['actualStartedAt'] == null
          ? null
          : DateTime.parse(json['actualStartedAt'] as String).toUtc(),
      actualEndedAt: json['actualEndedAt'] == null
          ? null
          : DateTime.parse(json['actualEndedAt'] as String).toUtc(),
      correctionReason: json['correctionReason'] as String?,
    );
  }

  @override
  List<Object?> get props => [
    id,
    calendarId,
    recurrenceKey,
    title,
    modality,
    status,
    occurrenceStartsAt,
    occurrenceEndsAt,
    timeZone,
    facility,
    agent,
    linkedOrders,
    version,
    canMutate,
    actualStartedAt,
    actualEndedAt,
    correctionReason,
  ];
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
    this.timeZone = 'UTC',
    this.durationMinutes = 60,
    this.version = 0,
    this.overrideVersion,
    this.recurrenceUntil,
    this.recurrenceCount,
    this.recurrenceProvided = true,
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
  final String timeZone;
  final int durationMinutes;
  final int version;
  final int? overrideVersion;
  final String? recurrenceUntil;
  final int? recurrenceCount;
  final bool recurrenceProvided;

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
      timeZone: json['timeZone'] as String? ?? 'UTC',
      durationMinutes:
          json['durationMinutes'] as int? ??
          endsAt.difference(startsAt).inMinutes,
      version: json['version'] as int? ?? 0,
      overrideVersion: json['overrideVersion'] as int?,
      recurrenceUntil: json['recurrenceUntil'] as String?,
      recurrenceCount: json['recurrenceCount'] as int?,
      recurrenceProvided: json.containsKey('recurrence'),
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
    timeZone,
    durationMinutes,
    version,
    overrideVersion,
    recurrenceUntil,
    recurrenceCount,
    recurrenceProvided,
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
