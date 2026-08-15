import 'package:atlasmed_mobile_app/features/explore/presentation/contact_actions.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/shared/quick_actions.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Contact shortcuts on a clinic or doctor.
///
/// `QuickActionItem` has always greyed an action whose `onTap` is null, and
/// every caller defeated it: each passed a closure that only discovered inside
/// `launchContactUrl` that there was no number, and answered the tap with "Não
/// há telefone cadastrado". A clinic with an e-mail and no phone offered Ligar
/// and WhatsApp at full strength.

Future<void> pumpAction(
  WidgetTester tester, {
  required Uri? url,
  required List<String> launched,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: Builder(
          builder: (context) => contactQuickAction(
            context: context,
            icon: Icons.phone_rounded,
            color: AppColors.navyBright,
            label: 'Ligar',
            url: url,
            contactLabel: 'telefone',
            launch: (context, {required url, required contactLabel}) async {
              launched.add(contactLabel);
            },
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('is live when there is something to open', (tester) async {
    final launched = <String>[];
    await pumpAction(tester, url: callUrl('21999998888'), launched: launched);

    final item = tester.widget<QuickActionItem>(find.byType(QuickActionItem));
    expect(item.onTap, isNotNull);

    await tester.tap(find.text('Ligar'));
    await tester.pumpAndSettle();
    expect(launched, ['telefone']);
  });

  testWidgets('is inert when there is not', (tester) async {
    // The defect: this used to be tappable, and said so only afterwards.
    final launched = <String>[];
    await pumpAction(tester, url: callUrl(null), launched: launched);

    final item = tester.widget<QuickActionItem>(find.byType(QuickActionItem));
    expect(item.onTap, isNull);

    await tester.tap(find.text('Ligar'), warnIfMissed: false);
    await tester.pumpAndSettle();
    expect(launched, isEmpty);
  });

  testWidgets('an empty string is no number, not a number', (tester) async {
    final launched = <String>[];
    await pumpAction(tester, url: callUrl('   '), launched: launched);

    expect(
      tester.widget<QuickActionItem>(find.byType(QuickActionItem)).onTap,
      isNull,
    );
    expect(launched, isEmpty);
  });

  testWidgets('the disabled action reads as disabled', (tester) async {
    // Greyed, not merely unresponsive — an action that looks available and
    // does nothing is worse than one that says it cannot be used.
    await pumpAction(tester, url: null, launched: []);

    final label = tester.widget<DefaultTextStyle>(
      find
          .ancestor(
            of: find.text('Ligar'),
            matching: find.byType(DefaultTextStyle),
          )
          .first,
    );
    expect(label.style.color, AppColors.gray300);
  });
}
