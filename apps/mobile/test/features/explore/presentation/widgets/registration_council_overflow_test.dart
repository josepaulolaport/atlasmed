import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// The council dropdown, as the "Editar registro" sheet builds it.
///
/// Not the whole sheet: that loads councils over the network. What broke was
/// the field's own layout — a long council name in a fixed row — so this is
/// the same widget with the same content at the same width.
Widget _host({required bool isExpanded}) => MaterialApp(
  home: Scaffold(
    body: Center(
      child: SizedBox(
        width: 402,
        child: DropdownButtonFormField<int>(
          initialValue: 1,
          isExpanded: isExpanded,
          decoration: const InputDecoration(
            labelText: 'Conselho',
            border: OutlineInputBorder(),
          ),
          items: const [
            DropdownMenuItem(
              value: 1,
              child: Text(
                'CRM — Conselho Regional de Medicina',
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
          onChanged: (_) {},
        ),
      ),
    ),
  ),
);

void main() {
  testWidgets('the council name fits the field at phone width', (tester) async {
    await tester.pumpWidget(_host(isExpanded: true));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
  });

  testWidgets('without isExpanded the same content overflows', (tester) async {
    // Guards the fix: this is what the sheet did, and it painted Flutter's
    // yellow-and-black overflow stripes over the selected council.
    await tester.pumpWidget(_host(isExpanded: false));
    await tester.pump();

    expect(
      tester.takeException(),
      isA<FlutterError>(),
      reason: 'the unfixed layout must still be shown to overflow',
    );
  });
}
