import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_service_chips.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Where the clinical focus editor lives.
///
/// It first shipped as an "Editar" chip in the clinic header. The header is
/// what a rep reads on arrival — name, focus, status, address — so putting an
/// edit control in it made the one glanceable surface also the editing one.
/// Every other field of this kind is changed from Dados administrativos, and
/// this now is too.
///
/// Pinned here because the chips widget is shared: an edit affordance added
/// back to it would appear on every surface that draws focus chips, not just
/// the one somebody meant.
ClinicalFocus focus(String name, {bool isPrimary = false}) =>
    ClinicalFocus(id: name.hashCode, name: name, isPrimary: isPrimary);

Widget host(Widget child) => MaterialApp(
  home: Scaffold(body: Center(child: child)),
);

void main() {
  testWidgets('focus chips carry no edit control of their own', (tester) async {
    await tester.pumpWidget(
      host(
        ClinicServiceChips(
          focuses: [focus('Traumatologia e Ortopedia'), focus('Fisioterapia')],
        ),
      ),
    );

    expect(find.text('Traumatologia e Ortopedia'), findsOneWidget);
    expect(find.text('Editar'), findsNothing);
    expect(find.byIcon(Icons.add_rounded), findsNothing);
  });

  testWidgets('nor does the empty state', (tester) async {
    // The empty chip row was the more tempting place to put one, since "Sem
    // foco clínico" reads like a prompt. It is still not an edit surface.
    await tester.pumpWidget(host(const ClinicServiceChips.empty()));

    expect(find.text('Sem foco clínico'), findsOneWidget);
    expect(find.text('Editar'), findsNothing);
  });

  testWidgets('the primary focus still leads the row', (tester) async {
    // Ordering is what the header relies on now that it cannot be edited there:
    // the chip a reader sees first should be the one the clinic leads with.
    await tester.pumpWidget(
      host(
        ClinicServiceChips(
          focuses: [
            focus('Fisioterapia'),
            focus('Traumatologia e Ortopedia', isPrimary: true),
          ],
          maxVisible: 1,
        ),
      ),
    );

    expect(find.text('Traumatologia e Ortopedia'), findsOneWidget);
    expect(find.text('Fisioterapia'), findsNothing);
  });
}
