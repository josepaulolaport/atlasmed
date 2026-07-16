import 'dart:math' as math;

import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart'
    show TerritoryGeometry;
import 'package:atlasmed_mobile_app/features/territories/data/models/sector.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_type.dart';

// ======================================================================
// Illustrative mock dataset — 2 healthcare sectors, each with 2 manager
// zones split into 3 rep patches (Norte/Centro/Sul), laid out around
// São Paulo as irregular, hand-picked-looking blobs rather than perfect
// rectangles — closer to how real district/territory boundaries read on
// a map. One patch is deliberately a MultiPolygon (a detached exclave)
// so multi-part territories get exercised too. Not real geometry; only
// meant to exercise the viewing UI before the screen is wired to the
// real territories API.
// ======================================================================

const managerZoneType = TerritoryType(
  id: 'tt-manager-zone',
  slug: 'manager_zone',
  name: 'Zona de Gerente',
  assignsClinics: false,
  assignableToManagers: true,
);

const repPatchType = TerritoryType(
  id: 'tt-patch',
  slug: 'patch',
  name: 'Área de Representante',
  assignsClinics: true,
  assignableToManagers: false,
);

final mockSectors = <Sector>[
  const Sector(id: 'sector-oncologia', slug: 'oncologia', name: 'Oncologia'),
  const Sector(
    id: 'sector-cardiologia',
    slug: 'cardiologia',
    name: 'Cardiologia',
  ),
];

class _ManagerZoneSpec {
  final String idSuffix;
  final String name;
  final String sectorId;
  final double centerLat;
  final double centerLng;
  final double halfWidthLng;
  final double halfHeightLat;
  final int baseClinicCount;
  final int baseUserCount;
  final String? managerName;
  final List<String?> repNames;

  const _ManagerZoneSpec({
    required this.idSuffix,
    required this.name,
    required this.sectorId,
    required this.centerLat,
    required this.centerLng,
    required this.halfWidthLng,
    required this.halfHeightLat,
    required this.baseClinicCount,
    required this.baseUserCount,
    required this.managerName,
    required this.repNames,
  });
}

const _zoneSpecs = <_ManagerZoneSpec>[
  _ManagerZoneSpec(
    idSuffix: 'onco-oeste',
    name: 'Zona Oncologia Oeste',
    sectorId: 'sector-oncologia',
    centerLat: -23.53,
    centerLng: -46.72,
    halfWidthLng: 0.045,
    halfHeightLat: 0.035,
    baseClinicCount: 18,
    baseUserCount: 3,
    managerName: 'Fernanda Duarte',
    repNames: ['Bruno Castro', 'Camila Rocha', null],
  ),
  _ManagerZoneSpec(
    idSuffix: 'onco-sudeste',
    name: 'Zona Oncologia Sudeste',
    sectorId: 'sector-oncologia',
    centerLat: -23.60,
    centerLng: -46.60,
    halfWidthLng: 0.045,
    halfHeightLat: 0.035,
    baseClinicCount: 22,
    baseUserCount: 4,
    managerName: 'Marcos Lima',
    repNames: ['Diego Farias', 'Juliana Pires', 'Lucas Tavares'],
  ),
  _ManagerZoneSpec(
    idSuffix: 'cardio-nordeste',
    name: 'Zona Cardiologia Nordeste',
    sectorId: 'sector-cardiologia',
    centerLat: -23.50,
    centerLng: -46.56,
    halfWidthLng: 0.045,
    halfHeightLat: 0.035,
    baseClinicCount: 15,
    baseUserCount: 3,
    managerName: 'Renata Souza',
    repNames: [null, 'Patrícia Gomes', 'Rafael Nogueira'],
  ),
  _ManagerZoneSpec(
    idSuffix: 'cardio-sudoeste',
    name: 'Zona Cardiologia Sudoeste',
    sectorId: 'sector-cardiologia',
    centerLat: -23.65,
    centerLng: -46.73,
    halfWidthLng: 0.045,
    halfHeightLat: 0.035,
    baseClinicCount: 20,
    baseUserCount: 4,
    managerName: 'Eduardo Alves',
    repNames: ['Talita Ramos', 'Vinícius Prado', null],
  ),
];

const _patchNames = ['Norte', 'Centro', 'Sul'];

/// North-to-south position (as a fraction of the zone's half-height) of
/// each patch's own center, so "Norte" actually sits north of "Sul".
const _patchLatOffsets = [0.62, 0.0, -0.62];

/// Closed, organically-irregular polygon ring — a deterministic
/// pseudo-random blob instead of a perfect rectangle, so mock
/// territories read like real, hand-drawn district boundaries. The same
/// [seed] always produces the same shape.
List<MapCoordinate> _territoryRing({
  required double centerLat,
  required double centerLng,
  required double radiusLng,
  required double radiusLat,
  required int seed,
  int vertexCount = 11,
}) {
  final random = math.Random(seed);
  final angleStep = 2 * math.pi / vertexCount;
  final points = <MapCoordinate>[];

  for (var i = 0; i < vertexCount; i++) {
    // Jitter is capped well under half a step so vertices can't cross
    // their neighbors and self-intersect the ring.
    final jitter = (random.nextDouble() - 0.5) * angleStep * 0.7;
    final angle = angleStep * i + jitter;
    final radiusFactor = 0.66 + random.nextDouble() * 0.5;
    points.add(
      MapCoordinate(
        latitude: centerLat + math.sin(angle) * radiusLat * radiusFactor,
        longitude: centerLng + math.cos(angle) * radiusLng * radiusFactor,
      ),
    );
  }
  points.add(points.first);
  return points;
}

MapCoordinate _ringCentroid(List<MapCoordinate> ring) {
  final points = ring.take(ring.length - 1).toList();
  final lat =
      points.map((p) => p.latitude).reduce((a, b) => a + b) / points.length;
  final lng =
      points.map((p) => p.longitude).reduce((a, b) => a + b) / points.length;
  return MapCoordinate(latitude: lat, longitude: lng);
}

List<Territory> _buildMockTerritories() {
  final territories = <Territory>[];

  for (final zoneSpec in _zoneSpecs) {
    final zoneId = 'territory-zone-${zoneSpec.idSuffix}';
    final zoneRing = _territoryRing(
      centerLat: zoneSpec.centerLat,
      centerLng: zoneSpec.centerLng,
      radiusLng: zoneSpec.halfWidthLng,
      radiusLat: zoneSpec.halfHeightLat,
      seed: zoneSpec.idSuffix.hashCode,
    );

    territories.add(
      Territory(
        id: zoneId,
        name: zoneSpec.name,
        slug: zoneSpec.idSuffix,
        code: zoneId.toUpperCase(),
        territoryType: managerZoneType,
        sectorId: zoneSpec.sectorId,
        clinicCount: zoneSpec.baseClinicCount,
        assignedUserCount: zoneSpec.baseUserCount,
        repPatchCount: _patchNames.length,
        boundary: TerritoryGeometry.polygon([zoneRing]),
        centroid: _ringCentroid(zoneRing),
        assignedUserName: zoneSpec.managerName,
      ),
    );

    for (var i = 0; i < _patchNames.length; i++) {
      final patchId = 'territory-patch-${zoneSpec.idSuffix}-$i';
      final patchCenterLat =
          zoneSpec.centerLat + zoneSpec.halfHeightLat * _patchLatOffsets[i];
      final patchRing = _territoryRing(
        centerLat: patchCenterLat,
        centerLng: zoneSpec.centerLng,
        radiusLng: zoneSpec.halfWidthLng * 0.82,
        radiusLat: zoneSpec.halfHeightLat * 0.5,
        seed: Object.hash(zoneSpec.idSuffix, i),
      );

      // One patch is deliberately made of two disjoint parts (an exclave)
      // to exercise multi-polygon rendering/label-anchoring.
      final isExclaveDemo = zoneSpec.idSuffix == 'onco-oeste' && i == 2;
      final boundary = isExclaveDemo
          ? TerritoryGeometry.multiPolygon([
              [patchRing],
              [
                _territoryRing(
                  centerLat: patchCenterLat - zoneSpec.halfHeightLat * 1.9,
                  centerLng: zoneSpec.centerLng + zoneSpec.halfWidthLng * 0.6,
                  radiusLng: zoneSpec.halfWidthLng * 0.2,
                  radiusLat: zoneSpec.halfHeightLat * 0.2,
                  seed: Object.hash(zoneSpec.idSuffix, i, 'exclave'),
                  vertexCount: 8,
                ),
              ],
            ])
          : TerritoryGeometry.polygon([patchRing]);

      territories.add(
        Territory(
          id: patchId,
          name: '${zoneSpec.name} · ${_patchNames[i]}',
          slug: '${zoneSpec.idSuffix}-$i',
          code: patchId.toUpperCase(),
          territoryType: repPatchType,
          sectorId: zoneSpec.sectorId,
          managerTerritoryId: zoneId,
          clinicCount: (zoneSpec.baseClinicCount / _patchNames.length).round(),
          assignedUserCount: zoneSpec.repNames[i] == null ? 0 : 1,
          boundary: boundary,
          centroid: boundary.labelAnchor ?? _ringCentroid(patchRing),
          assignedUserName: zoneSpec.repNames[i],
        ),
      );
    }
  }

  return territories;
}

final mockTerritories = _buildMockTerritories();
