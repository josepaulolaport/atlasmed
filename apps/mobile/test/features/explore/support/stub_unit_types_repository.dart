import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_unit_types_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_unit_types_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Serves the CNES unit type catalog to widget tests without a network call.
///
/// Overrides [refresh] rather than `resolve`: SessionEnvironmentMixin
/// short-circuits refresh when no session is signed in, so a resolve override
/// alone would never be reached and the chips would never render.
class StubUnitTypesRepository extends FacilityUnitTypesRepository {
  StubUnitTypesRepository() : super(baseUrl: 'https://test');

  static const catalogJson =
      '{"data":[{"id":3,"name":"CLINICA/CENTRO DE ESPECIALIDADE"},'
      '{"id":7,"name":"HOSPITAL GERAL","cnesCode":"05"}]}';

  @override
  Future<List<FacilityUnitTypeOption>?> refresh() async {
    final data = fromJson(catalogJson);
    await emit(data: data);
    return data;
  }
}

/// Any widget that shows the clinic filter sheet needs this: the sheet fetches
/// the unit type catalog, and without the override it attempts a real request.
List<Override> stubUnitTypesOverrides() => [
  facilityUnitTypesRepositoryProvider.overrideWithValue(
    StubUnitTypesRepository(),
  ),
];
