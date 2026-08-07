import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/json/crm_id.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/filter_data.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_bucket.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

/// Thin live-map pins from `GET /api/v1/map/facilities/points`.
class MapFacilityPointsPage {
  const MapFacilityPointsPage({required this.points});

  final List<NearbyEstablishment> points;
}

class MapFacilityPointsRepository extends Repository<MapFacilityPointsPage>
    with SessionEnvironmentMixin<MapFacilityPointsPage> {
  MapFacilityPointsRepository({String? baseUrl, this.verticalId})
    : super(
        endpoint: _buildEndpoint(baseUrl ?? AppConfig.apiBaseUrl, verticalId),
        name: 'MapFacilityPointsRepository',
      );

  final int? verticalId;

  static Uri _buildEndpoint(String baseUrl, int? verticalId) {
    final base = Uri.parse(baseUrl);
    final basePath = base.path.endsWith('/')
        ? base.path.substring(0, base.path.length - 1)
        : base.path;
    return base.replace(
      path: '$basePath/api/v1/map/facilities/points',
      queryParameters: {
        if (verticalId != null && verticalId > 0)
          'verticalId': verticalId.toString(),
      },
    );
  }

  static ClinicStatus _statusForBucket(String bucket) => switch (bucket) {
    PurchaseBucketFilter.active => ClinicStatus.active,
    PurchaseBucketFilter.inactive => ClinicStatus.inactive,
    _ => ClinicStatus.rejected,
  };

  @override
  MapFacilityPointsPage fromJson(String json) {
    final decoded = jsonDecode(json);
    if (decoded is! Map<String, dynamic>) {
      return const MapFacilityPointsPage(points: []);
    }
    final features = decoded['features'] as List<dynamic>? ?? const [];
    final points = <NearbyEstablishment>[];
    for (final raw in features) {
      if (raw is! Map<String, dynamic>) continue;
      final geometry = raw['geometry'];
      final properties = raw['properties'];
      if (geometry is! Map<String, dynamic> ||
          properties is! Map<String, dynamic>) {
        continue;
      }
      final coords = geometry['coordinates'];
      if (coords is! List || coords.length < 2) continue;
      final lng = (coords[0] as num?)?.toDouble();
      final lat = (coords[1] as num?)?.toDouble();
      final id = readCrmIdLoose(properties['facilityId']);
      final name = properties['name']?.toString();
      if (lng == null || lat == null || id == null || name == null) continue;
      final rawBucket = properties['purchaseBucket']?.toString();
      final purchaseBucket = PurchaseBucketFilter.values.contains(rawBucket)
          ? rawBucket!
          : PurchaseBucketFilter.neverBought;
      points.add(
        NearbyEstablishment(
          id: id,
          name: name,
          latitude: lat,
          longitude: lng,
          distanceKm: 0,
          purchaseBucket: purchaseBucket,
          status: _statusForBucket(purchaseBucket),
        ),
      );
    }
    return MapFacilityPointsPage(points: points);
  }
}

Future<List<NearbyEstablishment>> fetchMapFacilityPoints({
  int? verticalId,
}) async {
  final repo = MapFacilityPointsRepository(verticalId: verticalId);
  try {
    final page = await repo.currentValueOrResolve();
    return page?.points ?? const [];
  } finally {
    repo.dispose();
  }
}
