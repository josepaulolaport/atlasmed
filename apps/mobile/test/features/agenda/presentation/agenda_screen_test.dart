import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/screens/agenda_screen.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
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
  startsAt: DateTime.parse('${date}T${time}:00.000Z'),
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

  testWidgets(
    'shows manager picker hook and keeps read-only agenda without create',
    (tester) async {
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
      expect(find.byTooltip('Criar compromisso'), findsNothing);
      expect(
        find.byTooltip('Criação de compromissos disponível em breve'),
        findsOneWidget,
      );
    },
  );

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
