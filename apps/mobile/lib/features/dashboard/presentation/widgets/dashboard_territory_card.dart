import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/bounds.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart';
import 'package:atlasmed_mobile_app/shared/widgets/mapbox/sized_map_host.dart';
import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';

class DashboardTerritoryCard extends StatelessWidget {
  const DashboardTerritoryCard({
    super.key,
    required this.data,
    this.coveragePercent,
  });

  final DashboardTerritory data;

  /// Cobertura, which now loads as its own metric (spec 0014 §4) and may not
  /// have arrived yet. Null hides the coverage stat rather than showing a 0
  /// that would read as "you covered nothing".
  final int? coveragePercent;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFeef0f3)),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Text(
                'TERRITÓRIO',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.3,
                  color: Color(0xFF0a2f7f),
                ),
              ),
              const Spacer(),
              GestureDetector(
                onTap: () => const MapRoute().go(context),
                child: const Text(
                  'Abrir mapa',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF2563eb),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (data.mode == TerritoryMode.global && data.features.isEmpty)
            _TerritoryMiniMap(
              // Nothing to outline: basemap only.
              features: const [],
              label: data.label ?? 'Toda a linha',
            )
          else if (data.mode.showMap && data.features.isNotEmpty)
            _TerritoryMiniMap(
              features: data.features,
              label: data.label ?? 'Território',
            )
          else
            Container(
              height: 140,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: const Color(0xFFf3f4f6),
                borderRadius: BorderRadius.circular(12),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: const Text(
                'Nenhum território atribuído a você',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFF6b7280),
                ),
              ),
            ),
          const SizedBox(height: 14),
          Row(
            children: [
              _Stat(value: '${data.clinicCount}', label: 'clínicas'),
              _vDivider(),
              _Stat(value: '${data.doctorCount}', label: 'médicos'),
              if (coveragePercent != null) ...[
                _vDivider(),
                _Stat(
                  value: '$coveragePercent%',
                  label: 'cobertura',
                  valueColor: const Color(0xFF16a373),
                ),
              ],
            ],
          ),
          if (coveragePercent != null) ...[
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: Text.rich(
                    TextSpan(
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF4b5563),
                      ),
                      children: [
                        const TextSpan(text: 'Você cobriu '),
                        TextSpan(
                          text: '$coveragePercent%',
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF16a373),
                          ),
                        ),
                        const TextSpan(text: ' da sua região'),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: (coveragePercent!.clamp(0, 100)) / 100,
                minHeight: 6,
                backgroundColor: const Color(0xFFe5e7eb),
                color: const Color(0xFF16a373),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _vDivider() => Container(
    width: 1,
    height: 36,
    margin: const EdgeInsets.symmetric(horizontal: 8),
    color: const Color(0xFFeef0f3),
  );
}

class _Stat extends StatelessWidget {
  const _Stat({
    required this.value,
    required this.label,
    this.valueColor = const Color(0xFF0f1729),
  });

  final String value;
  final String label;
  final Color valueColor;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: valueColor,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(fontSize: 12, color: Color(0xFF9ca3af)),
          ),
        ],
      ),
    );
  }
}

class _TerritoryMiniMap extends StatefulWidget {
  const _TerritoryMiniMap({required this.features, required this.label});

  final List<DashboardTerritoryFeature> features;
  final String label;

  @override
  State<_TerritoryMiniMap> createState() => _TerritoryMiniMapState();
}

class _TerritoryMiniMapState extends State<_TerritoryMiniMap> {
  static const _sourceId = 'dashboard-territory';
  static const _fillLayerId = 'dashboard-territory-fill';
  static const _lineLayerId = 'dashboard-territory-line';

  MapboxMap? _mapboxMap;
  bool _mapUnavailable = false;
  late final ViewportState? _initialViewport = _buildViewport();

  List<TerritoryGeometry> get _geometries {
    return widget.features
        .where((f) => f.boundary != null)
        .map((f) => TerritoryGeometry.tryFromGeoJson(f.boundary!))
        .whereType<TerritoryGeometry>()
        .toList(growable: false);
  }

  ViewportState? _buildViewport() {
    final bounds = _combinedBounds(_geometries);
    final fit = _idealCameraForBounds(
      bounds: bounds,
      boxWidth: 320,
      boxHeight: 160,
    );
    if (fit == null) {
      // Brazil overview fallback
      return CameraViewportState(
        center: Point(coordinates: Position(-51.9, -14.2)),
        zoom: 3.2,
      );
    }
    return CameraViewportState(
      center: Point(
        coordinates: Position(fit.center.longitude, fit.center.latitude),
      ),
      zoom: fit.zoom,
    );
  }

  @override
  Widget build(BuildContext context) {
    final token = AppConfig.mapboxAccessToken;

    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: SizedBox(
        height: 160,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Container(
              color: const Color(0xFFe9eef1),
              child: token.isEmpty || _mapUnavailable
                  ? const Center(
                      child: Icon(
                        Icons.map_outlined,
                        color: Color(0xFFc8cdd5),
                        size: 36,
                      ),
                    )
                  : IgnorePointer(
                      child: SizedMapHost(
                        builder: (context, width, height) => MapWidget(
                          key: ValueKey(
                            'dashboard-map-${widget.features.map((f) => f.id).join(',')}',
                          ),
                          styleUri: MapboxStyles.STANDARD,
                          viewport: _initialViewport,
                          onMapCreated: _onMapCreated,
                          onStyleLoadedListener: (_) => _configureMap(),
                          onMapLoadErrorListener: (_) =>
                              setState(() => _mapUnavailable = true),
                        ),
                      ),
                    ),
            ),
            Positioned(
              top: 10,
              left: 10,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(999),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x14000000),
                      blurRadius: 6,
                      offset: Offset(0, 2),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: const BoxDecoration(
                        color: Color(0xFF0a2f7f),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      widget.label,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF0f1729),
                      ),
                    ),
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
    unawaited(applyPreviewMapChrome(mapboxMap));
  }

  Future<void> _configureMap() async {
    final mapboxMap = _mapboxMap;
    if (mapboxMap == null || !mounted) return;
    final geometries = _geometries;
    if (geometries.isEmpty) return;

    final collection = {
      'type': 'FeatureCollection',
      'features': [
        for (final g in geometries)
          {
            'type': 'Feature',
            'properties': <String, Object?>{},
            'geometry': g.toGeoJson(),
          },
      ],
    };

    try {
      await mapboxMap.style.addSource(
        GeoJsonSource(id: _sourceId, data: jsonEncode(collection)),
      );
      await mapboxMap.style.addLayer(
        FillLayer(
          id: _fillLayerId,
          sourceId: _sourceId,
          filter: const [
            'any',
            [
              '==',
              ['geometry-type'],
              'Polygon',
            ],
            [
              '==',
              ['geometry-type'],
              'MultiPolygon',
            ],
          ],
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
    } catch (_) {
      if (mounted) setState(() => _mapUnavailable = true);
    }
  }
}

MapBounds? _combinedBounds(List<TerritoryGeometry> geometries) {
  MapBounds? bounds;
  for (final g in geometries) {
    final b = g.bounds;
    if (b == null) continue;
    if (bounds == null) {
      bounds = b;
      continue;
    }
    bounds = MapBounds(
      southwest: MapCoordinate(
        longitude: math.min(bounds.southwest.longitude, b.southwest.longitude),
        latitude: math.min(bounds.southwest.latitude, b.southwest.latitude),
      ),
      northeast: MapCoordinate(
        longitude: math.max(bounds.northeast.longitude, b.northeast.longitude),
        latitude: math.max(bounds.northeast.latitude, b.northeast.latitude),
      ),
    );
  }
  return bounds;
}

class _CameraFit {
  const _CameraFit({required this.center, required this.zoom});
  final MapCoordinate center;
  final double zoom;
}

_CameraFit? _idealCameraForBounds({
  required MapBounds? bounds,
  required double boxWidth,
  required double boxHeight,
  double padding = 16,
}) {
  if (bounds == null) return null;
  final centerLat = (bounds.southwest.latitude + bounds.northeast.latitude) / 2;
  final centerLng =
      (bounds.southwest.longitude + bounds.northeast.longitude) / 2;
  final availableWidth = math.max(1.0, boxWidth - padding * 2);
  final availableHeight = math.max(1.0, boxHeight - padding * 2);
  final latFraction =
      ((bounds.northeast.latitude - bounds.southwest.latitude) / 180).clamp(
        1e-9,
        1.0,
      );
  final lngFraction =
      ((bounds.northeast.longitude - bounds.southwest.longitude) / 360).clamp(
        1e-9,
        1.0,
      );
  final latZoom = math.log(availableHeight / 512 / latFraction) / math.ln2;
  final lngZoom = math.log(availableWidth / 512 / lngFraction) / math.ln2;
  final zoom = math.min(latZoom, lngZoom) - 0.35;
  return _CameraFit(
    center: MapCoordinate(latitude: centerLat, longitude: centerLng),
    zoom: zoom.clamp(2.5, 14).toDouble(),
  );
}
