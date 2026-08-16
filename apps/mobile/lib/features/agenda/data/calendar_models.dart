import 'package:equatable/equatable.dart';

import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

enum CalendarEventKind { interaction, personalBlock }

enum CalendarModality { inPerson, remote }

enum CalendarRecurrence { none, daily, weekdays, weekly, monthly, yearly }

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

/// How the clinic field behaves, which depends on where the editor was opened.
enum CalendarFacilityChoice {
  /// Search every clinic. The agenda's own "+" knows nothing yet.
  anyClinic,

  /// The clinic is already settled — opened from that clinic's own page.
  fixed,

  /// Only the clinics the professional in [CalendarEditorPrefill.personId]
  /// works at. Visiting a doctor somewhere they do not attend is not a thing.
  professionalClinics,
}

class CalendarEditorPrefill extends Equatable {
  const CalendarEditorPrefill({
    this.facilityId,
    this.facilityName,
    this.kind,
    this.title,
    this.personId,
    this.personName,
    this.facilityChoice = CalendarFacilityChoice.anyClinic,
    this.startsAt,
    this.durationMinutes,
    this.recurrence,
  });

  final int? facilityId;
  final String? facilityName;
  final CalendarEventKind? kind;

  /// Seeds the title field, which is required and otherwise starts empty.
  ///
  /// Callers that already know what the appointment is — scheduling a visit
  /// from a clinic, say — fill it in so the rep only picks a time.
  final String? title;

  /// The professional the visit is about, when opened from their page.
  final int? personId;
  final String? personName;

  final CalendarFacilityChoice facilityChoice;

  /// The slot the rep already drew on the day grid.
  ///
  /// Carried so "Mais opções" opens the full form *on the block they just
  /// dragged* rather than on a default time. Reopening at 09:00 after they had
  /// chosen 18:00–18:30 would throw away the only decision they had made.
  final DateTime? startsAt;
  final int? durationMinutes;

  /// Whether the block the rep drew repeats. Set on the day grid's own sheet,
  /// which asks the question rather than sending them to the full form for it.
  final CalendarRecurrence? recurrence;

  @override
  List<Object?> get props => [
    facilityId,
    facilityName,
    kind,
    title,
    personId,
    personName,
    facilityChoice,
    startsAt,
    durationMinutes,
    recurrence,
  ];
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
    this.personId,
    this.modality,
    this.recurrenceUntil,
    this.recurrenceCount,
  });

  final CalendarEventKind kind;
  final String title;
  final int? facilityId;
  /// The doctor, when the contact is with a person (§15.7.5). A remote one may
  /// name no clinic at all; an in-person one still has to.
  final int? personId;
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
    if (personId != null) 'personId': personId,
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
    personId,
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

  final int id;
  final String name;

  factory CalendarIdentity.fromJson(
    Map<String, dynamic> json, {
    required int fallbackId,
    required String fallbackName,
  }) => CalendarIdentity(
    id: json['id'] == null ? fallbackId : readCrmId(json['id'], 'id'),
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
    this.person,
    this.agentUserId,
    this.modality,
    this.version = 0,
    this.actualStartedAt,
    this.actualEndedAt,
  });

  final int id;
  final int? facilityId;

  /// The doctor the contact was with, when it was booked against a person
  /// rather than a clinic (§15.7.5). Null for an ordinary clinic visit.
  final CalendarIdentity? person;
  final int? agentUserId;
  final CalendarModality? modality;
  final InteractionStatus status;

  /// What the visit *was*, against a plan that stays what it was meant to be
  /// (§15.6.3). Both null until the rep starts; the end arrives on close.
  final DateTime? actualStartedAt;
  final DateTime? actualEndedAt;

  /// Needed to start or finish this visit without opening it first — the
  /// lifecycle calls take an `expectedVersion`. The API has always sent it on
  /// the list DTO; the model simply dropped it.
  final int version;

  factory CalendarInteractionContext.fromJson(Map<String, dynamic> json) =>
      CalendarInteractionContext(
        id: readCrmId(json['id'], 'id'),
        facilityId: readCrmIdOrNull(json['facilityId'], 'facilityId'),
        person: json['person'] == null
            ? null
            : CalendarIdentity.fromJson(
                json['person'] as Map<String, dynamic>,
                fallbackId: 0,
                fallbackName: 'Médico',
              ),
        agentUserId: readCrmIdOrNull(json['agentUserId'], 'agentUserId'),
        modality: json['modality'] == null
            ? null
            : _enumFromApi(CalendarModality.values, json['modality']),
        status: _enumFromApi(InteractionStatus.values, json['status']),
        version: (json['version'] as num?)?.toInt() ?? 0,
        actualStartedAt: _parseUtcOrNull(json['actualStartedAt']),
        actualEndedAt: _parseUtcOrNull(json['actualEndedAt']),
      );

  @override
  List<Object?> get props => [
    id,
    facilityId,
    person,
    agentUserId,
    modality,
    status,
    version,
    actualStartedAt,
    actualEndedAt,
  ];
}

class InteractionFacility extends Equatable {
  const InteractionFacility({
    required this.id,
    required this.displayName,
    this.city,
    this.state,
  });

  final int id;
  final String displayName;
  final String? city;
  final String? state;

  factory InteractionFacility.fromJson(Map<String, dynamic> json) =>
      InteractionFacility(
        id: readCrmId(json['id'], 'id'),
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

  final int id;
  final String displayName;

  factory InteractionAgent.fromJson(Map<String, dynamic> json) =>
      InteractionAgent(
        id: readCrmId(json['id'], 'id'),
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

  final int id;
  final String status;
  final String type;
  final DateTime orderedAt;

  factory InteractionLinkedOrder.fromJson(Map<String, dynamic> json) =>
      InteractionLinkedOrder(
        id: readCrmId(json['id'], 'id'),
        status: json['status'] as String,
        type: json['type'] as String,
        orderedAt: DateTime.parse(json['orderedAt'] as String),
      );

  @override
  List<Object?> get props => [id, status, type, orderedAt];
}

/// How a visit went — spec 0016 §15.6.4.
///
/// ⚠️ [naoFalouComNinguem] is deliberately **not** the rejection vocabulary's
/// `SEM_INTERESSE`. That describes a judgement about a clinic made before
/// going and carries a decaying merit penalty; this describes a visit that
/// already happened and touches merit not at all. A rep who could not get past
/// reception has learned nothing about whether the clinic wants the product.
enum InteractionOutcome {
  pedido('PEDIDO', 'Fechei pedido'),
  vaiAvaliar('VAI_AVALIAR', 'Vai avaliar'),
  relacionamento('RELACIONAMENTO', 'Só relacionamento'),
  naoFalouComNinguem('NAO_FALEI_COM_NINGUEM', 'Não falei com ninguém');

  const InteractionOutcome(this.wire, this.label);
  final String wire;
  final String label;
}

/// When to come back. The load-bearing answer: it governs the coverage
/// rotation, so a rep answering it is scheduling their own next visit.
enum InteractionFollowUp {
  nenhum('NENHUM', 'Não precisa'),
  dias15('DIAS_15', 'Em 15 dias'),
  dias30('DIAS_30', 'Em 30 dias'),
  dias90('DIAS_90', 'Em 90 dias');

  const InteractionFollowUp(this.wire, this.label);
  final String wire;
  final String label;
}

InteractionOutcome? _outcomeFromApi(Object? value) {
  if (value is! String) return null;
  for (final option in InteractionOutcome.values) {
    if (option.wire == value) return option;
  }
  return null;
}

InteractionFollowUp? _followUpFromApi(Object? value) {
  if (value is! String) return null;
  for (final option in InteractionFollowUp.values) {
    if (option.wire == value) return option;
  }
  return null;
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
    this.person,
    required this.version,
    required this.canMutate,
    this.calendarVersion = 0,
    this.overrideVersion,
    this.recurrence = CalendarRecurrence.none,
    this.recurrenceUntil,
    this.recurrenceCount,
    this.actualStartedAt,
    this.actualEndedAt,
    this.correctionReason,
    this.outcome,
    this.followUp,
    this.needsOutcome = false,
  });

  final int id;
  final int calendarId;
  final String recurrenceKey;
  final String title;
  final CalendarModality modality;
  final InteractionStatus status;
  final DateTime occurrenceStartsAt;
  final DateTime occurrenceEndsAt;
  final String timeZone;
  /// Null for a contact with a doctor that happened nowhere (§15.7.5).
  final InteractionFacility? facility;

  /// Who the contact was with, when it was booked against a person.
  final CalendarIdentity? person;
  final InteractionAgent agent;
  final List<InteractionLinkedOrder> linkedOrders;
  final int version;
  final bool canMutate;
  final int calendarVersion;
  final int? overrideVersion;
  final CalendarRecurrence recurrence;
  final String? recurrenceUntil;
  final int? recurrenceCount;
  final DateTime? actualStartedAt;
  final DateTime? actualEndedAt;
  final String? correctionReason;

  /// The two questions (§15.6.4). Null means unanswered, which is common and
  /// legitimate — they are asked, never enforced.
  final InteractionOutcome? outcome;
  final InteractionFollowUp? followUp;

  /// Completed with nothing answered — the only state where asking is useful.
  final bool needsOutcome;

  factory InteractionDetail.fromJson(Map<String, dynamic> json) {
    final occurrence = json['occurrence'] as Map<String, dynamic>;
    final calendar = json['calendar'] as Map<String, dynamic>;
    return InteractionDetail(
      id: readCrmId(json['id'], 'id'),
      calendarId: readCrmId(json['calendarId'], 'calendarId'),
      recurrenceKey: json['recurrenceKey'] as String,
      title: calendar['title'] as String? ?? 'Atendimento',
      modality: _enumFromApi(CalendarModality.values, json['modality']),
      status: _enumFromApi(InteractionStatus.values, json['status']),
      occurrenceStartsAt: DateTime.parse(
        occurrence['startsAt'] as String,
      ).toUtc(),
      occurrenceEndsAt: DateTime.parse(occurrence['endsAt'] as String).toUtc(),
      timeZone: occurrence['timeZone'] as String? ?? 'America/Sao_Paulo',
      facility: json['facility'] == null
          ? null
          : InteractionFacility.fromJson(
              json['facility'] as Map<String, dynamic>,
            ),
      person: json['person'] == null
          ? null
          : CalendarIdentity.fromJson(
              json['person'] as Map<String, dynamic>,
              fallbackId: 0,
              fallbackName: 'Médico',
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
      calendarVersion:
          calendar['version'] as int? ??
          json['calendarVersion'] as int? ??
          json['version'] as int? ??
          0,
      overrideVersion:
          occurrence['overrideVersion'] as int? ??
          json['overrideVersion'] as int?,
      recurrence: _enumFromApi(
        CalendarRecurrence.values,
        calendar['recurrence'] ?? json['recurrence'] ?? 'NONE',
      ),
      recurrenceUntil:
          calendar['recurrenceUntil'] as String? ??
          json['recurrenceUntil'] as String?,
      recurrenceCount:
          calendar['recurrenceCount'] as int? ??
          json['recurrenceCount'] as int?,
      actualStartedAt: json['actualStartedAt'] == null
          ? null
          : DateTime.parse(json['actualStartedAt'] as String).toUtc(),
      actualEndedAt: json['actualEndedAt'] == null
          ? null
          : DateTime.parse(json['actualEndedAt'] as String).toUtc(),
      correctionReason: json['correctionReason'] as String?,
      outcome: _outcomeFromApi(json['outcome']),
      followUp: _followUpFromApi(json['followUp']),
      needsOutcome: json['needsOutcome'] as bool? ?? false,
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
    calendarVersion,
    overrideVersion,
    recurrence,
    recurrenceUntil,
    recurrenceCount,
    actualStartedAt,
    actualEndedAt,
    correctionReason,
    outcome,
    followUp,
    needsOutcome,
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
    this.anchorLocalDate,
    this.anchorLocalTime,
  });

  final int calendarId;
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

  /// Where the *series* starts, `YYYY-MM-DD` and `HH:MM` in [timeZone].
  ///
  /// Editing a whole series must edit the series' own anchor. Seeding that form
  /// from the occurrence the rep happened to tap re-anchored the series to that
  /// date on save, silently dropping every occurrence before it — a rep who
  /// opened the third week and changed only the duration lost the first two.
  final String? anchorLocalDate;
  final String? anchorLocalTime;

  factory CalendarOccurrence.fromInteraction(InteractionDetail detail) {
    final localStart = detail.occurrenceStartsAt.toLocal();
    final localEnd = detail.occurrenceEndsAt.toLocal();
    return CalendarOccurrence(
      calendarId: detail.calendarId,
      occurrenceId: '${detail.calendarId}:${detail.recurrenceKey}',
      recurrenceKey: detail.recurrenceKey,
      kind: CalendarEventKind.interaction,
      title: detail.title,
      owner: CalendarIdentity(
        id: detail.agent.id,
        name: detail.agent.displayName,
      ),
      facility: detail.facility == null
          ? null
          : CalendarIdentity(
              id: detail.facility!.id,
              name: detail.facility!.displayName,
            ),
      modality: detail.modality,
      startsAt: detail.occurrenceStartsAt,
      endsAt: detail.occurrenceEndsAt,
      localDate: _dateOnly(localStart),
      localStartsAt: _formatTime(localStart),
      localEndsAt: _formatTime(localEnd),
      recurrence: detail.recurrence,
      interaction: CalendarInteractionContext(
        id: detail.id,
        facilityId: detail.facility?.id,
        person: detail.person,
        agentUserId: detail.agent.id,
        modality: detail.modality,
        status: detail.status,
      ),
      canMutate: detail.canMutate,
      timeZone: detail.timeZone,
      durationMinutes: detail.occurrenceEndsAt
          .difference(detail.occurrenceStartsAt)
          .inMinutes,
      version: detail.calendarVersion,
      overrideVersion: detail.overrideVersion,
      recurrenceUntil: detail.recurrenceUntil,
      recurrenceCount: detail.recurrenceCount,
    );
  }

  factory CalendarOccurrence.fromJson(Map<String, dynamic> json) {
    final startsAt = DateTime.parse(json['startsAt'] as String).toUtc();
    final endsAt = DateTime.parse(json['endsAt'] as String).toUtc();
    final localStart = startsAt.toLocal();
    final localEnd = endsAt.toLocal();
    // List DTO: `id` is occurrence key string (`{calendarId}:{recurrenceKey}`).
    // Older fixtures may send numeric `id` + separate `occurrenceId`.
    final occurrenceId = _readOccurrenceId(json['occurrenceId'] ?? json['id']);
    final calendarId = json['calendarId'] != null
        ? readCrmId(json['calendarId'], 'calendarId')
        : readCrmId(json['id'], 'calendarId');
    final ownerUserId =
        readCrmIdOrNull(json['ownerUserId'], 'ownerUserId') ??
        readCrmIdOrNull(
          (json['owner'] as Map<String, dynamic>?)?['id'],
          'owner.id',
        ) ??
        0;
    final interactionJson = json['interaction'] as Map<String, dynamic>?;
    final interaction = interactionJson == null
        ? null
        : CalendarInteractionContext.fromJson(interactionJson);
    final facilityId =
        readCrmIdOrNull(json['facilityId'], 'facilityId') ??
        interaction?.facilityId ??
        0;
    final ownerJson =
        json['owner'] as Map<String, dynamic>? ??
        <String, dynamic>{'name': json['ownerName']};
    final facilityJson = json['facility'] as Map<String, dynamic>?;
    return CalendarOccurrence(
      calendarId: calendarId,
      occurrenceId: occurrenceId,
      recurrenceKey: (json['recurrenceKey'] as String?) ?? occurrenceId,
      anchorLocalDate: json['anchorLocalDate'] as String?,
      anchorLocalTime: json['anchorLocalTime'] as String?,
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
  final int? id;

  @override
  List<Object?> get props => [startsAt, endsAt, id];
}

class CalendarConflict extends Equatable {
  const CalendarConflict({required this.candidate, required this.existing});

  final CalendarConflictInterval candidate;
  final CalendarConflictInterval existing;

  /// Ids are read leniently; the times are what the message is made of.
  ///
  /// A conflict on *create* names its candidate `candidate:<idempotency-key>`,
  /// because the thing being created has no id yet. Demanding a CRM id there
  /// threw, the throw was caught where the whole error payload is parsed, and
  /// the conflict list came back empty — so the rep was told "o horário
  /// solicitado está indisponível" while the server had already said which
  /// appointment was in the way and when. Reproduced on device.
  ///
  /// Lenient, not permissive: a key string still reads as null rather than
  /// being coerced into an id nothing can look up.
  factory CalendarConflict.fromJson(Map<String, dynamic> json) =>
      CalendarConflict(
        candidate: CalendarConflictInterval(
          id: readCrmIdLoose(json['candidateId']),
          startsAt: DateTime.parse(
            (json['candidateStartsAt'] ?? json['startsAt']) as String,
          ).toUtc(),
          endsAt: DateTime.parse(
            (json['candidateEndsAt'] ?? json['endsAt']) as String,
          ).toUtc(),
        ),
        existing: CalendarConflictInterval(
          // CRM calendar/override id only — never occurrence key strings.
          id: readCrmIdLoose(json['existingId']),
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

/// What a visit is called when the rep has not said otherwise.
///
/// Choosing the clinic already names the appointment; asking for a title after
/// that is asking the same question twice, and "Visita" typed by hand is what
/// reps were going to write anyway. Kept in one place so the quick sheet and
/// the full editor agree on the string — that agreement is what lets either of
/// them recognise a title as still automatic and replace it.
String visitTitleForFacility(String facilityName) => 'Visita · $facilityName';

/// What a contact with a doctor is called when the rep has not named it
/// (§15.7.5). "Contato", not "Visita": it may have happened on the phone.
String contactTitleForPerson(String personName) => 'Contato · $personName';

DateTime _dateOnly(DateTime value) =>
    DateTime(value.year, value.month, value.day);

DateTime? _parseUtcOrNull(Object? value) =>
    value is String ? DateTime.parse(value).toUtc() : null;

String _formatTime(DateTime value) =>
    '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';

/// Occurrence list identity — composite string from API, not a CRM bigint.
String _readOccurrenceId(Object? value) {
  if (value is String && value.isNotEmpty) return value;
  if (value is num) return value.toInt().toString();
  throw FormatException(
    'Expected occurrence id string for id, got ${value.runtimeType}',
  );
}
