import 'dart:math' as math;

class MapViewportQuery {
  const MapViewportQuery({
    required this.latitude,
    required this.longitude,
    required this.radiusKm,
  });

  final double latitude;
  final double longitude;
  final double radiusKm;

  Map<String, String> toQueryParameters() => {
    'latitude': latitude.toString(),
    'longitude': longitude.toString(),
    'radiusKm': radiusKm.toString(),
  };

  static double haversineDistanceKm(
    double latitudeA,
    double longitudeA,
    double latitudeB,
    double longitudeB,
  ) {
    const earthRadiusKm = 6371.0088;
    final lat1 = latitudeA * math.pi / 180;
    final lat2 = latitudeB * math.pi / 180;
    final deltaLat = (latitudeB - latitudeA) * math.pi / 180;
    final deltaLng = (longitudeB - longitudeA) * math.pi / 180;
    final a =
        math.sin(deltaLat / 2) * math.sin(deltaLat / 2) +
        math.cos(lat1) *
            math.cos(lat2) *
            math.sin(deltaLng / 2) *
            math.sin(deltaLng / 2);
    return earthRadiusKm * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
  }
}
