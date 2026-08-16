import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility.dart';
import 'package:flutter_test/flutter_test.dart';

/// The clinic header prints the CNES unit type under "Estabelecimento CNPJ".
///
/// The detail payload carried `unitTypeId` and no name, so the app held the
/// fact and could not say it. What decides whether the line renders is this
/// mapping: the header shows it only when it survives as a non-empty string.
Facility facilityFrom(Map<String, dynamic> json) => Facility.fromDTO(
  FacilityDTO.fromMap({
    'id': 1,
    'name': 'Clínica Central',
    'professionalCount': 0,
    ...json,
  }),
);

void main() {
  test('carries the unit type name through to the registration block', () {
    final facility = facilityFrom({
      'unitTypeId': 7,
      'unitTypeName': 'Clinica/Centro de Especialidade',
    });

    expect(
      facility.registration?.unitTypeName,
      'Clinica/Centro de Especialidade',
    );
  });

  test('leaves it null when the clinic has no unit type', () {
    // The header hides the line on null, so this is what keeps a blank row from
    // appearing under the legal type.
    expect(facilityFrom({}).registration?.unitTypeName, isNull);
  });

  test('treats blank and whitespace-only as absent', () {
    // A name trimmed to nothing is not a name. Rendered verbatim it would be an
    // empty line of padding in the navy header, which reads as a layout bug.
    expect(
      facilityFrom({'unitTypeName': ''}).registration?.unitTypeName,
      isNull,
    );
    expect(
      facilityFrom({'unitTypeName': '   '}).registration?.unitTypeName,
      isNull,
    );
  });

  test('keeps the id independent of the name', () {
    // A payload that resolved the id but not the name must not lose the id —
    // filters key on it.
    final facility = facilityFrom({'unitTypeId': 7});

    expect(facility.registration?.unitTypeName, isNull);
    expect(
      FacilityDTO.fromMap({
        'id': 1,
        'name': 'x',
        'professionalCount': 0,
        'unitTypeId': 7,
      }).unitTypeId,
      7,
    );
  });
}
