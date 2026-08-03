import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/screens/interaction_screen.dart';
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
  Future<InteractionDetail> getInteraction(String id) async {
    gets++;
    return detail;
  }

  @override
  Future<InteractionDetail> startInteraction(
    String id, {
    required int expectedVersion,
    required String idempotencyKey,
  }) async {
    starts++;
    detail = _detail(status: InteractionStatus.inProgress, version: 2);
    return detail;
  }

  @override
  Future<InteractionDetail> completeInteraction(
    String id, {
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
  Future<List<CalendarAvailabilityInterval>> getAvailability({
    required DateTime from,
    required DateTime to,
    String? ownerUserId,
  }) async => const [];

  @override
  Future<List<CalendarOccurrence>> listCalendar({
    required DateTime from,
    required DateTime to,
    String? ownerUserId,
  }) async => const [];
}

class _MutationRepository implements CalendarMutationRepositoryContract {
  int cancellations = 0;
  String? calendarId;
  String? recurrenceKey;
  CalendarCancellationCommand? command;
  String? idempotencyKey;

  @override
  Future<void> cancelCalendarOccurrence({
    required String calendarId,
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
    required String calendarId,
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
    required String calendarId,
    required CalendarUpdateCommand command,
    required String idempotencyKey,
  }) async {}

  @override
  Future<void> updateCalendarOccurrence({
    required String calendarId,
    required String recurrenceKey,
    required CalendarOccurrenceUpdateCommand command,
    required String idempotencyKey,
  }) async {}
}

class _NotesRepository extends FacilityNotesRepository {
  _NotesRepository() : super('facility-1');
  int creates = 0;
  int loads = 0;

  @override
  Future<List<FacilityFieldNote>> loadNotes() async {
    loads++;
    return [
      FacilityFieldNote(
        id: 'note-1',
        text: 'Usar estacionamento lateral.',
        createdAt: DateTime.utc(2026, 8, 2),
      ),
    ];
  }

  @override
  Future<FacilityFieldNote> createNote(String note) async {
    creates++;
    return FacilityFieldNote(
      id: 'note-2',
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
}) => InteractionDetail(
  id: 'interaction-1',
  calendarId: 'calendar-1',
  recurrenceKey: '2026-08-03T09:00',
  title: 'Visita comercial',
  modality: CalendarModality.inPerson,
  status: status,
  occurrenceStartsAt: DateTime.utc(2026, 8, 3, 12),
  occurrenceEndsAt: DateTime.utc(2026, 8, 3, 13),
  timeZone: 'America/Sao_Paulo',
  facility: const InteractionFacility(
    id: 'facility-1',
    displayName: 'Clínica Central',
    city: 'São Paulo',
    state: 'SP',
  ),
  agent: const InteractionAgent(id: 'agent-1', displayName: 'Ana Souza'),
  linkedOrders: [
    InteractionLinkedOrder(
      id: 'order-1',
      status: 'PENDING',
      type: 'SALE',
      orderedAt: DateTime.utc(2026, 8, 3, 12, 30),
    ),
  ],
  version: version,
  canMutate: canMutate,
  calendarVersion: calendarVersion ?? version,
);

Widget _app(
  _InteractionRepository repository,
  _NotesRepository notes, {
  _MutationRepository? mutations,
  VoidCallback? onNewOrder,
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
      interactionId: 'interaction-1',
      onNewOrder: onNewOrder,
      onReschedule: onReschedule,
      onCancel: onCancel,
    ),
  ),
);

void main() {
  setUpAll(() {
    BaseRepository.storage = const _MemoryCacheStorage();
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

  testWidgets(
    'production cancel sends occurrence version, reason and stable key',
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
      expect(mutations.calendarId, 'calendar-1');
      expect(mutations.recurrenceKey, '2026-08-03T09:00');
      expect(mutations.command?.expectedVersion, 7);
      expect(mutations.command?.reason, 'Clínica solicitou reagendamento.');
      expect(mutations.idempotencyKey, 'cancel-calendar-1-2026-08-03T09:00-v7');
    },
  );

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
