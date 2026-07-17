import 'dart:math' as math;

import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';

/// Static seed data standing in for the picker sources used by the "manage
/// assignments" sheet: `GET /access/users?role=MANAGER`,
/// `GET /territories`, and `GET /access/sectors`.
const mockManagerOptions = <ManagerOption>[
  ManagerOption(id: 'user-fernanda-duarte', name: 'Fernanda Duarte'),
  ManagerOption(id: 'user-marcos-lima', name: 'Marcos Lima'),
  ManagerOption(id: 'user-renata-souza', name: 'Renata Souza'),
  ManagerOption(id: 'user-eduardo-alves', name: 'Eduardo Alves'),
];

/// Closed octagonal ring around [center] — a simple, deterministic stand-in
/// for a real hand-drawn territory boundary, just enough to give the
/// assigned-territory map cards a shape to fill/outline.
List<MapCoordinate> _octagon({
  required double centerLat,
  required double centerLng,
  required double radiusLat,
  required double radiusLng,
}) {
  const sides = 8;
  final points = <MapCoordinate>[];
  for (var i = 0; i < sides; i++) {
    final angle = 2 * math.pi * i / sides;
    points.add(
      MapCoordinate(
        latitude: centerLat + math.sin(angle) * radiusLat,
        longitude: centerLng + math.cos(angle) * radiusLng,
      ),
    );
  }
  points.add(points.first);
  return points;
}

TerritoryOption _territoryOption({
  required String id,
  required String name,
  required String sectorId,
  required String sectorName,
  required double centerLat,
  required double centerLng,
}) {
  final ring = _octagon(
    centerLat: centerLat,
    centerLng: centerLng,
    radiusLat: 0.028,
    radiusLng: 0.032,
  );
  return TerritoryOption(
    id: id,
    name: name,
    sectorId: sectorId,
    sectorName: sectorName,
    centroid: MapCoordinate(latitude: centerLat, longitude: centerLng),
    boundary: TerritoryGeometry.polygon([ring]),
  );
}

final mockTerritoryOptions = <TerritoryOption>[
  _territoryOption(
    id: 'territory-zona-sul-onco',
    name: 'Zona Sul — Oncologia',
    sectorId: 'sector-oncologia',
    sectorName: 'Oncologia',
    centerLat: -23.6815,
    centerLng: -46.7089,
  ),
  _territoryOption(
    id: 'territory-zona-norte-onco',
    name: 'Zona Norte — Oncologia',
    sectorId: 'sector-oncologia',
    sectorName: 'Oncologia',
    centerLat: -23.4592,
    centerLng: -46.6255,
  ),
  _territoryOption(
    id: 'territory-zona-leste-cardio',
    name: 'Zona Leste — Cardiologia',
    sectorId: 'sector-cardiologia',
    sectorName: 'Cardiologia',
    centerLat: -23.5445,
    centerLng: -46.4738,
  ),
  _territoryOption(
    id: 'territory-zona-oeste-cardio',
    name: 'Zona Oeste — Cardiologia',
    sectorId: 'sector-cardiologia',
    sectorName: 'Cardiologia',
    centerLat: -23.5417,
    centerLng: -46.7250,
  ),
  _territoryOption(
    id: 'territory-centro-onco',
    name: 'Centro — Oncologia',
    sectorId: 'sector-oncologia',
    sectorName: 'Oncologia',
    centerLat: -23.5505,
    centerLng: -46.6333,
  ),
];

const mockSectorOptions = <SectorOption>[
  SectorOption(id: 'sector-oncologia', name: 'Oncologia'),
  SectorOption(id: 'sector-cardiologia', name: 'Cardiologia'),
];
