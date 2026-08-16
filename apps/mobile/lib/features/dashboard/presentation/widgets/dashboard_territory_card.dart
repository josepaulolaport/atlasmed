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
import 'package:atlasmed_mobile_app/shared/map/map_projection.dart';

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
              // "Território" is the right word only when the zones are the
              // viewer's own. On the admin's card they are several other
              // people's, and the API now sends a label that says so; the
              // fallback must not quietly put the possessive back.
              label:
                  data.label ??
                  (data.mode == TerritoryMode.global
                      ? 'Toda a linha'
                      : 'Território'),
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
                        // An admin is not looking at their own region — the
                        // zones below belong to the managers. "Você cobriu ...
                        // da sua região" credited them with other people's work
                        // and named a territory they do not hold.
                        TextSpan(
                          text: data.mode == TerritoryMode.global
                              ? 'A linha cobriu '
                              : 'Você cobriu ',
                        ),
                        TextSpan(
                          text: '$coveragePercent%',
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF16a373),
                          ),
                        ),
                        TextSpan(
                          text: data.mode == TerritoryMode.global
                              ? ' do território atribuído'
                              : ' da sua região',
                        ),
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

  /// Each zone with the geometry it parsed to, so the colour of its owner
  /// survives into the GeoJSON. Zipping the two lists afterwards would have
  /// mismatched them the moment one boundary failed to parse.
  List<({DashboardTerritoryFeature feature, TerritoryGeometry geometry})>
  get _geometries {
    final out =
        <({DashboardTerritoryFeature feature, TerritoryGeometry geometry})>[];
    for (final f in widget.features) {
      if (f.boundary == null) continue;
      final geometry = TerritoryGeometry.tryFromGeoJson(f.boundary!);
      if (geometry == null) continue;
      out.add((feature: f, geometry: geometry));
    }
    return out;
  }

  @override
  void didUpdateWidget(covariant _TerritoryMiniMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    // A failed load must not outlive the features it failed on: the flag is
    // what swaps the map for a grey placeholder, and without this a single
    // transient error left the card showing that placeholder for every filter
    // the rep chose afterwards.
    if (_mapUnavailable &&
        _featureKey(oldWidget.features) != _featureKey(widget.features)) {
      setState(() => _mapUnavailable = false);
    }
  }

  /// The dots the pill shows. Capped at four: past that they stop being
  /// distinguishable at 7px and the label is already carrying the count.
  List<Color> get _legendColors {
    final colors = ownerColors(widget.features).values.toList(growable: false);
    if (colors.isEmpty) return const [Color(0xFF0a2f7f)];
    return colors.take(4).toList(growable: false);
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
                            'dashboard-map-${_featureKey(widget.features)}',
                          ),
                          styleUri: MapboxStyles.STANDARD,
                          // Recomputed here rather than cached in a `late
                          // final`: the key above already rebuilds the platform
                          // view when the filters change the zone set, and a
                          // cached viewport handed that new view the *first*
                          // filter's camera. Filtering to Rio de Janeiro drew
                          // the RJ zone under a camera still fitted to all of
                          // Brazil, leaving it a speck in an empty map.
                          viewport: territoryViewport(widget.features),
                          onMapCreated: _onMapCreated,
                          onStyleLoadedListener: (_) async {
                            await useFlatProjection(_mapboxMap);
                            await _configureMap();
                          },
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
                    // One dot per responsável on the map, in their colour, so
                    // the pill is a legend rather than decoration. A single
                    // owner keeps the single dot the card always had.
                    for (final color in _legendColors)
                      Padding(
                        padding: const EdgeInsets.only(right: 3),
                        child: Container(
                          width: 7,
                          height: 7,
                          decoration: BoxDecoration(
                            color: color,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                    const SizedBox(width: 3),
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

    final colors = ownerColors(widget.features);
    const fallback = Color(0xFF2563EB);

    final collection = {
      'type': 'FeatureCollection',
      'features': [
        for (final entry in geometries)
          {
            'type': 'Feature',
            'properties': <String, Object?>{
              // Carried on the feature rather than set on the layer: one layer
              // has one colour, and the point here is that adjacent zones have
              // different ones.
              'color': _cssColor(colors[entry.feature.ownerId] ?? fallback),
            },
            'geometry': entry.geometry.toGeoJson(),
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
          fillColorExpression: const ['get', 'color'],
          fillOpacity: 0.22,
        ),
      );
      await mapboxMap.style.addLayer(
        LineLayer(
          id: _lineLayerId,
          sourceId: _sourceId,
          lineColorExpression: const ['get', 'color'],
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

/// Identity of a zone set — what decides the map has to be rebuilt and refitted.
String _featureKey(List<DashboardTerritoryFeature> features) =>
    features.map((f) => f.id).join(',');

/// One colour per responsável, so an admin can see that the outline below is
/// several people's territory rather than one shape.
///
/// Assigned by position in the sorted owner list, which guarantees the people
/// on screen get different colours — up to the length of the palette — but does
/// not survive a filter that removes one of them, since everyone after them
/// shifts up. Keying the colour off the owner id instead would hold across
/// filters at the cost of letting two managers collide in the same view, and a
/// legend where two zones share a colour is worse than one that repaints.
const _ownerPalette = <Color>[
  Color(0xFF2563EB),
  Color(0xFF16A373),
  Color(0xFFB45309),
  Color(0xFF7C3AED),
  Color(0xFFDB2777),
  Color(0xFF0891B2),
  Color(0xFF65A30D),
  Color(0xFFDC2626),
];

/// Mapbox reads colours out of feature properties as CSS strings, not ints.
String _cssColor(Color color) =>
    '#${color.toARGB32().toRadixString(16).padLeft(8, '0').substring(2)}';

@visibleForTesting
Map<int, Color> ownerColors(List<DashboardTerritoryFeature> features) {
  final owners =
      features
          .map((f) => f.ownerId)
          .whereType<int>()
          .toSet()
          .toList(growable: false)
        ..sort();
  return {
    for (var i = 0; i < owners.length; i++)
      owners[i]: _ownerPalette[i % _ownerPalette.length],
  };
}

/// The camera that frames exactly the zones handed to it.
///
/// A pure function of the features so the framing can be asserted without a
/// platform view: the defect it exists to prevent is a *stale* camera, and the
/// only way to see one is to compute two and compare them.
///
/// Falls back to a Brazil overview when nothing has a boundary — a card with no
/// geometry still shows a basemap rather than an arbitrary corner of the ocean.
@visibleForTesting
ViewportState territoryViewport(List<DashboardTerritoryFeature> features) {
  final geometries = features
      .where((f) => f.boundary != null)
      .map((f) => TerritoryGeometry.tryFromGeoJson(f.boundary!))
      .whereType<TerritoryGeometry>()
      .toList(growable: false);

  final fit = _idealCameraForBounds(
    bounds: _combinedBounds(geometries),
    boxWidth: 320,
    boxHeight: 160,
  );
  if (fit == null) {
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

/// Where the north edge of a latitude sits on the Web Mercator sheet, as a
/// fraction of its total height.
///
/// The fit used `latSpan / 180`, which treats the projection as if latitude
/// were linear. It is not: the sheet stretches towards the poles, so a degree
/// near -30 covers more of it than one near the equator, and the further a zone
/// set sits from the equator the more the linear form under-measures it.
double _mercatorY(double latitude) {
  final clamped = latitude.clamp(-85.05112878, 85.05112878);
  final radians = clamped * math.pi / 180;
  return 0.5 - math.log(math.tan(math.pi / 4 + radians / 2)) / (2 * math.pi);
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
      (_mercatorY(bounds.southwest.latitude) -
              _mercatorY(bounds.northeast.latitude))
          .abs()
          .clamp(1e-9, 1.0);
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
    // The floor used to be 2.5, which is closer than the whole of Brazil fits
    // in a 160pt box — so an admin's card, whose zones run from Roraima to
    // Paraná, was framed on the north and cut São Paulo and Rio off the bottom
    // edge. A floor exists only to stop a degenerate bounds asking for a view
    // of the whole globe repeated; 0.5 still shows a continent whole.
    zoom: zoom.clamp(0.5, 14).toDouble(),
  );
}
