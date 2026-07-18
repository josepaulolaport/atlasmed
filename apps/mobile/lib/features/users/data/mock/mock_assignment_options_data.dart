import 'dart:math' as math;

import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';

/// Static seed data standing in for the picker sources used by the invite
/// flow and the "manage assignments" sheet.
///
/// Manager [ManagerOption.territoryId] is the manager-zone id; REP patches
/// nest under it via [TerritoryOption.managerTerritoryId]. Managers and
/// territories are also tagged with [sectorIds] / [sectorId] so invite
/// assignment can be scoped per sector on the server.
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

TerritoryGeometry _zoneBoundary({
  required double centerLat,
  required double centerLng,
}) {
  return TerritoryGeometry.polygon([
    _octagon(
      centerLat: centerLat,
      centerLng: centerLng,
      radiusLat: 0.08,
      radiusLng: 0.095,
    ),
  ]);
}

ManagerOption _manager({
  required String id,
  required String name,
  required String territoryId,
  required String territoryName,
  required double centerLat,
  required double centerLng,
  required List<String> sectorIds,
}) {
  return ManagerOption(
    id: id,
    name: name,
    territoryId: territoryId,
    territoryName: territoryName,
    territoryCentroid: MapCoordinate(latitude: centerLat, longitude: centerLng),
    territoryBoundary: _zoneBoundary(
      centerLat: centerLat,
      centerLng: centerLng,
    ),
    sectorIds: sectorIds,
  );
}

final mockManagerOptions = <ManagerOption>[
  _manager(
    id: 'user-fernanda-duarte',
    name: 'Fernanda Duarte',
    territoryId: 'zone-zona-sul',
    territoryName: 'Zona Sul',
    centerLat: -23.6200,
    centerLng: -46.6000,
    sectorIds: const ['sector-oncologia', 'sector-cardiologia'],
  ),
  _manager(
    id: 'user-marcos-lima',
    name: 'Marcos Lima',
    territoryId: 'zone-zona-norte',
    territoryName: 'Zona Norte',
    centerLat: -23.4800,
    centerLng: -46.6255,
    sectorIds: const ['sector-oncologia', 'sector-cardiologia'],
  ),
  _manager(
    id: 'user-renata-souza',
    name: 'Renata Souza',
    territoryId: 'zone-centro',
    territoryName: 'Centro',
    centerLat: -23.5505,
    centerLng: -46.6333,
    sectorIds: const ['sector-oncologia'],
  ),
  _manager(
    id: 'user-eduardo-alves',
    name: 'Eduardo Alves',
    territoryId: 'zone-cardio-oeste',
    territoryName: 'Oeste Cardio',
    centerLat: -23.5417,
    centerLng: -46.7250,
    sectorIds: const ['sector-cardiologia'],
  ),
  _manager(
    id: 'user-otavio-barros',
    name: 'Otávio Barros',
    territoryId: 'zone-leste',
    territoryName: 'Zona Leste',
    centerLat: -23.5400,
    centerLng: -46.4800,
    sectorIds: const ['sector-oncologia', 'sector-cardiologia'],
  ),
];

TerritoryOption _territoryOption({
  required String id,
  required String name,
  required String sectorId,
  required String sectorName,
  required double centerLat,
  required double centerLng,
  String? managerTerritoryId,
  bool isOccupied = false,
  String? assignedUserName,
  double radiusLat = 0.018,
  double radiusLng = 0.022,
}) {
  final ring = _octagon(
    centerLat: centerLat,
    centerLng: centerLng,
    radiusLat: radiusLat,
    radiusLng: radiusLng,
  );
  return TerritoryOption(
    id: id,
    name: name,
    sectorId: sectorId,
    sectorName: sectorName,
    centroid: MapCoordinate(latitude: centerLat, longitude: centerLng),
    boundary: TerritoryGeometry.polygon([ring]),
    managerTerritoryId: managerTerritoryId,
    isOccupied: isOccupied,
    assignedUserName: assignedUserName,
  );
}

final mockTerritoryOptions = <TerritoryOption>[
  // ── Fernanda / Zona Sul ──────────────────────────────────────────
  _territoryOption(
    id: 'territory-sul-onco-a',
    name: 'Sul Onco A — Santo Amaro',
    sectorId: 'sector-oncologia',
    sectorName: 'Oncologia',
    centerLat: -23.6500,
    centerLng: -46.7000,
    managerTerritoryId: 'zone-zona-sul',
    isOccupied: true,
    assignedUserName: 'Bruno Castro',
  ),
  _territoryOption(
    id: 'territory-sul-onco-b',
    name: 'Sul Onco B — Campo Belo',
    sectorId: 'sector-oncologia',
    sectorName: 'Oncologia',
    centerLat: -23.6200,
    centerLng: -46.6700,
    managerTerritoryId: 'zone-zona-sul',
  ),
  _territoryOption(
    id: 'territory-sul-onco-c',
    name: 'Sul Onco C — Brooklin',
    sectorId: 'sector-oncologia',
    sectorName: 'Oncologia',
    centerLat: -23.6100,
    centerLng: -46.6900,
    managerTerritoryId: 'zone-zona-sul',
  ),
  _territoryOption(
    id: 'territory-sul-onco-d',
    name: 'Sul Onco D — Moema',
    sectorId: 'sector-oncologia',
    sectorName: 'Oncologia',
    centerLat: -23.6000,
    centerLng: -46.6600,
    managerTerritoryId: 'zone-zona-sul',
  ),
  _territoryOption(
    id: 'territory-sul-cardio-a',
    name: 'Sul Cardio A — Jabaquara',
    sectorId: 'sector-cardiologia',
    sectorName: 'Cardiologia',
    centerLat: -23.6400,
    centerLng: -46.6400,
    managerTerritoryId: 'zone-zona-sul',
  ),
  _territoryOption(
    id: 'territory-sul-cardio-b',
    name: 'Sul Cardio B — Saúde',
    sectorId: 'sector-cardiologia',
    sectorName: 'Cardiologia',
    centerLat: -23.6150,
    centerLng: -46.6300,
    managerTerritoryId: 'zone-zona-sul',
    isOccupied: true,
    assignedUserName: 'Diego Farias',
  ),
  _territoryOption(
    id: 'territory-sul-cardio-c',
    name: 'Sul Cardio C — Vila Mariana',
    sectorId: 'sector-cardiologia',
    sectorName: 'Cardiologia',
    centerLat: -23.5900,
    centerLng: -46.6350,
    managerTerritoryId: 'zone-zona-sul',
  ),

  // ── Marcos / Zona Norte ──────────────────────────────────────────
  _territoryOption(
    id: 'territory-norte-onco-a',
    name: 'Norte Onco A — Santana',
    sectorId: 'sector-oncologia',
    sectorName: 'Oncologia',
    centerLat: -23.5000,
    centerLng: -46.6300,
    managerTerritoryId: 'zone-zona-norte',
    isOccupied: true,
    assignedUserName: 'Camila Rocha',
  ),
  _territoryOption(
    id: 'territory-norte-onco-b',
    name: 'Norte Onco B — Tucuruvi',
    sectorId: 'sector-oncologia',
    sectorName: 'Oncologia',
    centerLat: -23.4700,
    centerLng: -46.6000,
    managerTerritoryId: 'zone-zona-norte',
  ),
  _territoryOption(
    id: 'territory-norte-onco-c',
    name: 'Norte Onco C — Casa Verde',
    sectorId: 'sector-oncologia',
    sectorName: 'Oncologia',
    centerLat: -23.4900,
    centerLng: -46.6600,
    managerTerritoryId: 'zone-zona-norte',
  ),
  _territoryOption(
    id: 'territory-norte-cardio-a',
    name: 'Norte Cardio A — Vila Guilherme',
    sectorId: 'sector-cardiologia',
    sectorName: 'Cardiologia',
    centerLat: -23.5100,
    centerLng: -46.6100,
    managerTerritoryId: 'zone-zona-norte',
  ),
  _territoryOption(
    id: 'territory-norte-cardio-b',
    name: 'Norte Cardio B — Limão',
    sectorId: 'sector-cardiologia',
    sectorName: 'Cardiologia',
    centerLat: -23.4600,
    centerLng: -46.6500,
    managerTerritoryId: 'zone-zona-norte',
  ),

  // ── Renata / Centro ──────────────────────────────────────────────
  _territoryOption(
    id: 'territory-centro-onco-a',
    name: 'Centro Onco A — República',
    sectorId: 'sector-oncologia',
    sectorName: 'Oncologia',
    centerLat: -23.5450,
    centerLng: -46.6400,
    managerTerritoryId: 'zone-centro',
  ),
  _territoryOption(
    id: 'territory-centro-onco-b',
    name: 'Centro Onco B — Liberdade',
    sectorId: 'sector-oncologia',
    sectorName: 'Oncologia',
    centerLat: -23.5600,
    centerLng: -46.6350,
    managerTerritoryId: 'zone-centro',
  ),
  _territoryOption(
    id: 'territory-centro-onco-c',
    name: 'Centro Onco C — Bela Vista',
    sectorId: 'sector-oncologia',
    sectorName: 'Oncologia',
    centerLat: -23.5550,
    centerLng: -46.6500,
    managerTerritoryId: 'zone-centro',
    isOccupied: true,
    assignedUserName: 'Igor Santana',
  ),
  _territoryOption(
    id: 'territory-centro-onco-d',
    name: 'Centro Onco D — Consolação',
    sectorId: 'sector-oncologia',
    sectorName: 'Oncologia',
    centerLat: -23.5500,
    centerLng: -46.6550,
    managerTerritoryId: 'zone-centro',
  ),

  // ── Eduardo / Oeste Cardio ───────────────────────────────────────
  _territoryOption(
    id: 'territory-oeste-cardio-a',
    name: 'Oeste Cardio A — Pinheiros',
    sectorId: 'sector-cardiologia',
    sectorName: 'Cardiologia',
    centerLat: -23.5600,
    centerLng: -46.7000,
    managerTerritoryId: 'zone-cardio-oeste',
  ),
  _territoryOption(
    id: 'territory-oeste-cardio-b',
    name: 'Oeste Cardio B — Butantã',
    sectorId: 'sector-cardiologia',
    sectorName: 'Cardiologia',
    centerLat: -23.5700,
    centerLng: -46.7200,
    managerTerritoryId: 'zone-cardio-oeste',
  ),
  _territoryOption(
    id: 'territory-oeste-cardio-c',
    name: 'Oeste Cardio C — Lapa',
    sectorId: 'sector-cardiologia',
    sectorName: 'Cardiologia',
    centerLat: -23.5300,
    centerLng: -46.7100,
    managerTerritoryId: 'zone-cardio-oeste',
    isOccupied: true,
    assignedUserName: 'Patricia Gomes',
  ),
  _territoryOption(
    id: 'territory-oeste-cardio-d',
    name: 'Oeste Cardio D — Perdizes',
    sectorId: 'sector-cardiologia',
    sectorName: 'Cardiologia',
    centerLat: -23.5400,
    centerLng: -46.6800,
    managerTerritoryId: 'zone-cardio-oeste',
  ),

  // ── Otávio / Zona Leste ──────────────────────────────────────────
  _territoryOption(
    id: 'territory-leste-onco-a',
    name: 'Leste Onco A — Tatuapé',
    sectorId: 'sector-oncologia',
    sectorName: 'Oncologia',
    centerLat: -23.5400,
    centerLng: -46.5700,
    managerTerritoryId: 'zone-leste',
  ),
  _territoryOption(
    id: 'territory-leste-onco-b',
    name: 'Leste Onco B — Penha',
    sectorId: 'sector-oncologia',
    sectorName: 'Oncologia',
    centerLat: -23.5200,
    centerLng: -46.5400,
    managerTerritoryId: 'zone-leste',
  ),
  _territoryOption(
    id: 'territory-leste-cardio-a',
    name: 'Leste Cardio A — Belém',
    sectorId: 'sector-cardiologia',
    sectorName: 'Cardiologia',
    centerLat: -23.5500,
    centerLng: -46.5900,
    managerTerritoryId: 'zone-leste',
  ),
  _territoryOption(
    id: 'territory-leste-cardio-b',
    name: 'Leste Cardio B — Mooca',
    sectorId: 'sector-cardiologia',
    sectorName: 'Cardiologia',
    centerLat: -23.5600,
    centerLng: -46.6000,
    managerTerritoryId: 'zone-leste',
    isOccupied: true,
    assignedUserName: 'Juliana Pires',
  ),
  _territoryOption(
    id: 'territory-leste-cardio-c',
    name: 'Leste Cardio C — Água Rasa',
    sectorId: 'sector-cardiologia',
    sectorName: 'Cardiologia',
    centerLat: -23.5650,
    centerLng: -46.5600,
    managerTerritoryId: 'zone-leste',
  ),
];

const mockSectorOptions = <SectorOption>[
  SectorOption(id: 'sector-oncologia', name: 'Oncologia'),
  SectorOption(id: 'sector-cardiologia', name: 'Cardiologia'),
];
