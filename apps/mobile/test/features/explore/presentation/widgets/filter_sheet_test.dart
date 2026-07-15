import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/filter_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('keeps selected filters and applies them', (tester) async {
    Map<String, List<String>>? appliedFilters;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: FilterSheet(
            kind: 'clinic',
            filters: const {},
            onApply: (filters) => appliedFilters = filters,
          ),
        ),
      ),
    );

    await tester.tap(find.text('Ativa'));
    await tester.pump();
    await tester.tap(find.text('Aplicar (1)'));

    expect(appliedFilters, {
      'status': ['ativa'],
    });
  });
}
