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

  factory CalendarIdentity.fromJson(Map<String, dynamic> json) =>
      CalendarIdentity(
        id: json['id'] as String,
        name: (json['name'] ?? json['displayName']) as String,
      );

  @override
  List<Object?> get props => [id, name];
}

class CalendarInteractionContext extends Equatable {
  const CalendarInteractionContext({required this.id, required this.status});

  final String id;
  final InteractionStatus status;

  factory CalendarInteractionContext.fromJson(Map<String, dynamic> json) =>
      CalendarInteractionContext(
        id: json['id'] as String,
        status: _enumFromApi(InteractionStatus.values, json['status']),
      );

  @override
  List<Object?> get props => [id, status];
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
    final localDateRaw = json['localDate'] as String?;
    final localStartsAt =
        json['localStartsAt'] as String? ?? _formatTime(startsAt.toLocal());
    final localEndsAt =
        json['localEndsAt'] as String? ?? _formatTime(endsAt.toLocal());
    return CalendarOccurrence(
      calendarId: (json['calendarId'] ?? json['id']) as String,
      occurrenceId: json['occurrenceId'] as String,
      recurrenceKey: json['recurrenceKey'] as String,
      kind: _enumFromApi(CalendarEventKind.values, json['kind']),
      title: json['title'] as String,
      owner: CalendarIdentity.fromJson(
        (json['owner'] ??
                {'id': json['ownerUserId'], 'name': json['ownerName']})
            as Map<String, dynamic>,
      ),
      facility: json['facility'] == null
          ? null
          : CalendarIdentity.fromJson(json['facility'] as Map<String, dynamic>),
      modality: json['modality'] == null
          ? null
          : _enumFromApi(CalendarModality.values, json['modality']),
      startsAt: startsAt,
      endsAt: endsAt,
      localDate: localDateRaw == null
          ? _dateOnly(startsAt.toLocal())
          : DateTime.parse(localDateRaw),
      localStartsAt: localStartsAt,
      localEndsAt: localEndsAt,
      recurrence: _enumFromApi(
        CalendarRecurrence.values,
        json['recurrence'] ?? 'NONE',
      ),
      interaction: json['interaction'] == null
          ? null
          : CalendarInteractionContext.fromJson(
              json['interaction'] as Map<String, dynamic>,
            ),
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
