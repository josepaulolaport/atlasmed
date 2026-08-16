import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/interaction_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _Repository implements CalendarRepositoryContract {
  @override
  Future<InteractionDetail> markInteractionMissed(
    int id, {
    required int expectedVersion,
    InteractionMissReason? reason,
  }) => throw UnimplementedError();

  @override
  Future<InteractionDetail> recordInteractionOutcome(
    int id, {
    required InteractionOutcome outcome,
    required InteractionFollowUp followUp,
  }) async => throw UnimplementedError();

  _Repository({required this.detail, this.startError});

  InteractionDetail detail;
  Object? startError;
  int getCalls = 0;
  int startCalls = 0;
  final List<String> keys = [];

  @override
  Future<InteractionDetail> getInteraction(int id) async {
    getCalls++;
    return detail;
  }

  @override
  Future<InteractionDetail> startInteraction(
    int id, {
    required int expectedVersion,
    required String idempotencyKey,
    String? startedAt,
  }) async {
    startCalls++;
    keys.add(idempotencyKey);
    if (startError != null) throw startError!;
    detail = _detail(status: InteractionStatus.inProgress, version: 2);
    return detail;
  }

  @override
  Future<InteractionDetail> completeInteraction(
    int id, {
    required int expectedVersion,
    required String idempotencyKey,
    String? correctionReason,
    String? completedAt,
  }) async => detail;

  @override
  Future<List<CalendarAvailabilityInterval>> getAvailability({
    required DateTime from,
    required DateTime to,
    int? ownerUserId,
  }) async => const [];

  @override
  Future<List<CalendarOccurrence>> listCalendar({
    required DateTime from,
    required DateTime to,
    int? ownerUserId,
  }) async => const [];

  @override
  Future<InteractionDetail> recordArrival({
    required int facilityId,
    required String timeZone,
    required String idempotencyKey,
    String? startedAt,
  }) async => throw UnimplementedError();
}

InteractionDetail _detail({
  InteractionStatus status = InteractionStatus.scheduled,
  int version = 1,
}) => InteractionDetail(
  id: 1,
  calendarId: 1,
  recurrenceKey: '2026-08-03T09:00',
  title: 'Visita comercial',
  modality: CalendarModality.inPerson,
  status: status,
  occurrenceStartsAt: DateTime.utc(2026, 8, 3, 12),
  occurrenceEndsAt: DateTime.utc(2026, 8, 3, 13),
  timeZone: 'America/Sao_Paulo',
  facility: const InteractionFacility(id: 1, displayName: 'Clínica Central'),
  agent: const InteractionAgent(id: 1, displayName: 'Ana'),
  linkedOrders: const [],
  version: version,
  canMutate: true,
);

void main() {
  test('opening only loads detail and never starts automatically', () async {
    final repository = _Repository(detail: _detail());
    final notifier = InteractionNotifier(repository, 1);

    await Future<void>.delayed(Duration.zero);

    expect(repository.getCalls, 1);
    expect(repository.startCalls, 0);
    expect(
      notifier.state.detail.asData?.value.status,
      InteractionStatus.scheduled,
    );
  });

  test('retry preserves idempotency key after a network error', () async {
    final repository = _Repository(
      detail: _detail(),
      startError: const CalendarNetworkException('offline'),
    );
    final notifier = InteractionNotifier(repository, 1);
    await Future<void>.delayed(Duration.zero);

    expect(await notifier.start(), isFalse);
    repository.startError = null;
    expect(await notifier.start(), isTrue);

    expect(repository.keys, hasLength(2));
    expect(repository.keys.first, repository.keys.last);
    expect(
      notifier.state.detail.asData?.value.status,
      InteractionStatus.inProgress,
    );
  });
}
