import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/shared/quick_actions.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('quick actions fit a narrow screen with larger text', (
    tester,
  ) async {
    Widget icon(IconData data) => CircleAvatar(
      radius: 18,
      backgroundColor: AppColors.blueLight,
      child: Icon(data, size: 18, color: AppColors.navyBright),
    );

    final actions = [
      QuickActionItem(icon: icon(Icons.phone), label: const Text('Ligar')),
      QuickActionItem(icon: icon(Icons.chat), label: const Text('WhatsApp')),
      QuickActionItem(icon: icon(Icons.route), label: const Text('Rota')),
      QuickActionItem(
        icon: icon(Icons.calendar_month),
        label: const Text('Visita'),
      ),
      QuickActionItem(icon: icon(Icons.note_add), label: const Text('Pedido')),
    ];

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MediaQuery(
            data: const MediaQueryData(
              size: Size(320, 800),
              textScaler: TextScaler.linear(1.4),
            ),
            child: SizedBox(
              width: 320,
              child: DetailQuickActions(
                themeColor: AppColors.navyBright,
                actions: actions,
              ),
            ),
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
    expect(find.text('WhatsApp'), findsOneWidget);
  });
}
