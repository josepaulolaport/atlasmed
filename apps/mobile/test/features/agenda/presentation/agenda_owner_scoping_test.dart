import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_status.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/screens/agenda_day_screen.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/screens/agenda_month_screen.dart';
import 'package:atlasmed_mobile_app/features/profile/presentation/providers/profile_provider.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// A manager opening a rep's agenda must see the **rep's** appointments.
///
/// Both screens accepted `ownerUserId` and neither passed it to the query, so
/// the manager saw their own day under somebody else's name — wrong data,
/// confidently presented, and silent. The harness that would have caught it
/// already existed; it was pointed at a screen nothing can reach any more.
class _QueryRecordingRepository implements CalendarRepositoryContract {
  final List<AgendaQuery> queries = [];

  @override
  Future<List<CalendarOccurrence>> listCalendar({
    required DateTime from,
    required DateTime to,
    int? ownerUserId,
  }) async {
    queries.add(AgendaQuery(from: from, to: to, ownerUserId: ownerUserId));
    return const [];
  }

  @override
  Future<List<CalendarAvailabilityInterval>> getAvailability({
    required DateTime from,
    required DateTime to,
    int? ownerUserId,
  }) async => const [];

  @override
  Future<InteractionDetail> getInteraction(int id) async =>
      throw UnimplementedError();

  @override
  Future<InteractionDetail> startInteraction(
    int id, {
    required int expectedVersion,
    required String idempotencyKey,
  }) async => throw UnimplementedError();

  @override
  Future<InteractionDetail> completeInteraction(
    int id, {
    required int expectedVersion,
    required String idempotencyKey,
    String? correctionReason,
  }) async => throw UnimplementedError();

  @override
  Future<InteractionDetail> recordInteractionOutcome(
    int id, {
    required InteractionOutcome outcome,
    required InteractionFollowUp followUp,
  }) async => throw UnimplementedError();
}

final _manager = User(
  id: 9,
  email: 'gestor@atlasmed.test',
  username: 'gestor',
  firstName: 'Gestor',
  status: UserStatus.active,
  emailVerified: true,
  phoneVerified: true,
  twoFactorEnabled: false,
  role: const UserRole(id: 2, name: UserRoleName.manager),
  createdAt: DateTime(2026),
  updatedAt: DateTime(2026),
);

Future<void> _pump(
  WidgetTester tester,
  Widget screen,
  _QueryRecordingRepository repository,
) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        calendarRepositoryProvider.overrideWithValue(repository),
        currentUserProvider.overrideWith((ref) async => _manager),
      ],
      child: MaterialApp(theme: AppTheme.light, home: screen),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('the day screen asks for the rep whose agenda it is', (
    tester,
  ) async {
    final repository = _QueryRecordingRepository();

    await _pump(
      tester,
      AgendaDayScreen(
        day: DateTime(2026, 8, 15),
        ownerUserId: 42,
        ownerName: 'Adriana Oliveira',
      ),
      repository,
    );

    expect(repository.queries, isNotEmpty);
    expect(repository.queries.first.ownerUserId, 42);
  });

  testWidgets('the month screen asks for the rep whose agenda it is', (
    tester,
  ) async {
    final repository = _QueryRecordingRepository();

    await _pump(
      tester,
      const AgendaMonthScreen(ownerUserId: 42, ownerName: 'Adriana Oliveira'),
      repository,
    );

    expect(repository.queries, isNotEmpty);
    expect(repository.queries.first.ownerUserId, 42);
  });

  testWidgets('a rep looking at their own day asks for nobody in particular', (
    tester,
  ) async {
    // Null means "the caller's own", which the API resolves from the token.
    final repository = _QueryRecordingRepository();

    await _pump(
      tester,
      AgendaDayScreen(day: DateTime(2026, 8, 15)),
      repository,
    );

    expect(repository.queries.first.ownerUserId, isNull);
  });

  testWidgets("a manager cannot draw on somebody else's day", (tester) async {
    // Planning it would write to their calendar, which is theirs alone.
    final repository = _QueryRecordingRepository();

    await _pump(
      tester,
      AgendaDayScreen(
        day: DateTime(2026, 8, 15),
        ownerUserId: 42,
        ownerName: 'Adriana Oliveira',
      ),
      repository,
    );

    expect(find.byType(FloatingActionButton), findsNothing);
  });
}
