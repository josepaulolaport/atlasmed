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
  String? correctionReason;

  @override
  Future<InteractionDetail> getInteraction(String id) async => detail;

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

class _NotesRepository extends FacilityNotesRepository {
  _NotesRepository() : super('facility-1');
  int creates = 0;

  @override
  Future<List<FacilityFieldNote>> loadNotes() async => [
    FacilityFieldNote(
      id: 'note-1',
      text: 'Usar estacionamento lateral.',
      createdAt: DateTime.utc(2026, 8, 2),
    ),
  ];

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
);

Widget _app(
  _InteractionRepository repository,
  _NotesRepository notes, {
  VoidCallback? onNewOrder,
}) => ProviderScope(
  overrides: [
    calendarRepositoryProvider.overrideWithValue(repository),
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
      find.text('Iniciar atendimento'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Iniciar atendimento'), findsOneWidget);
  });

  testWidgets('explicit early start refreshes the workspace', (tester) async {
    final repository = _InteractionRepository(_detail());
    await tester.pumpWidget(_app(repository, _NotesRepository()));
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Iniciar atendimento'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Iniciar atendimento'));
    await tester.pumpAndSettle();

    expect(repository.starts, 1);
    expect(find.text('Concluir atendimento'), findsOneWidget);
  });

  testWidgets('manager view is read-only and hides note composer', (
    tester,
  ) async {
    final repository = _InteractionRepository(_detail(canMutate: false));
    await tester.pumpWidget(_app(repository, _NotesRepository()));
    await tester.pumpAndSettle();

    expect(find.text('Visualização somente leitura'), findsOneWidget);
    expect(find.text('Iniciar atendimento'), findsNothing);
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
