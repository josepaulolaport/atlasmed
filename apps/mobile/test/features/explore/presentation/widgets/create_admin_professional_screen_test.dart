import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/create_admin_professional_screen.dart';
import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// "Novo profissional administrativo".
///
/// It was a bottom sheet, and the form outgrew it: four fields plus a toggle
/// per role — eight today — left it taller than the screen, so its own title
/// sat under the status bar and collided with the Dynamic Island, and the save
/// button was below the fold. It is a pushed screen now.

Future<void> pumpScreen(
  WidgetTester tester, {
  AdministrativeProfessional? existing,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light,
      home: CreateAdminProfessionalScreen(existing: existing),
    ),
  );
  // One frame only: the role catalogue fetch never resolves in a test, and
  // settling would wait for it.
  await tester.pump();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  // The role-catalogue repository carries a periodic refresh timer, and a
  // widget test fails on any timer still pending at teardown.
  BaseRepository.autoRefreshEnabled = false;

  testWidgets('the title clears the status bar', (tester) async {
    await pumpScreen(tester);

    // In an app bar rather than as the first thing in a scroll view — that is
    // what keeps it below the notch on every device.
    expect(
      find.descendant(
        of: find.byType(AppBar),
        matching: find.text('Novo profissional'),
      ),
      findsOneWidget,
    );
    final titleTop = tester.getTopLeft(find.text('Novo profissional')).dy;
    expect(titleTop, greaterThan(0));
  });

  testWidgets('it is a screen, with a way back', (tester) async {
    await pumpScreen(tester);

    expect(find.byType(Scaffold), findsOneWidget);
    expect(find.byType(AppBar), findsOneWidget);
  });

  testWidgets('the save button is reachable without scrolling', (tester) async {
    // It used to be the last widget in the scroll view, under eight role
    // toggles, so the form had to be scrolled to its end to be submitted.
    await pumpScreen(tester);

    final button = find.widgetWithText(FilledButton, 'Criar perfil');
    expect(button, findsOneWidget);

    final buttonRect = tester.getRect(button);
    final screen = tester.getSize(find.byType(Scaffold));
    expect(buttonRect.bottom, lessThanOrEqualTo(screen.height));
    expect(buttonRect.top, greaterThan(screen.height / 2));
  });

  testWidgets('editing says so, in both the title and the button', (
    tester,
  ) async {
    await pumpScreen(
      tester,
      existing: const AdministrativeProfessional(
        id: 7,
        name: 'Marta Souza',
        roleTitle: 'Compras',
      ),
    );

    expect(find.text('Editar profissional'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Salvar'), findsOneWidget);
    // And it opens holding what it was given.
    expect(find.text('Marta Souza'), findsOneWidget);
  });

  testWidgets('a catalogue that fails to load still lets you save', (
    tester,
  ) async {
    // There is no network here, so the fetch fails and the toggles come back
    // empty. A contact with no roles is a legitimate contact; blocking the
    // button would strand the rep on a form they cannot submit.
    await pumpScreen(tester);
    await tester.pump();

    final button = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Criar perfil'),
    );
    expect(button.onPressed, isNotNull);
  });
}
