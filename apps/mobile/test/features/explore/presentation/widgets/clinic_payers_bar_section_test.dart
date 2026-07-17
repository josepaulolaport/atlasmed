import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_payers_bar_section.dart';

void main() {
  testWidgets('shows stacked bar and payer legend', (tester) async {
    const payers = [
      PayerShare(id: '1', name: 'Unimed', sharePercent: 60),
      PayerShare(id: '2', name: 'Particular', sharePercent: 40),
    ];

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: ClinicPayersBarSection(payers: payers)),
      ),
    );

    expect(find.text('Unimed'), findsOneWidget);
    expect(find.text('60%'), findsOneWidget);
    expect(find.text('Particular'), findsOneWidget);
    expect(find.text('40%'), findsOneWidget);
  });

  testWidgets('shows empty state when no payers', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: ClinicPayersBarSection(payers: [])),
      ),
    );

    expect(find.text('Nenhum convênio cadastrado'), findsOneWidget);
  });
}
