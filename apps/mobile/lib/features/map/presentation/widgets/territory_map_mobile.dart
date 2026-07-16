import 'dart:convert';

import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/map_data.dart';
import 'package:flutter/material.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';

/// Mobile (Android/iOS) implementation of the territory map widget.
///
/// This file is loaded conditionally via [territory_map_widget.dart]
/// using `dart.library.io` — it is only imported on platforms that
/// support the Mapbox native plugin.
class TerritoryMapWidget extends StatefulWidget {
  final MapData data;
  final String accessToken;

  const TerritoryMapWidget({
    super.key,
    required this.data,
    required this.accessToken,
  });

  @override
  State<TerritoryMapWidget> createState() => _TerritoryMapState();
}

class _TerritoryMapState extends State<TerritoryMapWidget> {
  static const _territorySourceId = 'territorio-atlasmed';
  static const _territoryFillLayerId = 'territorio-atlasmed-preenchimento';
  static const _territoryLineLayerId = 'territorio-atlasmed-contorno';

  MapboxMap? _mapboxMap;
  bool _mapUnavailable = false;

  @override
  void initState() {
    super.initState();
    MapboxOptions.setAccessToken(widget.accessToken);
  }

  @override
  Widget build(BuildContext context) {
    if (_mapUnavailable) {
      return const _MapMessage(
        icon: Icons.map_outlined,
        title: 'Mapa indisponível',
        message:
            'Não foi possível carregar o mapa agora. Tente novamente mais tarde.',
      );
    }

    final location = widget.data.userLocation;
    return Stack(
      children: [
        MapWidget(
          key: const ValueKey('mapa-territorio'),
          styleUri: MapboxStyles.STANDARD,
          viewport: CameraViewportState(center: _point(location), zoom: 12),
          onMapCreated: (mapboxMap) => _mapboxMap = mapboxMap,
          onStyleLoadedListener: (_) => _configureMap(),
          onMapLoadErrorListener: (_) => setState(() => _mapUnavailable = true),
        ),
        Positioned(
          left: 16,
          right: 16,
          bottom: 16,
          child: _MapLegend(facilityCount: widget.data.facilities.length),
        ),
      ],
    );
  }

  Future<void> _configureMap() async {
    final mapboxMap = _mapboxMap;
    if (mapboxMap == null || !mounted) return;

    try {
      final territory = widget.data.territory!;
      await mapboxMap.style.addSource(
        GeoJsonSource(
          id: _territorySourceId,
          data: jsonEncode(territory.toFeatureCollection()),
        ),
      );
      await mapboxMap.style.addLayer(
        FillLayer(
          id: _territoryFillLayerId,
          sourceId: _territorySourceId,
          fillColor: const Color(0xFF2563EB).toARGB32(),
          fillOpacity: 0.16,
        ),
      );
      await mapboxMap.style.addLayer(
        LineLayer(
          id: _territoryLineLayerId,
          sourceId: _territorySourceId,
          lineColor: const Color(0xFF1D4ED8).toARGB32(),
          lineWidth: 2,
          lineOpacity: 0.9,
          lineJoin: LineJoin.ROUND,
        ),
      );

      final annotations =
          await mapboxMap.annotations.createCircleAnnotationManager();
      await annotations.create(
        CircleAnnotationOptions(
          geometry: _point(widget.data.userLocation),
          circleColor: const Color(0xFF2563EB).toARGB32(),
          circleRadius: 8,
          circleStrokeColor: Colors.white.toARGB32(),
          circleStrokeWidth: 3,
          circleSortKey: 2,
        ),
      );
      await annotations.createMulti(
        widget.data.facilities
            .map(
              (facility) => CircleAnnotationOptions(
                geometry: _point(facility.coordinate),
                circleColor: const Color(0xFF16A373).toARGB32(),
                circleRadius: 7,
                circleStrokeColor: Colors.white.toARGB32(),
                circleStrokeWidth: 2,
                circleSortKey: 1,
                customData: {'facilityId': facility.id, 'name': facility.name},
              ),
            )
            .toList(),
      );

      final bounds = territory.bounds;
      if (bounds != null) {
        final coordinateBounds = CoordinateBounds(
          southwest: _point(bounds.southwest),
          northeast: _point(bounds.northeast),
          infiniteBounds: false,
        );
        await mapboxMap.setBounds(
          CameraBoundsOptions(bounds: coordinateBounds),
        );
        await mapboxMap
            .cameraForCoordinateBounds(
              coordinateBounds,
              MbxEdgeInsets(top: 56, left: 32, bottom: 136, right: 32),
              null,
              null,
              null,
              null,
            )
            .then(
              (camera) =>
                  mapboxMap.easeTo(camera, MapAnimationOptions(duration: 500)),
            );
      }
    } catch (_) {
      if (mounted) setState(() => _mapUnavailable = true);
    }
  }

  Point _point(MapCoordinate coordinate) =>
      Point(coordinates: Position(coordinate.longitude, coordinate.latitude));
}

class _MapLegend extends StatelessWidget {
  final int facilityCount;

  const _MapLegend({required this.facilityCount});

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1A111827),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            const _LegendDot(color: Color(0xFF2563EB)),
            const SizedBox(width: 6),
            const Text(
              'Sua localização',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
            ),
            const SizedBox(width: 16),
            const _LegendDot(color: Color(0xFF16A373)),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                '$facilityCount clínicas no território',
                style:
                    const TextStyle(fontSize: 12, color: Color(0xFF4B5563)),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  final Color color;

  const _LegendDot({required this.color});

  @override
  Widget build(BuildContext context) => Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      );
}

class _MapMessage extends StatelessWidget {
  final IconData icon;
  final String title;
  final String message;

  const _MapMessage({
    required this.icon,
    required this.title,
    required this.message,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 42, color: const Color(0xFF6B7280)),
            const SizedBox(height: 16),
            Text(
              title,
              style:
                  const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
            ),
          ],
        ),
      ),
    );
  }
}
