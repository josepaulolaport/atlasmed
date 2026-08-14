import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_unit_types_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final repository = FacilityUnitTypesRepository(baseUrl: 'https://test');

  tearDownAll(repository.dispose);

  test('requests the unit types catalog endpoint', () {
    expect(repository.endpoint.path, '/api/v1/facilities/unit-types');
  });

  test('parses ids, names, and the optional CNES code', () {
    final options = repository.fromJson(
      '{"data":[{"id":7,"name":"HOSPITAL GERAL","cnesCode":"05"},'
      '{"id":3,"name":"CLINICA/CENTRO DE ESPECIALIDADE"}]}',
    );

    expect(options, hasLength(2));
    // Sorted by label, so 3 comes before 7 despite the response order.
    expect(options.first.id, 3);
    expect(options.first.cnesCode, isNull);
    expect(options.last.cnesCode, '05');
  });

  test('title-cases the CNES names, including compounds', () {
    // CNES stores them in caps. A chip row of shouting is unreadable, and the
    // separator is a slash rather than a space in several of them.
    final options = repository.fromJson(
      '{"data":[{"id":3,"name":"CLINICA/CENTRO DE ESPECIALIDADE"},'
      '{"id":9,"name":"UNIDADE MOVEL PRE-HOSPITALAR"}]}',
    );

    expect(options.map((o) => o.label), [
      'Clinica/Centro De Especialidade',
      'Unidade Movel Pre-Hospitalar',
    ]);
  });

  test('drops rows that could not label a chip', () {
    // A row with no name would render an unlabelled, unremovable filter.
    final options = repository.fromJson(
      '{"data":[{"id":1,"name":""},{"name":"SEM ID"},{"id":4,"name":"POSTO DE SAUDE"}]}',
    );

    expect(options.map((o) => o.id), [4]);
  });

  test('survives a shape it did not expect', () {
    expect(repository.fromJson('{}'), isEmpty);
    expect(repository.fromJson('[]'), isEmpty);
    expect(repository.fromJson('{"data":{}}'), isEmpty);
  });
}
