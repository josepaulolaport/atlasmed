import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/location/data/location_service.dart';
import 'package:geolocator/geolocator.dart';

/// Map points API omits distance — fill from user [origin] (haversine km).
List<NearbyEstablishment> withDistanceFromOrigin(
  List<NearbyEstablishment> points,
  DeviceLocation? origin,
) {
  if (origin == null || points.isEmpty) return points;
  return [
    for (final point in points)
      point.copyWith(
        distanceKm:
            Geolocator.distanceBetween(
              origin.latitude,
              origin.longitude,
              point.latitude,
              point.longitude,
            ) /
            1000,
      ),
  ];
}
