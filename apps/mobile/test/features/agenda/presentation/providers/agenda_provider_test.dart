import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeCalendarRepository implements CalendarRepositoryContract {
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

  int calls = 0;
  AgendaQuery? lastQuery;

  @override
  Future<List<CalendarOccurrence>> listCalendar({
    required DateTime from,
    required DateTime to,
    int? ownerUserId,
  }) async {
    calls += 1;
    lastQuery = AgendaQuery(from: from, to: to, ownerUserId: ownerUserId);
    return const [];
  }

  @override
  Future<List<CalendarAvailabilityInterval>> getAvailability({
    required DateTime from,
    required DateTime to,
    int? ownerUserId,
  }) => Future.value(const []);

  @override
  Future<InteractionDetail> getInteraction(int id) =>
      throw UnimplementedError();

  @override
  Future<InteractionDetail> startInteraction(
    int id, {
    required int expectedVersion,
    required String idempotencyKey,
    String? startedAt,
  }) => throw UnimplementedError();

  @override
  Future<InteractionDetail> completeInteraction(
    int id, {
    required int expectedVersion,
    required String idempotencyKey,
    String? correctionReason,
    String? completedAt,
  }) => throw UnimplementedError();

  @override
  Future<InteractionDetail> recordArrival({
    required int facilityId,
    required String timeZone,
    required String idempotencyKey,
    String? startedAt,
  }) async => throw UnimplementedError();
}

void main() {
  test(
    'agenda provider is keyed by range and optional owner and refreshes',
    () async {
      final repository = _FakeCalendarRepository();
      final container = ProviderContainer(
        overrides: [calendarRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);
      final query = AgendaQuery(
        from: DateTime(2026, 8, 3),
        to: DateTime(2026, 8, 10),
        ownerUserId: 2,
      );

      await container.read(agendaProvider(query).future);
      expect(repository.calls, 1);
      expect(repository.lastQuery, query);

      container.invalidate(agendaProvider(query));
      await container.read(agendaProvider(query).future);
      expect(repository.calls, 2);
    },
  );
}
