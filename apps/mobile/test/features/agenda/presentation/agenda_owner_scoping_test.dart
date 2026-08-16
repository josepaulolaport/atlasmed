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
  List<CalendarOccurrence> occurrences = const [];

  @override
  Future<List<CalendarOccurrence>> listCalendar({
    required DateTime from,
    required DateTime to,
    int? ownerUserId,
  }) async {
    queries.add(AgendaQuery(from: from, to: to, ownerUserId: ownerUserId));
    return occurrences;
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

final _rep = User(
  id: 42,
  email: 'rep@atlasmed.test',
  username: 'rep',
  firstName: 'Adriana',
  status: UserStatus.active,
  emailVerified: true,
  phoneVerified: true,
  twoFactorEnabled: false,
  role: const UserRole(id: 3, name: UserRoleName.rep),
  createdAt: DateTime(2026),
  updatedAt: DateTime(2026),
);

CalendarOccurrence _weekly() => CalendarOccurrence.fromJson({
  'id': 9,
  'occurrenceId': '9:2026-08-22T22:00[America/Sao_Paulo]',
  'calendarId': 9,
  'recurrenceKey': '2026-08-22T22:00[America/Sao_Paulo]',
  'ownerUserId': 42,
  'kind': 'PERSONAL_BLOCK',
  'title': 'Bloqueio semanal',
  'startsAt': '2026-08-23T01:00:00.000Z',
  'endsAt': '2026-08-23T02:00:00.000Z',
  'timeZone': 'America/Sao_Paulo',
  'durationMinutes': 60,
  'recurrence': 'WEEKLY',
  'version': 1,
  'canMutate': true,
});

Future<void> _pump(
  WidgetTester tester,
  Widget screen,
  _QueryRecordingRepository repository, {
  User? user,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        calendarRepositoryProvider.overrideWithValue(repository),
        currentUserProvider.overrideWith((ref) async => user ?? _manager),
        // The day screen reads the rep's working hours to decide where a new
        // appointment opens. Left to the real repository it starts an
        // eight-minute periodic timer the test never outlives.
        userPreferencesValueProvider.overrideWith((ref) async => null),
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

  testWidgets('a repeating appointment asks which one you mean', (
    tester,
  ) async {
    // Editing a *series* had no way in: `AgendaEditRoute` and the whole
    // `CalendarEditorMode.series` branch existed — screen title, "Cancelar
    // toda a série", its own expectedVersion rule, tests — and nothing pushed
    // it. A weekly block could only be moved one week at a time, forever.
    final repository = _QueryRecordingRepository()..occurrences = [_weekly()];

    await _pump(
      tester,
      AgendaDayScreen(day: DateTime(2026, 8, 22)),
      repository,
      user: _rep,
    );

    await tester.tap(find.text('Bloqueio semanal'));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('edit-this-occurrence')), findsOneWidget);
    expect(find.byKey(const Key('edit-whole-series')), findsOneWidget);
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
