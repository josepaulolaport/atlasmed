import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/bounds.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_assignments.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/territory_map_expanded_screen.dart';
import 'package:atlasmed_mobile_app/shared/widgets/mapbox/sized_map_host.dart';
import 'package:flutter/material.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// A small, non-interactive live map preview for a single assigned
/// territory — used in the horizontally-scrollable "Territórios atribuídos"
/// row on the user detail screen. The name and sector are shown as a plain
/// label above the card (not overlaid on the map); the map itself is a real,
/// fully-styled Mapbox view (streets, water, parks, POI labels) framing the
/// territory's real boundary, or a centered pin when no boundary is
/// available. Tapping the card opens a full-screen, freely pannable/
/// zoomable view of the same territory (see [TerritoryMapExpandedScreen]).
class TerritoryMapCard extends StatefulWidget {
  const TerritoryMapCard({
    super.key,
    required this.assignment,
    this.width = 260,
    this.mapHeight = 120,
    this.onTap,
  });

  final TerritoryAssignment assignment;
  final double width;
  final double mapHeight;

  /// When set, replaces the default "expand to full-screen map" tap.
  final VoidCallback? onTap;

  @override
  State<TerritoryMapCard> createState() => _TerritoryMapCardState();
}

class _TerritoryMapCardState extends State<TerritoryMapCard> {
  static const _sourceId = 'territorio-usuario';
  static const _fillLayerId = 'territorio-usuario-preenchimento';
  static const _lineLayerId = 'territorio-usuario-contorno';

  MapboxMap? _mapboxMap;
  bool _mapUnavailable = false;

  // `CameraViewportState` has no value equality, and [MapWidget] resets the
  // camera any time it receives a *new instance* on rebuild — even with
  // identical values. Building it once here (instead of inline in `build`)
  // keeps the same reference across rebuilds, so it only ever sets the
  // camera once, on first load. The zoom/center are computed analytically
  // from the territory's real bounding box (see [_idealCameraForBounds])
  // rather than via an async native "fit bounds" call, so the whole
  // territory is guaranteed visible from the very first frame — no
  // dependency on the platform view already having its final pixel size.
  late final ViewportState? _initialViewport = _buildInitialViewport();

  ViewportState? _buildInitialViewport() {
    final fit = _idealCameraForBounds(
      bounds: widget.assignment.boundary?.bounds,
      boxWidth: widget.width,
      boxHeight: widget.mapHeight,
    );
    if (fit != null) {
      return CameraViewportState(center: _point(fit.center), zoom: fit.zoom);
    }
    final centroid = widget.assignment.centroid;
    if (centroid == null) return null;
    return CameraViewportState(center: _point(centroid), zoom: 12.4);
  }

  @override
  Widget build(BuildContext context) {
    final token = AppConfig.mapboxAccessToken;
    final centroid = widget.assignment.centroid;

    return SizedBox(
      width: widget.width,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            widget.assignment.territoryName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppColors.gray900,
            ),
          ),
          if (widget.assignment.verticalName != null) ...[
            const SizedBox(height: 2),
            Text(
              widget.assignment.verticalName!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 11.5, color: AppColors.gray500),
            ),
          ],
          const SizedBox(height: 8),
          GestureDetector(
            onTap:
                widget.onTap ??
                () =>
                    TerritoryMapExpandedScreen.show(context, widget.assignment),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              // Explicit width/height (rather than leaving it to the
              // Column's cross-axis sizing) guarantees the map box spans
              // the card's full width, flush with its right edge.
              child: SizedBox(
                width: widget.width,
                height: widget.mapHeight,
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.surfaceSecondary,
                    border: Border.all(color: AppColors.surfaceSecondary),
                  ),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      if (token.isEmpty || centroid == null || _mapUnavailable)
                        const _MapPlaceholder()
                      else
                        IgnorePointer(
                          child: SizedMapHost(
                            builder: (context, width, height) => MapWidget(
                              key: ValueKey(
                                'mapa-${widget.assignment.territoryId}',
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
                      if (widget.onTap == null)
                        const Positioned(
                          bottom: 10,
                          right: 10,
                          child: _ExpandButton(),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
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
          fillColor: AppColors.blue600.toARGB32(),
          fillOpacity: 0.22,
        ),
      );
      await mapboxMap.style.addLayer(
        LineLayer(
          id: _lineLayerId,
          sourceId: _sourceId,
          lineColor: AppColors.blueDark.toARGB32(),
          lineWidth: 2,
          lineOpacity: 0.9,
          lineJoin: LineJoin.ROUND,
        ),
      );
      // Camera framing is intentionally NOT set here — the whole-territory
      // fit is already computed analytically in `_buildInitialViewport`
      // and applied the moment the map is created, avoiding a visible
      // jump and any dependency on the native view's size being finalized
      // by the time the style finishes loading.
    } catch (_) {
      if (mounted) setState(() => _mapUnavailable = true);
    }
  }

  Point _point(MapCoordinate coordinate) =>
      Point(coordinates: Position(coordinate.longitude, coordinate.latitude));
}

/// Result of [_idealCameraForBounds]: the camera center/zoom that frames a
/// bounding box entirely within a given pixel-sized viewport.
class _CameraFit {
  const _CameraFit({required this.center, required this.zoom});

  final MapCoordinate center;
  final double zoom;
}

/// Analytically computes the camera center + zoom that frames [bounds]
/// entirely inside a [boxWidth] x [boxHeight] viewport (in logical pixels),
/// leaving [padding] pixels of margin on every side.
///
/// This mirrors the standard Mercator "fit bounds" formula used by
/// Google/Mapbox-style slippy maps, using a 512px world tile width (Mapbox
/// GL's convention). Computing it locally — rather than asking the native
/// map to fit the bounds via `cameraForCoordinateBounds` — means the result
/// depends only on values already known in Dart, not on the platform
/// view's pixel size being finalized yet.
_CameraFit? _idealCameraForBounds({
  required MapBounds? bounds,
  required double boxWidth,
  required double boxHeight,
  double padding = 16,
  double zoomSafetyMargin = 0.3,
  double minZoom = 2,
  double maxZoom = 18,
}) {
  if (bounds == null) return null;

  final centerLat = (bounds.southwest.latitude + bounds.northeast.latitude) / 2;
  final centerLng =
      (bounds.southwest.longitude + bounds.northeast.longitude) / 2;

  final availableWidth = math.max(1.0, boxWidth - padding * 2);
  final availableHeight = math.max(1.0, boxHeight - padding * 2);

  final latFraction =
      (_mercatorY(bounds.northeast.latitude) -
              _mercatorY(bounds.southwest.latitude))
          .abs() /
      math.pi;
  final lngDiff = bounds.northeast.longitude - bounds.southwest.longitude;
  final lngFraction = (lngDiff < 0 ? lngDiff + 360 : lngDiff) / 360;

  const worldPixelsAtZoomZero = 512.0;
  double zoomToFit(double boxPixels, double fraction) {
    if (fraction <= 1e-9) return maxZoom;
    return math.log(boxPixels / worldPixelsAtZoomZero / fraction) / math.ln2;
  }

  final zoom = math.min(
    zoomToFit(availableHeight, latFraction),
    zoomToFit(availableWidth, lngFraction),
  );

  return _CameraFit(
    center: MapCoordinate(latitude: centerLat, longitude: centerLng),
    zoom: (zoom - zoomSafetyMargin).clamp(minZoom, maxZoom),
  );
}

/// Vertical Mercator projection of a latitude (in degrees) to the range
/// `[-pi/2, pi/2]`, used to measure how much vertical tile-space a latitude
/// span occupies (unlike longitude, latitude spans aren't linear on a
/// Mercator projection). Mirrors the equivalent `latRad` helper from the
/// standard "fit bounds to zoom" formula used by slippy-map SDKs.
double _mercatorY(double latDegrees) {
  final sinValue = math.sin(latDegrees * math.pi / 180);
  final radX2 = math.log((1 + sinValue) / (1 - sinValue)) / 2;
  return radX2.clamp(-math.pi, math.pi) / 2;
}

class _ExpandButton extends StatelessWidget {
  const _ExpandButton();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 30,
      height: 30,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(9),
        border: Border.all(color: AppColors.surfaceSecondary),
        boxShadow: const [BoxShadow(color: Color(0x14000000), blurRadius: 4)],
      ),
      child: const Icon(
        Icons.open_in_full_rounded,
        size: 13,
        color: AppColors.gray700,
      ),
    );
  }
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
          colors: [Color(0xFFdfe5f0), AppColors.gray300],
        ),
      ),
      child: const Center(
        child: Icon(Icons.map_outlined, size: 30, color: AppColors.gray400),
      ),
    );
  }
}
