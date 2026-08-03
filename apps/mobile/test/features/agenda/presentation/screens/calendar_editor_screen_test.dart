import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/screens/calendar_editor_screen.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _EditorRepository implements CalendarMutationRepositoryContract {
  Object? error;
  CalendarCreateCommand? command;
  int calls = 0;

  @override
  Future<void> createCalendar({
    required CalendarCreateCommand command,
    required String idempotencyKey,
  }) async {
    calls++;
    this.command = command;
    if (error case final submitError?) throw submitError;
  }

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
  @override
  Future<void> cancelCalendar({
    required String calendarId,
    required CalendarCancellationCommand command,
    required String idempotencyKey,
  }) async {}
  @override
  Future<void> cancelCalendarOccurrence({
    required String calendarId,
    required String recurrenceKey,
    required CalendarCancellationCommand command,
    required String idempotencyKey,
  }) async {}
}

Widget _app(_EditorRepository repository, {CalendarEditorPrefill? prefill}) =>
    ProviderScope(
      overrides: [
        calendarMutationRepositoryProvider.overrideWithValue(repository),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        home: CalendarEditorScreen(
          target: CalendarEditorTarget.creating(prefill: prefill),
        ),
      ),
    );

void main() {
  testWidgets(
    'shows full screen pt-BR defaults and recurrence clamp explanation',
    (tester) async {
      await tester.pumpWidget(_app(_EditorRepository()));

      expect(find.text('Novo compromisso'), findsOneWidget);
      expect(find.text('Interação'), findsWidgets);
      expect(find.text('Bloqueio pessoal'), findsOneWidget);
      expect(find.text('Presencial'), findsOneWidget);
      expect(find.text('60 minutos'), findsOneWidget);

      final recurrence = find.byKey(const Key('calendar-recurrence')).first;
      await tester.ensureVisible(recurrence);
      await tester.tap(recurrence);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Mensal').last);
      await tester.pumpAndSettle();

      expect(find.textContaining('último dia válido'), findsOneWidget);
    },
  );

  testWidgets(
    'validates clinic and keeps entered draft after network failure',
    (tester) async {
      final repository = _EditorRepository();
      await tester.pumpWidget(_app(repository));

      await tester.enterText(
        find.byKey(const Key('calendar-title')),
        'Visita importante',
      );
      await tester.tap(find.text('Salvar compromisso'));
      await tester.pump();
      expect(find.text('Selecione uma clínica.'), findsWidgets);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpWidget(
        _app(
          repository,
          prefill: const CalendarEditorPrefill(
            facilityId: 'facility-1',
            facilityName: 'Clínica Central',
            kind: CalendarEventKind.interaction,
          ),
        ),
      );
      repository.error = const CalendarNetworkException('Sem conexão.');
      await tester.enterText(
        find.byKey(const Key('calendar-title')),
        'Visita importante',
      );
      await tester.tap(find.text('Salvar compromisso'));
      await tester.pumpAndSettle();

      expect(find.text('Visita importante'), findsOneWidget);
      expect(find.text('Sem conexão.'), findsOneWidget);
      expect(find.text('Tentar novamente'), findsOneWidget);
    },
  );

  testWidgets('prefilled clinic interaction is visible and submitted', (
    tester,
  ) async {
    final repository = _EditorRepository();
    await tester.pumpWidget(
      _app(
        repository,
        prefill: const CalendarEditorPrefill(
          facilityId: 'facility-1',
          facilityName: 'Clínica Central',
          kind: CalendarEventKind.interaction,
        ),
      ),
    );

    expect(find.text('Clínica Central'), findsOneWidget);
    await tester.enterText(find.byKey(const Key('calendar-title')), 'Visita');
    await tester.tap(find.text('Salvar compromisso'));
    await tester.pumpAndSettle();

    expect(repository.command?.facilityId, 'facility-1');
  });
}
