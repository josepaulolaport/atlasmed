import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_summary.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/widgets/cpf_warning_card.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/tax_identifier.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_cpf_warning.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Future<void> pump(WidgetTester tester, Widget child) => tester.pumpWidget(
  MaterialApp(
    home: Scaffold(body: SingleChildScrollView(child: child)),
  ),
);

void main() {
  group('CpfWarningCard', () {
    testWidgets('renders nothing when there is nothing to fix', (tester) async {
      // A permanent "0 pendentes" would hold the slot and train reps to stop
      // reading it.
      await pump(
        tester,
        const CpfWarningCard(
          issues: DashboardCpfIssues(missing: 0, invalid: 0),
        ),
      );

      expect(find.byType(Card), findsNothing);
      expect(find.textContaining('CPF'), findsNothing);
    });

    testWidgets('shows only the row that has a count', (tester) async {
      await pump(
        tester,
        const CpfWarningCard(
          issues: DashboardCpfIssues(missing: 3, invalid: 0),
        ),
      );

      expect(find.text('Sem CPF cadastrado'), findsOneWidget);
      expect(find.text('CPF inválido'), findsNothing);
      expect(find.text('3'), findsWidgets);
    });

    testWidgets('shows both rows and their sum in the header', (tester) async {
      await pump(
        tester,
        const CpfWarningCard(
          issues: DashboardCpfIssues(missing: 3, invalid: 2),
        ),
      );

      expect(find.text('Sem CPF cadastrado'), findsOneWidget);
      expect(find.text('CPF inválido'), findsOneWidget);
      expect(find.text('5'), findsOneWidget);
    });

    testWidgets('sends the API value the list filter expects', (tester) async {
      // The card, the route and the query must agree on this spelling; the API
      // 400s on anything else rather than returning an unfiltered list.
      final tapped = <String>[];
      await pump(
        tester,
        CpfWarningCard(
          issues: const DashboardCpfIssues(missing: 1, invalid: 1),
          onTapStatus: tapped.add,
        ),
      );

      await tester.tap(find.text('Sem CPF cadastrado'));
      await tester.tap(find.text('CPF inválido'));

      expect(tapped, ['missing', 'invalid']);
    });
  });

  group('ClinicCpfWarning', () {
    testWidgets('stays hidden for a CPF clinic with a valid CPF', (
      tester,
    ) async {
      await pump(
        tester,
        const ClinicCpfWarning(
          legalDocumentType: 'CPF',
          legalDocument: '529.982.247-25',
        ),
      );

      expect(find.byIcon(Icons.warning_amber_rounded), findsNothing);
    });

    testWidgets('stays hidden for a CNPJ clinic with no document', (
      tester,
    ) async {
      // A real problem, but not this warning's — and saying "CPF não
      // cadastrado" on a company would just be wrong.
      await pump(
        tester,
        const ClinicCpfWarning(legalDocumentType: 'CNPJ', legalDocument: null),
      );

      expect(find.byIcon(Icons.warning_amber_rounded), findsNothing);
    });

    testWidgets('names the two problems differently', (tester) async {
      await pump(
        tester,
        const ClinicCpfWarning(legalDocumentType: 'CPF', legalDocument: '  '),
      );
      expect(find.text('CPF não cadastrado'), findsOneWidget);

      await pump(
        tester,
        const ClinicCpfWarning(
          legalDocumentType: 'CPF',
          legalDocument: '529.982.247-24',
        ),
      );
      expect(find.text('CPF inválido'), findsOneWidget);
    });

    testWidgets('offers the route to fix it, and opens it', (tester) async {
      var opened = 0;
      await pump(
        tester,
        ClinicCpfWarning(
          legalDocumentType: 'CPF',
          legalDocument: null,
          onOpenAdminInfo: () => opened++,
        ),
      );

      expect(find.text('Informar em Dados administrativos'), findsOneWidget);
      await tester.tap(find.text('CPF não cadastrado'));
      expect(opened, 1);
    });

    testWidgets('drops the call to action when there is nowhere to go', (
      tester,
    ) async {
      await pump(
        tester,
        const ClinicCpfWarning(legalDocumentType: 'CPF', legalDocument: null),
      );

      expect(find.text('CPF não cadastrado'), findsOneWidget);
      expect(find.text('Informar em Dados administrativos'), findsNothing);
    });
  });

  group('cpfIssueFor drives both widgets', () {
    test('agrees with what the warnings render', () {
      // The card counts what the server found; this banner decides per clinic.
      // Both must mean the same thing by "missing" and "invalid" or a rep sees
      // a clinic in the missing list showing an invalid banner.
      expect(
        cpfIssueFor(legalDocumentType: 'CPF', legalDocument: ' '),
        CpfIssue.missing,
      );
      expect(
        cpfIssueFor(legalDocumentType: 'CPF', legalDocument: '11111111111'),
        CpfIssue.invalid,
      );
    });
  });
}
