import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_unit_types_repository.dart';

/// CNES unit type catalog for Explorar clinic filters.
///
/// App-lifetime like [clinicalFocusesRepositoryProvider]: the filter sheet
/// fetches it and the chip row reads the same cached value for labels, so an
/// autoDispose provider would refetch every time the sheet closes.
final facilityUnitTypesRepositoryProvider =
    Provider<FacilityUnitTypesRepository>((ref) {
      final repository = FacilityUnitTypesRepository();
      ref.onDispose(repository.dispose);
      return repository;
    });
