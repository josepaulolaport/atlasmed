import 'package:atlasmed_mobile_app/features/territories/editing/widgets/territory_metadata_form.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  String label({
    bool hasName = true,
    bool hasVertical = true,
    bool needsManagerZone = true,
    bool hasManagerZone = true,
  }) => territoryMetadataMissingLabel(
    hasName: hasName,
    hasVertical: hasVertical,
    needsManagerZone: needsManagerZone,
    hasManagerZone: hasManagerZone,
  );

  test('says nothing when the form is complete', () {
    expect(label(), '');
  });

  test('names the one missing field', () {
    expect(label(hasName: false), 'Falta informar o nome.');
    expect(label(hasVertical: false), 'Falta informar a linha comercial.');
    expect(label(hasManagerZone: false), 'Falta informar a zona de gerente.');
  });

  test('a manager zone is only asked for on a rep patch', () {
    expect(label(needsManagerZone: false, hasManagerZone: false), '');
  });

  test('lists two in field order', () {
    expect(
      label(hasName: false, hasVertical: false),
      'Falta informar o nome e a linha comercial.',
    );
  });

  test('lists all three with a comma and an "e"', () {
    expect(
      label(hasName: false, hasVertical: false, hasManagerZone: false),
      'Falta informar o nome, a linha comercial e a zona de gerente.',
    );
  });
}
