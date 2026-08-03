import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_status.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/screens/agenda_screen.dart';
import 'package:atlasmed_mobile_app/features/profile/presentation/providers/profile_provider.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

CalendarOccurrence _occurrence({
  required String id,
  required String date,
  required String time,
  required String title,
  String? facility,
  CalendarModality? modality,
  InteractionStatus? status,
  bool canMutate = true,
}) => CalendarOccurrence(
  calendarId: id,
  occurrenceId: '$id:$date-$time',
  recurrenceKey: '$date-$time',
  kind: status == null
      ? CalendarEventKind.personalBlock
      : CalendarEventKind.interaction,
  title: title,
  owner: const CalendarIdentity(id: 'user-1', name: 'Ana Souza'),
  facility: facility == null
      ? null
      : CalendarIdentity(id: 'facility-1', name: facility),
  modality: modality,
  startsAt: DateTime.parse('${date}T$time:00.000Z'),
  endsAt: DateTime.parse('${date}T10:00:00.000Z'),
  localDate: DateTime.parse(date),
  localStartsAt: time,
  localEndsAt: '10:00',
  recurrence: CalendarRecurrence.none,
  interaction: status == null
      ? null
      : CalendarInteractionContext(id: 'interaction-1', status: status),
  canMutate: canMutate,
);

Widget _app(Widget child) => MaterialApp(theme: AppTheme.light, home: child);

class _QueryRecordingRepository implements CalendarRepositoryContract {
  final List<AgendaQuery> queries = [];

  @override
  Future<List<CalendarOccurrence>> listCalendar({
    required DateTime from,
    required DateTime to,
    String? ownerUserId,
  }) async {
    queries.add(AgendaQuery(from: from, to: to, ownerUserId: ownerUserId));
    return const [];
  }

  @override
  Future<List<CalendarAvailabilityInterval>> getAvailability({
    required DateTime from,
    required DateTime to,
    String? ownerUserId,
  }) async => const [];
}

User _user(String id, String name, UserRoleName role) => User(
  id: id,
  email: '$id@atlasmed.test',
  username: id,
  firstName: name,
  status: UserStatus.active,
  emailVerified: true,
  phoneVerified: true,
  twoFactorEnabled: false,
  role: UserRole(id: 'role-${role.name}', name: role),
  createdAt: DateTime(2026),
  updatedAt: DateTime(2026),
);

void main() {
  testWidgets('shows chronological flat day groups with status icon and text', (
    tester,
  ) async {
    await tester.pumpWidget(
      _app(
        AgendaScreen.content(
          now: DateTime(2026, 8, 3),
          occurrences: [
            _occurrence(
              id: 'second',
              date: '2026-08-03',
              time: '11:00',
              title: 'Reunião interna',
            ),
            _occurrence(
              id: 'first',
              date: '2026-08-03',
              time: '08:30',
              title: 'Visita de acompanhamento',
              facility: 'Clínica Central',
              modality: CalendarModality.inPerson,
              status: InteractionStatus.scheduled,
            ),
            _occurrence(
              id: 'third',
              date: '2026-08-04',
              time: '14:00',
              title: 'Contato remoto',
              facility: 'Clínica Norte',
              modality: CalendarModality.remote,
              status: InteractionStatus.completed,
            ),
          ],
          onPreviousPeriod: () {},
          onNextPeriod: () {},
          onToday: () {},
          onRefresh: () {},
        ),
      ),
    );

    expect(find.text('Agenda'), findsOneWidget);
    expect(find.text('segunda-feira, 3 de agosto'), findsOneWidget);
    expect(find.text('terça-feira, 4 de agosto'), findsOneWidget);
    expect(find.text('08:30'), findsOneWidget);
    expect(find.text('Clínica Central · Presencial'), findsOneWidget);
    expect(find.text('Agendada'), findsOneWidget);
    expect(find.byIcon(Icons.schedule_rounded), findsOneWidget);
    final firstTitle = tester
        .getTopLeft(find.text('Visita de acompanhamento'))
        .dy;
    final secondTitle = tester.getTopLeft(find.text('Reunião interna')).dy;
    expect(firstTitle, lessThan(secondTitle));
  });

  testWidgets('manager selection reloads AgendaQuery with ownerUserId', (
    tester,
  ) async {
    final repository = _QueryRecordingRepository();
    final manager = _user('manager-1', 'Marina', UserRoleName.manager);
    final rep = _user('rep-2', 'Bruno', UserRoleName.rep);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          calendarRepositoryProvider.overrideWithValue(repository),
          currentUserProvider.overrideWith((ref) async => manager),
          agendaOwnerOptionsProvider.overrideWith((ref) async => [rep]),
        ],
        child: MaterialApp(theme: AppTheme.light, home: const AgendaScreen()),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('agenda-owner-selector')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Bruno').last);
    await tester.pumpAndSettle();

    expect(repository.queries.last.ownerUserId, 'rep-2');
  });

  testWidgets('keeps read-only agenda without any create placeholder', (
    tester,
  ) async {
    await tester.pumpWidget(
      _app(
        AgendaScreen.content(
          occurrences: [
            _occurrence(
              id: 'managed',
              date: '2026-08-03',
              time: '09:00',
              title: 'Indisponível',
              canMutate: false,
            ),
          ],
          ownerPicker: const Text('Selecionar representante'),
          onPreviousPeriod: () {},
          onNextPeriod: () {},
          onToday: () {},
          onRefresh: () {},
        ),
      ),
    );

    expect(find.text('Selecionar representante'), findsOneWidget);
    expect(find.text('Indisponível'), findsOneWidget);
    expect(find.byIcon(Icons.add_rounded), findsNothing);
  });

  testWidgets('representative sees the production create action', (
    tester,
  ) async {
    final repository = _QueryRecordingRepository();
    final rep = _user('rep-1', 'Ana', UserRoleName.rep);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          calendarRepositoryProvider.overrideWithValue(repository),
          currentUserProvider.overrideWith((ref) async => rep),
        ],
        child: MaterialApp(theme: AppTheme.light, home: const AgendaScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byTooltip('Criar compromisso'), findsOneWidget);
  });

  testWidgets('filters loaded events locally by title and clinic', (
    tester,
  ) async {
    await tester.pumpWidget(
      _app(
        AgendaScreen.content(
          occurrences: [
            _occurrence(
              id: 'south',
              date: '2026-08-03',
              time: '09:00',
              title: 'Visita de acompanhamento',
              facility: 'Clínica Sul',
              status: InteractionStatus.scheduled,
            ),
            _occurrence(
              id: 'north',
              date: '2026-08-03',
              time: '11:00',
              title: 'Retorno comercial',
              facility: 'Clínica Norte',
              status: InteractionStatus.scheduled,
            ),
          ],
          onPreviousPeriod: () {},
          onNextPeriod: () {},
          onToday: () {},
          onRefresh: () {},
        ),
      ),
    );

    await tester.enterText(find.byKey(const Key('agenda-search')), 'norte');
    await tester.pump();

    expect(find.text('Retorno comercial'), findsOneWidget);
    expect(find.text('Visita de acompanhamento'), findsNothing);
  });

  testWidgets('toolbar stays overflow-free on narrow high text scale', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MediaQuery(
        data: const MediaQueryData(
          size: Size(320, 640),
          textScaler: TextScaler.linear(2),
        ),
        child: MaterialApp(
          theme: AppTheme.light,
          home: AgendaScreen.content(
            occurrences: const [],
            ownerPicker: const Text(
              'Representante com nome longo para validar responsividade',
            ),
            onPreviousPeriod: () {},
            onNextPeriod: () {},
            onToday: () {},
            onRefresh: () {},
          ),
        ),
      ),
    );

    await tester.pump();
    expect(find.byKey(const Key('agenda-search')), findsOneWidget);
  });

  testWidgets('shows loading, empty teaching, and error retry states', (
    tester,
  ) async {
    await tester.pumpWidget(_app(const AgendaScreen.loading()));
    expect(find.byKey(const Key('agenda-loading')), findsOneWidget);

    await tester.pumpWidget(
      _app(
        AgendaScreen.content(
          occurrences: const [],
          onPreviousPeriod: () {},
          onNextPeriod: () {},
          onToday: () {},
          onRefresh: () {},
        ),
      ),
    );
    expect(find.text('Nenhum compromisso neste período'), findsOneWidget);
    expect(
      find.text(
        'Use a agenda para acompanhar visitas, contatos e bloqueios pessoais.',
      ),
      findsOneWidget,
    );

    var retried = false;
    await tester.pumpWidget(
      _app(
        AgendaScreen.error(
          message: 'Não foi possível carregar a agenda.',
          onRetry: () => retried = true,
        ),
      ),
    );
    await tester.tap(find.text('Tentar novamente'));
    expect(retried, isTrue);
  });
}
