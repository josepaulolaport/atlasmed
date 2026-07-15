import 'package:atlasmed_mobile_app/features/map/data/repositories/map_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final currentLocationServiceProvider = Provider<CurrentLocationService>((ref) {
  throw UnimplementedError(
    'CurrentLocationService deve ser fornecido pela implementação de geolocalização.',
  );
});

final mapRepositoryProvider = Provider<MapRepository>((ref) {
  throw UnimplementedError(
    'MapRepository deve ser fornecido pela integração com a API.',
  );
});

final mapDataProvider = FutureProvider<MapData>((ref) async {
  final locationService = ref.watch(currentLocationServiceProvider);
  final repository = ref.watch(mapRepositoryProvider);

  final userLocation = await locationService.getCurrentLocation();
  final territory = await repository.getAssignedTerritory();
  if (territory == null) {
    return MapData(
      userLocation: userLocation,
      territory: null,
      facilities: const [],
    );
  }

  final facilities = await repository.getNearbyFacilities();
  return MapData(
    userLocation: userLocation,
    territory: territory,
    facilities: facilities,
  );
});
