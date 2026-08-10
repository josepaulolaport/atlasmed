import 'package:atlasmed_mobile_app/features/map/data/models/bounds.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/repositories/map_facility_points_repository.dart';
import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_cache_storage.dart';
import 'package:flutter_test/flutter_test.dart';

class _MemoryCacheStorage extends RepositoryCacheStorage {
  const _MemoryCacheStorage();

  @override
  Future<void> clear() async {}

  @override
  Future<void> delete({required String key}) async {}

  @override
  Future<String?> read({required String key}) async => null;

  @override
  Future<void> write({required String key, required String value}) async {}
}

void main() {
  setUp(() {
    BaseRepository.storage = const _MemoryCacheStorage();
  });

  test('map points endpoint includes visible viewport bounds', () {
    final repository = MapFacilityPointsRepository(
      baseUrl: 'https://api.example.com',
      verticalId: 7,
      bounds: const MapBounds(
        southwest: MapCoordinate(latitude: -23.7, longitude: -46.8),
        northeast: MapCoordinate(latitude: -23.4, longitude: -46.5),
      ),
    );

    expect(repository.endpoint.path, '/api/v1/map/facilities/points');
    expect(repository.endpoint.queryParameters, {
      'verticalId': '7',
      'south': '-23.7',
      'west': '-46.8',
      'north': '-23.4',
      'east': '-46.5',
    });
  });
}
