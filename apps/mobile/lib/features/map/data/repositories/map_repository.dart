import 'dart:convert';

import 'package:atlasmed_mobile_app/core/user/repositories/user_assignments_repository.dart';
import 'package:atlasmed_mobile_app/features/location/data/location_service.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import '../models/models.dart';

/// One-shot location port. Its platform implementation must request permission
/// once and never subscribe to location updates.
abstract interface class CurrentLocationService {
  Future<MapCoordinate> getCurrentLocation();
}

/// Map-specific API seam. Facility responses must already be scope-filtered by
/// the backend; the mobile client never attempts to widen a territory scope.
abstract interface class MapRepository {
  Future<List<MapFacility>> getNearbyFacilities(
    double latitude,
    double longitude,
    double radiusKm,
  );

  Future<TerritoryGeometry?> getAssignedTerritory();
}

class MapData {
  final MapCoordinate userLocation;
  final TerritoryGeometry? territory;
  final List<MapFacility> facilities;

  const MapData({
    required this.userLocation,
    required this.territory,
    required this.facilities,
  });
}

// ── Concrete implementations ───────────────────────────────────

/// Uses [LocationService] to resolve the device position once.
class DeviceCurrentLocationService implements CurrentLocationService {
  final LocationService _locationService;

  DeviceCurrentLocationService(this._locationService);

  @override
  Future<MapCoordinate> getCurrentLocation() async {
    final result = await _locationService.requestCurrentLocation();
    return switch (result) {
      LocationAvailable(location: final loc) => MapCoordinate(
        longitude: loc.longitude,
        latitude: loc.latitude,
      ),
      // Fallback to São Paulo center when unavailable for map initial view.
      LocationUnavailable() => const MapCoordinate(
        longitude: -46.6333,
        latitude: -23.5505,
      ),
    };
  }
}

/// Fetches territory boundaries and nearby facilities from the REST API.
class ApiMapRepository implements MapRepository {
  final UserAssignmentsRepository _assignmentsRepo;
  final RepositoryHttpClient _client;
  final String _baseUrl;

  ApiMapRepository({
    required UserAssignmentsRepository assignmentsRepo,
    required RepositoryHttpClient client,
    required String baseUrl,
  }) : _assignmentsRepo = assignmentsRepo,
       _client = client,
       _baseUrl = baseUrl;

  // ── Territory ─────────────────────────────────────────────────

  @override
  Future<TerritoryGeometry?> getAssignedTerritory() async {
    final assignments = await _assignmentsRepo.currentValueOrResolve();
    if (assignments == null || assignments.territories.isEmpty) return null;

    final boundaries = <TerritoryGeometry>[];
    for (final assignment in assignments.territories) {
      final geoJson = await _fetchBoundary(assignment.territoryId);
      if (geoJson != null) {
        boundaries.add(geoJson);
      }
    }

    if (boundaries.isEmpty) return null;
    return _combineBoundaries(boundaries);
  }

  Future<TerritoryGeometry?> _fetchBoundary(String territoryId) async {
    final url = Uri.parse(
      '$_baseUrl/api/v1/territories/$territoryId/boundary',
    );
    final request = RepositoryHttpRequest(url: url);
    final response = await _client.call(request: request);
    if (response.statusCode != 200) return null;

    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return _parseGeoJson(json);
  }

  /// Navigates through GeoJSON Feature / FeatureCollection wrappers to
  /// extract Polygon or MultiPolygon geometry.
  TerritoryGeometry? _parseGeoJson(Map<String, dynamic> json) {
    final type = json['type'] as String?;

    if (type == 'FeatureCollection') {
      final features = json['features'] as List<dynamic>? ?? [];
      if (features.isEmpty) return null;
      return _parseGeoJson(features.first as Map<String, dynamic>);
    }

    if (type == 'Feature') {
      final geometry = json['geometry'] as Map<String, dynamic>?;
      if (geometry == null) return null;
      return _parseGeoJson(geometry);
    }

    if (type == 'Polygon') {
      final coordinates = json['coordinates'] as List<dynamic>;
      final rings = coordinates.map((ring) {
        return (ring as List<dynamic>)
            .map((coord) => _toMapCoordinate(coord as List<dynamic>))
            .toList();
      }).toList();
      return TerritoryGeometry.polygon(rings);
    }

    if (type == 'MultiPolygon') {
      final coordinates = json['coordinates'] as List<dynamic>;
      final polygons = coordinates.map((polygon) {
        return (polygon as List<dynamic>)
            .map((ring) {
              return (ring as List<dynamic>)
                  .map((coord) => _toMapCoordinate(coord as List<dynamic>))
                  .toList();
            })
            .toList();
      }).toList();
      return TerritoryGeometry.multiPolygon(polygons);
    }

    return null;
  }

  MapCoordinate _toMapCoordinate(List<dynamic> coord) => MapCoordinate(
    longitude: (coord[0] as num).toDouble(),
    latitude: (coord[1] as num).toDouble(),
  );

  /// Combines multiple single-territory boundaries into one geometry.
  /// A single result is returned as-is; multiple polygons are merged into a
  /// MultiPolygon FeatureCollection for Mapbox.
  TerritoryGeometry _combineBoundaries(List<TerritoryGeometry> geometries) {
    if (geometries.length == 1) return geometries.first;

    final allPolygons = <List<List<MapCoordinate>>>[];
    for (final geom in geometries) {
      if (geom.type == 'Polygon') {
        allPolygons.add(geom.coordinates.first);
      } else {
        allPolygons.addAll(geom.coordinates);
      }
    }

    if (allPolygons.length == 1) {
      return TerritoryGeometry.polygon(allPolygons.first);
    }
    return TerritoryGeometry.multiPolygon(allPolygons);
  }

  // ── Facilities ────────────────────────────────────────────────

  @override
  Future<List<MapFacility>> getNearbyFacilities(
    double latitude,
    double longitude,
    double radiusKm,
  ) async {
    final base = Uri.parse(_baseUrl);
    final basePath = base.path.endsWith('/')
        ? base.path.substring(0, base.path.length - 1)
        : base.path;
    final url = base.replace(
      path: '$basePath/api/v1/facilities',
      queryParameters: {
        'latitude': latitude.toString(),
        'longitude': longitude.toString(),
        'radiusKm': radiusKm.toString(),
        'page': '1',
        'limit': '100',
      },
    );

    final request = RepositoryHttpRequest(url: url);
    final response = await _client.call(request: request);
    if (response.statusCode != 200) return const [];

    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final data = decoded['data'] as List<dynamic>? ?? [];
    return data.map((item) {
      final map = item as Map<String, dynamic>;
      return MapFacility(
        id: map['id'] as String? ?? '',
        name: map['name'] as String? ?? '',
        coordinate: MapCoordinate(
          longitude: (map['longitude'] as num?)?.toDouble() ?? 0,
          latitude: (map['latitude'] as num?)?.toDouble() ?? 0,
        ),
        distanceKm: (map['distanceKm'] as num?)?.toDouble() ?? 0,
      );
    }).toList();
  }
}
