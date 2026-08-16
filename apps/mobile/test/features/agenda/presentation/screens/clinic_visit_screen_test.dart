import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/screens/clinic_visit_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// The visit screen exists so that tapping "Visita" on a clinic does not ask
/// the rep to re-state what they already said. Both facts are settled before it
/// opens — it is a visit, and it is to this clinic — so neither may appear as a
/// question, and both must still reach the server.
class _SpyRepository implements CalendarMutationRepositoryContract {
  CalendarCreateCommand? created;

  @override
  Future<void> createCalendar({
    required CalendarCreateCommand command,
    required String idempotencyKey,
  }) async {
    created = command;
  }

  @override
  noSuchMethod(Invocation invocation) =>
      throw UnimplementedError('${invocation.memberName} not stubbed');
}

/// Reads only. Overridden because the real one starts an eight-minute refresh
/// timer that outlives the widget tree and trips the test binding.
class _EmptyCalendar implements CalendarRepositoryContract {
  @override
  Future<List<CalendarOccurrence>> listCalendar({
    required DateTime from,
    required DateTime to,
    int? ownerUserId,
  }) async => const [];

  @override
  noSuchMethod(Invocation invocation) =>
      throw UnimplementedError('${invocation.memberName} not stubbed');
}

Future<_SpyRepository> _pump(WidgetTester tester) async {
  // The default 800x600 test view puts the lower half of the form and the
  // pinned submit bar off screen, where a tap cannot reach them.
  tester.view.physicalSize = const Size(1200, 2400);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  final repository = _SpyRepository();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        calendarMutationRepositoryProvider.overrideWithValue(repository),
        calendarRepositoryProvider.overrideWithValue(_EmptyCalendar()),
      ],
      child: const MaterialApp(
        home: ClinicVisitScreen(
          facilityId: 42,
          facilityName: 'Clinica Ortopedica Ipanema',
        ),
      ),
    ),
  );
  await tester.pump();
  return repository;
}

void main() {
  testWidgets('never asks whether this is a visit or a personal block', (
    tester,
  ) async {
    await _pump(tester);

    // The question the general editor opens with, and the whole reason this
    // screen exists.
    expect(find.textContaining('Bloqueio'), findsNothing);
    expect(find.text('Interação'), findsNothing);
  });

  testWidgets('shows the clinic as a fact rather than a picker', (
    tester,
  ) async {
    await _pump(tester);

    expect(find.text('Clinica Ortopedica Ipanema'), findsOneWidget);
    expect(find.text('VISITA A'), findsOneWidget);
    // A clinic picker here could only be used to make the screen wrong.
    expect(find.byType(DropdownButtonFormField<int>), findsOneWidget);
    expect(find.textContaining('Buscar clínica'), findsNothing);
  });

  testWidgets('sends a visit to this clinic without anything else being '
      'chosen', (tester) async {
    final repository = await _pump(tester);

    await tester.tap(find.byKey(const Key('visit-submit')));
    await tester.pump();
    await tester.pump();

    final command = repository.created;
    expect(command, isNotNull);
    // Settled by the screen, not by the rep.
    expect(command!.kind, CalendarEventKind.interaction);
    expect(command.facilityId, 42);
    // And the title arrives filled, so an untouched form is still valid.
    expect(command.title, contains('Clinica Ortopedica Ipanema'));
  });

  testWidgets('the title can be replaced with the real reason', (tester) async {
    final repository = await _pump(tester);

    await tester.enterText(
      find.byKey(const Key('visit-title')),
      'Treinamento da equipe',
    );
    await tester.pump();
    await tester.tap(find.byKey(const Key('visit-submit')));
    await tester.pump();
    await tester.pump();

    expect(repository.created?.title, 'Treinamento da equipe');
    // Still a visit to the same clinic.
    expect(repository.created?.facilityId, 42);
  });

  testWidgets('modality is two buttons, and switching one sends the other', (
    tester,
  ) async {
    final repository = await _pump(tester);

    await tester.tap(find.byKey(const Key('visit-modality-remote')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('visit-submit')));
    await tester.pump();
    await tester.pump();

    expect(repository.created?.modality, CalendarModality.remote);
  });
}
