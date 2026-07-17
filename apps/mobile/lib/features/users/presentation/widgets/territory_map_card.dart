import 'dart:async';
import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_assignments.dart';
import 'package:flutter/material.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';

/// A small, non-interactive map preview for a single assigned territory —
/// used in the horizontally-scrollable "Territórios atribuídos" row on the
/// user detail screen. Shows a fixed camera framing the territory boundary
/// (or a centered pin when no boundary is available), with the territory
/// name and sector overlaid on top.
class TerritoryMapCard extends StatefulWidget {
  const TerritoryMapCard({
    super.key,
    required this.assignment,
    this.width = 220,
    this.height = 150,
  });

  final TerritoryAssignment assignment;
  final double width;
  final double height;

  @override
  State<TerritoryMapCard> createState() => _TerritoryMapCardState();
}

class _TerritoryMapCardState extends State<TerritoryMapCard> {
  static const _sourceId = 'territorio-usuario';
  static const _fillLayerId = 'territorio-usuario-preenchimento';
  static const _lineLayerId = 'territorio-usuario-contorno';

  MapboxMap? _mapboxMap;
  bool _mapUnavailable = false;

  @override
  Widget build(BuildContext context) {
    final token = AppConfig.mapboxAccessToken;
    final centroid = widget.assignment.centroid;

    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: Container(
        width: widget.width,
        height: widget.height,
        color: const Color(0xFFe8ecf3),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (token.isEmpty || centroid == null || _mapUnavailable)
              const _MapPlaceholder()
            else
              IgnorePointer(
                child: MapWidget(
                  key: ValueKey('mapa-${widget.assignment.territoryId}'),
                  styleUri: MapboxStyles.STANDARD,
                  viewport: CameraViewportState(
                    center: _point(centroid),
                    zoom: 12.4,
                  ),
                  onMapCreated: _onMapCreated,
                  onStyleLoadedListener: (_) => _configureMap(),
                  onMapLoadErrorListener: (_) =>
                      setState(() => _mapUnavailable = true),
                ),
              ),
            Positioned(
              left: 0,
              right: 0,
              top: 0,
              child: Container(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 20),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Color(0xCC0f1729), Color(0x000f1729)],
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      widget.assignment.territoryName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                        height: 1.15,
                      ),
                    ),
                    if (widget.assignment.sectorName != null) ...[
                      const SizedBox(height: 3),
                      Text(
                        widget.assignment.sectorName!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFFdbe2ee),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _onMapCreated(MapboxMap mapboxMap) {
    _mapboxMap = mapboxMap;
    MapboxOptions.setAccessToken(AppConfig.mapboxAccessToken);
    unawaited(
      mapboxMap.gestures.updateSettings(
        GesturesSettings(
          rotateEnabled: false,
          pinchToZoomEnabled: false,
          scrollEnabled: false,
          pitchEnabled: false,
          doubleTapToZoomInEnabled: false,
          doubleTouchToZoomOutEnabled: false,
          quickZoomEnabled: false,
          pinchPanEnabled: false,
        ),
      ),
    );
    unawaited(
      mapboxMap.compass.updateSettings(CompassSettings(enabled: false)),
    );
    unawaited(
      mapboxMap.scaleBar.updateSettings(ScaleBarSettings(enabled: false)),
    );
    unawaited(mapboxMap.logo.updateSettings(LogoSettings(enabled: false)));
    unawaited(
      mapboxMap.attribution.updateSettings(AttributionSettings(enabled: false)),
    );
  }

  Future<void> _configureMap() async {
    final mapboxMap = _mapboxMap;
    final boundary = widget.assignment.boundary;
    if (mapboxMap == null || boundary == null || !mounted) return;

    try {
      await mapboxMap.style.addSource(
        GeoJsonSource(
          id: _sourceId,
          data: jsonEncode(boundary.toFeatureCollection()),
        ),
      );
      await mapboxMap.style.addLayer(
        FillLayer(
          id: _fillLayerId,
          sourceId: _sourceId,
          fillColor: const Color(0xFF2563EB).toARGB32(),
          fillOpacity: 0.22,
        ),
      );
      await mapboxMap.style.addLayer(
        LineLayer(
          id: _lineLayerId,
          sourceId: _sourceId,
          lineColor: const Color(0xFF1D4ED8).toARGB32(),
          lineWidth: 2,
          lineOpacity: 0.9,
          lineJoin: LineJoin.ROUND,
        ),
      );

      final bounds = boundary.bounds;
      if (bounds != null) {
        final coordinateBounds = CoordinateBounds(
          southwest: _point(bounds.southwest),
          northeast: _point(bounds.northeast),
          infiniteBounds: false,
        );
        final camera = await mapboxMap.cameraForCoordinateBounds(
          coordinateBounds,
          MbxEdgeInsets(top: 28, left: 20, bottom: 28, right: 20),
          null,
          null,
          null,
          null,
        );
        await mapboxMap.setCamera(camera);
      }
    } catch (_) {
      if (mounted) setState(() => _mapUnavailable = true);
    }
  }

  Point _point(MapCoordinate coordinate) =>
      Point(coordinates: Position(coordinate.longitude, coordinate.latitude));
}

class _MapPlaceholder extends StatelessWidget {
  const _MapPlaceholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFdfe5f0), Color(0xFFc9d2e3)],
        ),
      ),
      child: const Center(
        child: Icon(Icons.map_outlined, size: 30, color: Color(0xFF8b95a8)),
      ),
    );
  }
}
