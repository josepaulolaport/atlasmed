import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/screens/interaction_screen.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_notes_repository.dart';
import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_cache_storage.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _MemoryCacheStorage extends RepositoryCacheStorage {
  const _MemoryCacheStorage();

  @override
  Future<void> clear() async {}

  @override
  Future<void> delete({required String key}) async {}

  @override
  Future<String?> read({required String key}) async => null;

  @override
  Future<void> write({required String key, required String value}) async {}
}

class _InteractionRepository implements CalendarRepositoryContract {
  _InteractionRepository(this.detail);
  InteractionDetail detail;
  int starts = 0;
  int completes = 0;
  int gets = 0;
  String? correctionReason;

  @override
  Future<InteractionDetail> getInteraction(int id) async {
    gets++;
    return detail;
  }

  @override
  Future<InteractionDetail> startInteraction(
    int id, {
    required int expectedVersion,
    required String idempotencyKey,
  }) async {
    starts++;
    detail = _detail(status: InteractionStatus.inProgress, version: 2);
    return detail;
  }

  @override
  Future<InteractionDetail> completeInteraction(
    int id, {
    required int expectedVersion,
    required String idempotencyKey,
    String? correctionReason,
  }) async {
    completes++;
    this.correctionReason = correctionReason;
    detail = _detail(status: InteractionStatus.completed, version: 3);
    return detail;
  }

  @override
  Future<InteractionDetail> recordInteractionOutcome(
    int id, {
    required InteractionOutcome outcome,
    required InteractionFollowUp followUp,
  }) async => throw UnimplementedError();

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
}

class _MutationRepository implements CalendarMutationRepositoryContract {
  int cancellations = 0;
  int? calendarId;
  String? recurrenceKey;
  CalendarCancellationCommand? command;
  String? idempotencyKey;

  @override
  Future<void> cancelCalendarOccurrence({
    required int calendarId,
    required String recurrenceKey,
    required CalendarCancellationCommand command,
    required String idempotencyKey,
  }) async {
    cancellations++;
    this.calendarId = calendarId;
    this.recurrenceKey = recurrenceKey;
    this.command = command;
    this.idempotencyKey = idempotencyKey;
  }

  @override
  Future<void> cancelCalendar({
    required int calendarId,
    required CalendarCancellationCommand command,
    required String idempotencyKey,
  }) async {}

  @override
  Future<void> createCalendar({
    required CalendarCreateCommand command,
    required String idempotencyKey,
  }) async {}

  @override
  Future<void> updateCalendar({
    required int calendarId,
    required CalendarUpdateCommand command,
    required String idempotencyKey,
  }) async {}

  @override
  Future<void> updateCalendarOccurrence({
    required int calendarId,
    required String recurrenceKey,
    required CalendarOccurrenceUpdateCommand command,
    required String idempotencyKey,
  }) async {}
}

class _NotesRepository extends FacilityNotesRepository {
  _NotesRepository() : super(1);
  int creates = 0;
  int loads = 0;

  @override
  Future<List<FacilityFieldNote>> loadNotes() async {
    loads++;
    return [
      FacilityFieldNote(
        id: 1,
        text: 'Usar estacionamento lateral.',
        createdAt: DateTime.utc(2026, 8, 2),
      ),
    ];
  }

  @override
  Future<FacilityFieldNote> createNote(String note) async {
    creates++;
    return FacilityFieldNote(
      id: 2,
      text: note,
      createdAt: DateTime.utc(2026, 8, 3),
    );
  }
}

InteractionDetail _detail({
  InteractionStatus status = InteractionStatus.scheduled,
  bool canMutate = true,
  int version = 1,
  int? calendarVersion,
  int? overrideVersion,
  CalendarRecurrence recurrence = CalendarRecurrence.none,
  bool needsOutcome = false,
}) => InteractionDetail(
  needsOutcome: needsOutcome,
  id: 1,
  calendarId: 1,
  recurrenceKey: '2026-08-03T09:00',
  title: 'Visita comercial',
  modality: CalendarModality.inPerson,
  status: status,
  occurrenceStartsAt: DateTime.utc(2026, 8, 3, 12),
  occurrenceEndsAt: DateTime.utc(2026, 8, 3, 13),
  timeZone: 'America/Sao_Paulo',
  facility: const InteractionFacility(
    id: 1,
    displayName: 'Clínica Central',
    city: 'São Paulo',
    state: 'SP',
  ),
  agent: const InteractionAgent(id: 1, displayName: 'Ana Souza'),
  linkedOrders: [
    InteractionLinkedOrder(
      id: 1,
      status: 'PENDING',
      type: 'SALE',
      orderedAt: DateTime.utc(2026, 8, 3, 12, 30),
    ),
  ],
  version: version,
  canMutate: canMutate,
  calendarVersion: calendarVersion ?? version,
  overrideVersion: overrideVersion,
  recurrence: recurrence,
);

Widget _app(
  _InteractionRepository repository,
  _NotesRepository notes, {
  _MutationRepository? mutations,
  VoidCallback? onReschedule,
  VoidCallback? onCancel,
}) => ProviderScope(
  overrides: [
    calendarRepositoryProvider.overrideWithValue(repository),
    if (mutations != null)
      calendarMutationRepositoryProvider.overrideWithValue(mutations),
    interactionNotesRepositoryProvider.overrideWith((ref, query) {
      ref.onDispose(notes.dispose);
      return notes;
    }),
  ],
  child: MaterialApp(
    theme: AppTheme.light,
    home: InteractionScreen(
      interactionId: 1,
      onReschedule: onReschedule,
      onCancel: onCancel,
    ),
  ),
);

void main() {
  setUpAll(() {
    BaseRepository.storage = const _MemoryCacheStorage();
    // ignore: invalid_use_of_protected_member — test-only reset to avoid leaking a pending Timer across tests.
    SessionEnvironment.instance.timer?.cancel();
    // ignore: invalid_use_of_protected_member
    SessionEnvironment.instance.timer = null;
  });

  tearDown(() {
    // ignore: invalid_use_of_protected_member
    SessionEnvironment.instance.timer?.cancel();
    // ignore: invalid_use_of_protected_member
    SessionEnvironment.instance.timer = null;
  });

  testWidgets('offers the questions when a closed visit has no answers', (
    tester,
  ) async {
    // Most visits are closed for the rep — by the next arrival, or by the
    // workday-end job — so without this prompt those never get answered at all
    // (spec 0016 §15.6.4).
    final repository = _InteractionRepository(
      _detail(status: InteractionStatus.completed, needsOutcome: true),
    );
    await tester.pumpWidget(_app(repository, _NotesRepository()));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Como foi a visita?'),
      300,
      scrollable: find.byType(Scrollable).first,
    );

    expect(find.text('Como foi a visita?'), findsOneWidget);
  });

  testWidgets('does not ask again once the questions are answered', (
    tester,
  ) async {
    final repository = _InteractionRepository(
      _detail(status: InteractionStatus.completed),
    );
    await tester.pumpWidget(_app(repository, _NotesRepository()));
    await tester.pumpAndSettle();

    expect(find.text('Como foi a visita?'), findsNothing);
  });

  testWidgets('opening shows context and does not auto-start', (tester) async {
    final repository = _InteractionRepository(_detail());
    await tester.pumpWidget(_app(repository, _NotesRepository()));
    await tester.pumpAndSettle();

    expect(repository.starts, 0);
    expect(find.text('Clínica Central'), findsOneWidget);
    expect(find.text('Presencial'), findsOneWidget);
    expect(find.text('Pedidos vinculados (1)'), findsOneWidget);
    expect(find.textContaining('Usar estacionamento lateral.'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Iniciar interação'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Iniciar interação'), findsOneWidget);
  });

  testWidgets('a scheduled interaction offers no new-order action', (
    tester,
  ) async {
    // Scheduled and in-progress are the two states that used to show it. The
    // flow it opened could not be finished — checkout wants a clinic plus an
    // interaction or a doctor, and its pickers are stubs over empty lists — so
    // the action is gone rather than present and failing at the last step.
    final repository = _InteractionRepository(_detail());
    await tester.pumpWidget(_app(repository, _NotesRepository()));
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Iniciar interação'),
      300,
      scrollable: find.byType(Scrollable).first,
    );

    // Starting the interaction is still offered; only ordering is withdrawn.
    expect(find.text('Iniciar interação'), findsOneWidget);
    expect(find.text('Novo pedido'), findsNothing);
  });

  testWidgets('explicit early start refreshes the workspace', (tester) async {
    final repository = _InteractionRepository(_detail());
    await tester.pumpWidget(_app(repository, _NotesRepository()));
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Iniciar interação'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Iniciar interação'));
    await tester.pumpAndSettle();

    expect(repository.starts, 1);
    expect(find.text('Concluir interação'), findsOneWidget);
  });

  testWidgets('scheduled attendance exposes reschedule and cancel callbacks', (
    tester,
  ) async {
    var rescheduled = false;
    var cancelled = false;
    final repository = _InteractionRepository(_detail());
    await tester.pumpWidget(
      _app(
        repository,
        _NotesRepository(),
        onReschedule: () => rescheduled = true,
        onCancel: () => cancelled = true,
      ),
    );
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Reagendar'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Reagendar'));
    await tester.ensureVisible(find.text('Cancelar agendamento'));
    await tester.pump();
    await tester.tap(find.text('Cancelar agendamento'));

    expect(rescheduled, isTrue);
    expect(cancelled, isTrue);
  });

  testWidgets('recurring attendance labels occurrence reschedule explicitly', (
    tester,
  ) async {
    final repository = _InteractionRepository(
      _detail(recurrence: CalendarRecurrence.weekly),
    );
    await tester.pumpWidget(
      _app(
        repository,
        _NotesRepository(),
        onReschedule: () {},
        onCancel: () {},
      ),
    );
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Reagendar esta ocorrência'),
      300,
      scrollable: find.byType(Scrollable).first,
    );

    expect(find.text('Reagendar esta ocorrência'), findsOneWidget);
    expect(find.text('Cancelar esta ocorrência'), findsOneWidget);
  });

  testWidgets('missed attendance exposes only correction action', (
    tester,
  ) async {
    final repository = _InteractionRepository(
      _detail(status: InteractionStatus.notCompleted),
    );
    await tester.pumpWidget(
      _app(
        repository,
        _NotesRepository(),
        onReschedule: () {},
        onCancel: () {},
      ),
    );
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Corrigir como concluído'),
      300,
      scrollable: find.byType(Scrollable).first,
    );

    expect(find.text('Corrigir como concluído'), findsOneWidget);
    expect(find.text('Iniciar interação'), findsNothing);
    expect(find.text('Concluir interação'), findsNothing);
    expect(find.text('Novo pedido'), findsNothing);
    expect(find.text('Reagendar'), findsNothing);
    expect(find.text('Reagendar esta ocorrência'), findsNothing);
    expect(find.text('Cancelar agendamento'), findsNothing);
    expect(find.text('Cancelar esta ocorrência'), findsNothing);
  });

  testWidgets(
    'first production cancel sends override version 0, reason and stable key',
    (tester) async {
      final repository = _InteractionRepository(
        _detail(version: 7, calendarVersion: 7),
      );
      final mutations = _MutationRepository();
      await tester.pumpWidget(
        _app(repository, _NotesRepository(), mutations: mutations),
      );
      await tester.pumpAndSettle();

      await tester.scrollUntilVisible(
        find.text('Reagendar'),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.ensureVisible(find.text('Cancelar agendamento'));
      await tester.pump();
      await tester.tap(find.text('Cancelar agendamento'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const Key('interaction-cancel-reason')),
        'Clínica solicitou reagendamento.',
      );
      await tester.tap(find.text('Confirmar cancelamento'));
      await tester.pumpAndSettle();

      expect(mutations.cancellations, 1);
      expect(mutations.calendarId, 1);
      expect(mutations.recurrenceKey, '2026-08-03T09:00');
      expect(mutations.command?.expectedVersion, 0);
      expect(mutations.command?.reason, 'Clínica solicitou reagendamento.');
      expect(mutations.idempotencyKey, 'cancel-1-2026-08-03T09:00-v0');
    },
  );

  testWidgets('subsequent production cancel sends current override version', (
    tester,
  ) async {
    final repository = _InteractionRepository(
      _detail(version: 7, calendarVersion: 7, overrideVersion: 2),
    );
    final mutations = _MutationRepository();
    await tester.pumpWidget(
      _app(repository, _NotesRepository(), mutations: mutations),
    );
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Reagendar'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    final cancelButton = find.widgetWithText(
      TextButton,
      'Cancelar agendamento',
    );
    await tester.ensureVisible(cancelButton);
    await tester.pump();
    await tester.tap(cancelButton);
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const Key('interaction-cancel-reason')),
      'Clínica solicitou reagendamento.',
    );
    await tester.tap(find.text('Confirmar cancelamento'));
    await tester.pumpAndSettle();

    expect(mutations.command?.expectedVersion, 2);
    expect(mutations.idempotencyKey, 'cancel-1-2026-08-03T09:00-v2');
  });

  testWidgets('pull to refresh reloads interaction and facility notes', (
    tester,
  ) async {
    final repository = _InteractionRepository(_detail());
    final notes = _NotesRepository();
    await tester.pumpWidget(_app(repository, notes));
    await tester.pumpAndSettle();

    expect(repository.gets, 1);
    expect(notes.loads, 1);

    await tester.drag(find.byType(ListView), const Offset(0, 400));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(repository.gets, 2);
    expect(notes.loads, 2);
  });

  testWidgets(
    'cancelled attendance displays status without prohibited actions',
    (tester) async {
      final repository = _InteractionRepository(
        _detail(status: InteractionStatus.cancelled),
      );
      await tester.pumpWidget(_app(repository, _NotesRepository()));
      await tester.pumpAndSettle();

      expect(find.text('Cancelado'), findsOneWidget);
      expect(find.text('Iniciar interação'), findsNothing);
      expect(find.text('Concluir interação'), findsNothing);
      expect(find.text('Corrigir como concluído'), findsNothing);
      expect(find.text('Novo pedido'), findsNothing);
      expect(find.text('Reagendar'), findsNothing);
      expect(find.text('Cancelar agendamento'), findsNothing);
    },
  );

  testWidgets('manager view is read-only and hides note composer', (
    tester,
  ) async {
    final repository = _InteractionRepository(_detail(canMutate: false));
    await tester.pumpWidget(_app(repository, _NotesRepository()));
    await tester.pumpAndSettle();

    expect(find.text('Visualização somente leitura'), findsOneWidget);
    expect(find.text('Iniciar interação'), findsNothing);
    expect(find.text('Novo pedido'), findsNothing);
    expect(find.text('Adicionar nota'), findsNothing);
  });

  testWidgets('not-completed correction requires justification', (
    tester,
  ) async {
    final repository = _InteractionRepository(
      _detail(status: InteractionStatus.notCompleted),
    );
    await tester.pumpWidget(_app(repository, _NotesRepository()));
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Corrigir como concluído'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Corrigir como concluído'));
    await tester.pumpAndSettle();
    expect(find.text('Informe a justificativa da correção.'), findsNothing);
    await tester.tap(find.text('Confirmar correção'));
    await tester.pump();
    expect(find.text('Informe a justificativa da correção.'), findsOneWidget);

    await tester.enterText(
      find.byKey(const Key('interaction-correction-reason')),
      'Atendimento confirmado por telefone.',
    );
    await tester.tap(find.text('Confirmar correção'));
    await tester.pumpAndSettle();

    expect(repository.completes, 1);
    expect(repository.correctionReason, 'Atendimento confirmado por telefone.');
  });
}
