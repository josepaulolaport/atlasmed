import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/filter_data.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_nearby_provider.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart' hide Size;

/// Full-screen map of establishments near the current facility.
///
/// Proximity is establishment-centered: slider changes refetch
/// `GET /facilities` with this facility's lat/lng as the origin.
class ClinicNearbyMapScreen extends ConsumerStatefulWidget {
  const ClinicNearbyMapScreen({
    super.key,
    required this.facilityId,
    required this.facilityName,
    required this.center,
    required this.allNearby,
    this.initialFocusId,
  });

  final String facilityId;
  final String facilityName;
  final EstablishmentLocation center;

  /// Seed from the detail preview (same radius as the initial slider).
  final List<NearbyEstablishment> allNearby;

  /// When set (e.g. opened from a "Ver mais" on one of the inline nearby
  /// cards), the map centers/zooms on this establishment and opens its
  /// callout as soon as it's ready, instead of just showing the overview.
  final String? initialFocusId;

  @override
  ConsumerState<ClinicNearbyMapScreen> createState() =>
      _ClinicNearbyMapScreenState();
}

class _ClinicNearbyMapScreenState extends ConsumerState<ClinicNearbyMapScreen> {
  // Open at the same radius as the inline preview so the first paint matches
  // what the user just saw; the slider goes from 0.1–10 km in 0.1 steps.
  late double _radiusKm = establishmentNearbyPreviewRadiusKm;
  // Debounced radius used for the API query (avoids a request per tick).
  late double _committedRadiusKm = establishmentNearbyPreviewRadiusKm;
  // Live list from the last successful fetch (seeded from the preview).
  late List<NearbyEstablishment> _nearby = List<NearbyEstablishment>.from(
    widget.allNearby,
  );
  // Only fed to `MapWidget.viewport` up until the map is created (see
  // `_viewportApplied`) — after that all camera movement goes through
  // imperative `MapboxMap` calls instead.
  late final double _initialZoom = _initialZoomGuess(_radiusKm);

  // `MapWidget.viewport` isn't just an "initial" camera position — its
  // `CameraViewportState` has no `==` override, so a fresh instance built
  // every rebuild (identical values or not) reads as "changed" to the
  // package's `didUpdateWidget` and re-triggers a camera transition. That
  // silently snapped the map back to its starting center/zoom on *every*
  // setState (e.g. dismissing a callout), undoing any pan/zoom the user had
  // done. Passing it only once — then `null` forever after — avoids that;
  // every camera change past this point is driven imperatively instead.
  bool _viewportApplied = false;
  MapboxMap? _mapboxMap;
  CircleAnnotationManager? _pinAnnotationManager;
  PolygonAnnotationManager? _radiusCircleManager;
  PointAnnotationManager? _calloutManager;
  PointAnnotation? _calloutAnnotation;
  PointAnnotation? _calloutCloseAnnotation;
  bool _mapUnavailable = false;
  bool _calloutTapListenerRegistered = false;
  Timer? _pinResyncDebounce;

  /// Guards against the native map's generic tap listener firing right
  /// after an annotation tap for the same gesture and immediately
  /// dismissing the callout that annotation tap just opened.
  bool _suppressNextMapTap = false;

  /// The establishment whose pin callout is open (also highlights its card
  /// in the strip below). Kept even while the callout image is captured.
  NearbyEstablishment? _selected;

  /// Rendered off-screen (see [_showCallout]) so its `RepaintBoundary` can
  /// be rasterized into a real Mapbox `PointAnnotation` image.
  NearbyEstablishment? _pendingCapture;
  final GlobalKey _calloutCaptureKey = GlobalKey();

  /// The close ("X") badge is identical every time, so it's rasterized
  /// once (off the permanently-mounted [_closeButtonCaptureKey] boundary)
  /// and its bytes reused for every callout instead of re-rendering it.
  final GlobalKey _closeButtonCaptureKey = GlobalKey();
  Uint8List? _closeButtonImageBytes;

  /// Drives the horizontal nearby-clinic card strip so it can be
  /// re-centered on whichever establishment's pin/callout is active.
  final ScrollController _cardScrollController = ScrollController();

  /// Guards [widget.initialFocusId] handling so it only runs once, even
  /// though the stable `MapWidget` key means `onStyleLoadedListener` could
  /// in theory fire again later (e.g. a style reload).
  bool _initialFocusHandled = false;

  /// Pins/cards always respect the slider immediately via [distanceKm],
  /// even while a wider-radius fetch is still the in-memory cache.
  List<NearbyEstablishment> get _visible =>
      filterNearbyByRadius(_nearby, _radiusKm);

  NearbyFacilitiesQuery get _query => NearbyFacilitiesQuery(
    facilityId: widget.facilityId,
    latitude: widget.center.latitude,
    longitude: widget.center.longitude,
    radiusKm: _committedRadiusKm,
  );

  @override
  void initState() {
    super.initState();
    final token = AppConfig.mapboxAccessToken;
    if (token.isNotEmpty) {
      MapboxOptions.setAccessToken(token);
    }
  }

  @override
  void dispose() {
    _pinResyncDebounce?.cancel();
    _cardScrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    final nearbyAsync = ref.watch(facilityNearbyProvider(_query));
    ref.listen<AsyncValue<List<NearbyEstablishment>>>(
      facilityNearbyProvider(_query),
      (previous, next) {
        next.whenData((items) {
          if (!mounted) return;
          setState(() => _nearby = items);
          _syncAnnotations();
          if (_selected != null &&
              !_visible.any((e) => e.id == _selected!.id)) {
            _dismissCallout();
          }
        });
      },
    );
    final visible = filterNearbyByRadius(
      nearbyAsync.valueOrNull ?? _nearby,
      _radiusKm,
    );

    return Scaffold(
      backgroundColor: const Color(0xFFf8f9fb),
      body: Column(
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(4, top + 4, 8, 8),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.arrow_back_rounded),
                  onPressed: () => Navigator.of(context).pop(),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Estabelecimentos próximos',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0f1729),
                        ),
                      ),
                      Text(
                        widget.facilityName,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF6b7280),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: _mapUnavailable || AppConfig.mapboxAccessToken.isEmpty
                ? _NearbyMapPlaceholder(
                    center: widget.center,
                    establishments: visible,
                    facilityId: widget.facilityId,
                    onTapEstablishment: _openEstablishment,
                  )
                : Stack(
                    children: [
                      MapWidget(
                        key: const ValueKey('nearby-map'),
                        styleUri: MapboxStyles.STANDARD,
                        viewport: _viewportApplied
                            ? null
                            : CameraViewportState(
                                center: _point(widget.center),
                                zoom: _initialZoom,
                              ),
                        onMapCreated: _onMapCreated,
                        onMapLoadErrorListener: (_) =>
                            setState(() => _mapUnavailable = true),
                        onStyleLoadedListener: (_) async {
                          await _syncAnnotations();
                          // Wait one frame so MapWidget has a non-zero size —
                          // cameraForCoordinatesPadding is wrong (or no-ops)
                          // when queried against a 0×0 viewport on first load.
                          await WidgetsBinding.instance.endOfFrame;
                          if (!mounted) return;
                          final focusId = widget.initialFocusId;
                          if (focusId != null && !_initialFocusHandled) {
                            _initialFocusHandled = true;
                            await _focusOnEstablishment(focusId);
                          } else {
                            // Corrects the coarse bootstrap zoom used for
                            // the declarative initial viewport now that a
                            // real `MapboxMap` exists to fit accurately.
                            await _fitCameraToRadius(_radiusKm);
                          }
                        },
                      ),
                      // Rendered off-screen purely so its RepaintBoundary can
                      // be captured into a bitmap for the real map annotation
                      // in _showCallout — never actually visible to the user.
                      if (_pendingCapture != null)
                        Positioned(
                          left: -1000,
                          top: 0,
                          child: RepaintBoundary(
                            key: _calloutCaptureKey,
                            child: _PinCalloutContent(
                              establishment: _pendingCapture!,
                            ),
                          ),
                        ),
                      // Same idea, but the close badge never changes, so it
                      // stays mounted permanently and is only rasterized once.
                      Positioned(
                        left: -1000,
                        top: 0,
                        child: RepaintBoundary(
                          key: _closeButtonCaptureKey,
                          child: const _CalloutCloseButtonContent(),
                        ),
                      ),
                    ],
                  ),
          ),
          // A dedicated section below the map — not a floating card over it —
          // so the map's own visible area (and therefore the auto-fit zoom
          // calculation) never has to account for this UI occluding it.
          if (!_mapUnavailable && AppConfig.mapboxAccessToken.isNotEmpty)
            _RadiusPanel(
              radiusKm: _radiusKm,
              count: visible.length,
              establishments: visible,
              selectedId: _selected?.id,
              scrollController: _cardScrollController,
              onEstablishmentTap: (id) => _onCardTapped(id),
              onChanged: _onRadiusChanged,
            ),
        ],
      ),
    );
  }

  void _onMapCreated(MapboxMap map) {
    _mapboxMap = map;
    _viewportApplied = true;
    _pinAnnotationManager = null;
    _radiusCircleManager = null;
    _calloutManager = null;
    _calloutAnnotation = null;
    _calloutCloseAnnotation = null;
    _calloutTapListenerRegistered = false;
    map.scaleBar.updateSettings(ScaleBarSettings(enabled: false));
    // Non-deprecated replacement for `MapWidget.onTapListener`: taps that
    // don't land on a pin/callout annotation bubble up here and dismiss
    // whatever callout is open.
    map.addInteraction(TapInteraction.onMap(_onMapBackgroundTapped));
  }

  void _onRadiusChanged(double value) {
    final radius = snapNearbyRadiusKm(value);
    setState(() => _radiusKm = radius);
    _updateRadiusCircle();
    // Always snap back to the establishment the page is about (not
    // wherever the user may have panned/zoomed to) and auto-fit the zoom
    // so the whole search radius stays visible as it grows/shrinks.
    _fitCameraToRadius(radius);
    // Drop out-of-range pins/cards immediately via [_visible] filter —
    // do not wait for the next API response (which still has the wider set
    // cached until [_committedRadiusKm] updates).
    _syncAnnotations();
    if (_selected != null && !_visible.any((e) => e.id == _selected!.id)) {
      _dismissCallout();
    }
    // Debounce only the network refetch when the slider settles.
    _pinResyncDebounce?.cancel();
    _pinResyncDebounce = Timer(const Duration(milliseconds: 200), () {
      if (!mounted) return;
      if (radius != _committedRadiusKm) {
        setState(() => _committedRadiusKm = radius);
      }
    });
  }

  /// Re-centers the camera on the establishment this screen belongs to and
  /// eases the zoom so a circle of [radiusKm] fits comfortably in view.
  ///
  /// Prefers Mapbox's [MapboxMap.cameraForCoordinatesPadding] (fed the
  /// circle's boundary) so the SDK accounts for the real viewport size and
  /// its own tile/zoom conventions. Falls back to a Web-Mercator zoom from
  /// [MapboxMap.getSize] when that call returns a null/unusable zoom —
  /// which is what previously left the circle clipped or tiny relative to
  /// the camera.
  Future<void> _fitCameraToRadius(double radiusKm) async {
    final map = _mapboxMap;
    if (map == null) return;

    const padding = 48.0;
    final edgeInsets = MbxEdgeInsets(
      top: padding,
      left: padding,
      bottom: padding,
      right: padding,
    );
    final center = _point(widget.center);

    try {
      final boundary = _circlePositions(
        widget.center,
        radiusKm,
      ).map((position) => Point(coordinates: position)).toList();
      final fitted = await map.cameraForCoordinatesPadding(
        boundary,
        CameraOptions(center: center, bearing: 0, pitch: 0),
        edgeInsets,
        null,
        null,
      );
      if (!mounted) return;

      final zoom = fitted.zoom ?? await _zoomForRadiusKm(map, radiusKm);
      await map.easeTo(
        CameraOptions(
          center: center,
          zoom: zoom,
          bearing: 0,
          pitch: 0,
          padding: edgeInsets,
        ),
        MapAnimationOptions(duration: 250),
      );
    } catch (_) {
      if (!mounted) return;
      try {
        final zoom = await _zoomForRadiusKm(map, radiusKm);
        await map.easeTo(
          CameraOptions(
            center: center,
            zoom: zoom,
            bearing: 0,
            pitch: 0,
            padding: edgeInsets,
          ),
          MapAnimationOptions(duration: 250),
        );
      } catch (_) {
        // Cosmetic only — never trips the offline-placeholder fallback.
      }
    }
  }

  /// Web-Mercator zoom so a circle of [radiusKm] fills most of the map
  /// height (with ~20% margin). Used when the native fit call can't give
  /// a zoom, and also as the declarative bootstrap guess.
  Future<double> _zoomForRadiusKm(MapboxMap map, double radiusKm) async {
    double mapHeightPx = 400;
    try {
      final size = await map.getSize();
      if (size.height > 0) mapHeightPx = size.height;
    } catch (_) {
      // Keep fallback height.
    }
    return _zoomForRadiusKmAt(
      radiusKm,
      latitude: widget.center.latitude,
      mapHeightPx: mapHeightPx,
    );
  }

  double _zoomForRadiusKmAt(
    double radiusKm, {
    required double latitude,
    required double mapHeightPx,
  }) {
    // Diameter × margin so the ring sits inside the padded viewport.
    final diameterM = radiusKm * 1000 * 2 * 1.2;
    final latRad = latitude * math.pi / 180;
    const metersPerPixelAtZoom0 = 156543.03392;
    final usableHeight = math.max(mapHeightPx * 0.85, 1.0);
    final zoom =
        math.log(
          metersPerPixelAtZoom0 *
              math.cos(latRad).abs() *
              usableHeight /
              diameterM,
        ) /
        math.ln2;
    return zoom.clamp(3.0, 18.0);
  }

  /// Rough starting zoom for the *declarative* initial viewport, before the
  /// map/style exists and [_fitCameraToRadius] can be queried against a
  /// real `MapboxMap`. Corrected immediately once the style loads (see
  /// `onStyleLoadedListener`), so this only needs to be in the right
  /// ballpark to avoid a jarring jump on first paint.
  double _initialZoomGuess(double radiusKm) {
    return _zoomForRadiusKmAt(
      radiusKm,
      latitude: widget.center.latitude,
      mapHeightPx: 420,
    );
  }

  Future<void> _syncAnnotations() async {
    final map = _mapboxMap;
    if (map == null || !mounted) return;

    try {
      // Pin manager must exist before the radius polygon so the polygon can
      // be inserted *below* it. Otherwise the fill steals every pin tap.
      await _ensurePinAnnotationManager(map);
      await _updateRadiusCircle();

      await _pinAnnotationManager!.deleteAll();

      await _pinAnnotationManager!.create(
        CircleAnnotationOptions(
          geometry: _point(widget.center),
          circleColor: const Color(0xFF1e40af).toARGB32(),
          circleRadius: 11,
          circleStrokeColor: Colors.white.toARGB32(),
          circleStrokeWidth: 3,
          circleSortKey: 2,
        ),
      );

      final clusters = _clusterNearby(_visible);
      if (clusters.isNotEmpty) {
        await _pinAnnotationManager!.createMulti(
          clusters
              .map(
                (cluster) => CircleAnnotationOptions(
                  geometry: Point(
                    coordinates: Position(cluster.longitude, cluster.latitude),
                  ),
                  circleColor: const Color(0xFF16a373).toARGB32(),
                  // Slightly larger pin when several clinics share the spot.
                  circleRadius: cluster.items.length > 1 ? 11 : 8,
                  circleStrokeColor: Colors.white.toARGB32(),
                  circleStrokeWidth: 2,
                  circleSortKey: 1,
                  // Platform channel is happiest with string values only.
                  customData: {
                    'facilityId': cluster.items.first.id,
                    'count': '${cluster.items.length}',
                  },
                ),
              )
              .toList(),
        );
      }
    } catch (_) {
      if (mounted) setState(() => _mapUnavailable = true);
    }
  }

  Future<void> _ensurePinAnnotationManager(MapboxMap map) async {
    if (_pinAnnotationManager != null) return;
    _pinAnnotationManager = await map.annotations
        .createCircleAnnotationManager();
    _pinAnnotationManager!.tapEvents(onTap: _onPinTapped);
  }

  /// Draws (or redraws) a lightly-shaded circle over the current search
  /// radius. Cheap enough to call on every slider tick — unlike the pins,
  /// it doesn't need debouncing to look smooth as the slider moves.
  Future<void> _updateRadiusCircle() async {
    final map = _mapboxMap;
    if (map == null || !mounted) return;
    try {
      // Keep the fill under the pin layer so pin taps keep working.
      await _ensurePinAnnotationManager(map);
      _radiusCircleManager ??= await map.annotations
          .createPolygonAnnotationManager(below: _pinAnnotationManager!.id);
      await _radiusCircleManager!.deleteAll();
      await _radiusCircleManager!.create(
        PolygonAnnotationOptions(
          geometry: Polygon(
            coordinates: [_circlePositions(widget.center, _radiusKm)],
          ),
          fillColor: const Color(0x1A1e40af).toARGB32(),
          fillOutlineColor: const Color(0x662563eb).toARGB32(),
        ),
      );
    } catch (_) {
      // Cosmetic only — never trips the offline-placeholder fallback.
    }
  }

  /// Points (closed ring) approximating a circle of [radiusKm] around
  /// [center] using the spherical-earth destination-point formula.
  List<Position> _circlePositions(
    EstablishmentLocation center,
    double radiusKm, {
    int steps = 72,
  }) {
    const earthRadiusKm = 6371.0088;
    final latRad = center.latitude * math.pi / 180;
    final lngRad = center.longitude * math.pi / 180;
    final angularDistance = radiusKm / earthRadiusKm;
    return List<Position>.generate(steps + 1, (i) {
      final bearing = (i * 2 * math.pi) / steps;
      final destLatRad = math.asin(
        math.sin(latRad) * math.cos(angularDistance) +
            math.cos(latRad) * math.sin(angularDistance) * math.cos(bearing),
      );
      final destLngRad =
          lngRad +
          math.atan2(
            math.sin(bearing) * math.sin(angularDistance) * math.cos(latRad),
            math.cos(angularDistance) - math.sin(latRad) * math.sin(destLatRad),
          );
      return Position(destLngRad * 180 / math.pi, destLatRad * 180 / math.pi);
    });
  }

  Future<void> _onPinTapped(CircleAnnotation annotation) async {
    _suppressNextMapTap = true;
    Future.delayed(
      const Duration(milliseconds: 300),
      () => _suppressNextMapTap = false,
    );

    final match = _establishmentForPinAnnotation(annotation);
    if (match == null) return;

    final stacked = _establishmentsNear(match.latitude, match.longitude);
    await _centerOn(match.latitude, match.longitude);

    if (stacked.length > 1) {
      await _dismissCallout();
      if (!mounted) return;
      await _showStackedEstablishmentsSheet(stacked);
      return;
    }

    if (_selected?.id == match.id) {
      await _dismissCallout();
      return;
    }

    await _showCallout(match);
    _scrollToCard(match.id);
  }

  NearbyEstablishment? _establishmentForPinAnnotation(
    CircleAnnotation annotation,
  ) {
    final rawId = annotation.customData?['facilityId']?.toString();
    if (rawId != null && rawId.isNotEmpty && rawId != widget.facilityId) {
      for (final e in _visible) {
        if (e.id == rawId) return e;
      }
    }

    // Fallback: resolve by pin coordinates (customData can be flaky).
    final coords = annotation.geometry.coordinates;
    final lat = coords.lat.toDouble();
    final lng = coords.lng.toDouble();
    final near = _establishmentsNear(lat, lng);
    if (near.isEmpty) return null;
    return near.first;
  }

  /// Tapping a card centers the map on that clinic and opens its callout —
  /// the reverse of tapping a pin, which also centers the map on the pin.
  Future<void> _onCardTapped(String id) async {
    NearbyEstablishment? match;
    for (final e in _visible) {
      if (e.id == id) {
        match = e;
        break;
      }
    }
    if (match == null) return;

    final stacked = _establishmentsNear(match.latitude, match.longitude);
    await _centerOn(match.latitude, match.longitude);

    if (stacked.length > 1) {
      await _dismissCallout();
      if (!mounted) return;
      await _showStackedEstablishmentsSheet(stacked);
      return;
    }

    await _showCallout(match);
  }

  Future<void> _centerOn(double latitude, double longitude) async {
    await _mapboxMap?.easeTo(
      CameraOptions(center: Point(coordinates: Position(longitude, latitude))),
      MapAnimationOptions(duration: 300),
    );
  }

  /// Clinics within ~25 m of a point — treated as the same map spot.
  List<NearbyEstablishment> _establishmentsNear(
    double latitude,
    double longitude,
  ) {
    const thresholdKm = 0.025;
    final matches = _visible
        .where(
          (e) =>
              _haversineKm(latitude, longitude, e.latitude, e.longitude) <=
              thresholdKm,
        )
        .toList(growable: false);
    return matches;
  }

  /// One pin per coincident cluster so stacked clinics share a single tap
  /// target (and a slightly larger pin when count > 1).
  List<_NearbyPinCluster> _clusterNearby(List<NearbyEstablishment> items) {
    const thresholdKm = 0.025;
    final clusters = <_NearbyPinCluster>[];
    for (final item in items) {
      _NearbyPinCluster? host;
      for (final cluster in clusters) {
        if (_haversineKm(
              cluster.latitude,
              cluster.longitude,
              item.latitude,
              item.longitude,
            ) <=
            thresholdKm) {
          host = cluster;
          break;
        }
      }
      if (host != null) {
        host.items.add(item);
      } else {
        clusters.add(
          _NearbyPinCluster(
            latitude: item.latitude,
            longitude: item.longitude,
            items: [item],
          ),
        );
      }
    }
    return clusters;
  }

  Future<void> _showStackedEstablishmentsSheet(
    List<NearbyEstablishment> establishments,
  ) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (sheetContext) {
        final bottom = MediaQuery.of(sheetContext).padding.bottom;
        return SafeArea(
          child: Padding(
            padding: EdgeInsets.fromLTRB(16, 10, 16, 12 + bottom),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFFd1d5db),
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  '${establishments.length} clínicas neste local',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0f1729),
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Escolha qual estabelecimento deseja abrir',
                  style: TextStyle(fontSize: 12.5, color: Color(0xFF6b7280)),
                ),
                const SizedBox(height: 12),
                ConstrainedBox(
                  constraints: BoxConstraints(
                    maxHeight: MediaQuery.of(sheetContext).size.height * 0.45,
                  ),
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: establishments.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (_, i) {
                      final e = establishments[i];
                      return _StackedEstablishmentTile(
                        establishment: e,
                        onTap: () {
                          Navigator.of(sheetContext).pop();
                          _openEstablishment(e.id);
                        },
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  static double _haversineKm(
    double lat1,
    double lng1,
    double lat2,
    double lng2,
  ) {
    const earthRadiusKm = 6371.0088;
    final dLat = (lat2 - lat1) * math.pi / 180;
    final dLng = (lng2 - lng1) * math.pi / 180;
    final a =
        math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(lat1 * math.pi / 180) *
            math.cos(lat2 * math.pi / 180) *
            math.sin(dLng / 2) *
            math.sin(dLng / 2);
    return earthRadiusKm * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
  }

  /// Used when the screen is opened via a "Ver mais" on one of the inline
  /// nearby-clinic cards (see [ClinicNearbyMapScreen.initialFocusId]).
  /// Zooms in tighter on that specific establishment — rather than fitting
  /// the whole radius, like the slider does — opens its callout, and
  /// centers its card in the strip below.
  Future<void> _focusOnEstablishment(String id) async {
    NearbyEstablishment? match;
    for (final e in _visible) {
      if (e.id == id) {
        match = e;
        break;
      }
    }
    if (match == null) return;

    final stacked = _establishmentsNear(match.latitude, match.longitude);
    await _mapboxMap?.easeTo(
      CameraOptions(
        center: Point(coordinates: Position(match.longitude, match.latitude)),
        zoom: 15,
      ),
      MapAnimationOptions(duration: 300),
    );
    if (stacked.length > 1) {
      await _dismissCallout();
      if (!mounted) return;
      await _showStackedEstablishmentsSheet(stacked);
      return;
    }
    await _showCallout(match);
    _scrollToCard(match.id);
  }

  /// Scrolls the horizontal card strip so [id]'s card is centered in the
  /// visible viewport, mirroring the map's own center-on-tap behavior.
  void _scrollToCard(String id) {
    if (!_cardScrollController.hasClients) return;
    final index = _visible.indexWhere((e) => e.id == id);
    if (index == -1) return;

    const itemWidth = _NearbyEstablishmentCard.width;
    const itemExtent = itemWidth + 8;
    final position = _cardScrollController.position;
    final target =
        (index * itemExtent) - (position.viewportDimension - itemWidth) / 2;
    _cardScrollController.animateTo(
      target.clamp(0.0, position.maxScrollExtent),
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
    );
  }

  void _onMapBackgroundTapped(MapContentGestureContext gestureContext) {
    if (_suppressNextMapTap) {
      _suppressNextMapTap = false;
      return;
    }
    _dismissCallout();
  }

  /// Renders [establishment]'s callout off-screen, rasterizes it, and adds
  /// it to the map as a real `PointAnnotation` (anchored to its bottom tip)
  /// so it stays perfectly attached to the pin through pans/zooms — a
  /// Flutter-side overlay re-anchored on a timer always lagged behind.
  Future<void> _showCallout(NearbyEstablishment establishment) async {
    final map = _mapboxMap;
    if (map == null) return;

    setState(() {
      _selected = establishment;
      _pendingCapture = establishment;
    });

    // Two frames: the first mounts the off-screen widget, the second
    // guarantees it has been laid out and painted before we capture it.
    await WidgetsBinding.instance.endOfFrame;
    await WidgetsBinding.instance.endOfFrame;
    if (!mounted || _pendingCapture?.id != establishment.id) return;

    final boundary = _calloutCaptureKey.currentContext?.findRenderObject();
    if (boundary is! RenderRepaintBoundary) return;
    // Mapbox renders point-annotation images 1 raw pixel : 1 device pixel
    // (it has no notion of the Flutter widget's logical density). Capturing
    // at pixelRatio 1.0 handed it an image sized for logical pixels, so on
    // any retina device (devicePixelRatio 2-3x) it came out a third the
    // intended size. Matching the device's pixel ratio here makes the
    // bubble appear on the map at the same physical size it was designed
    // at (and stay crisp, since we're not upscaling a low-res raster).
    final devicePixelRatio = MediaQuery.of(context).devicePixelRatio;
    final image = await boundary.toImage(pixelRatio: devicePixelRatio);
    final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    if (byteData == null ||
        !mounted ||
        _pendingCapture?.id != establishment.id) {
      return;
    }
    final bytes = byteData.buffer.asUint8List();
    final logicalHeight = image.height / devicePixelRatio;
    final closeBytes = await _ensureCloseButtonImage();
    if (!mounted || _pendingCapture?.id != establishment.id) return;

    final geometry = Point(
      coordinates: Position(establishment.longitude, establishment.latitude),
    );

    try {
      final manager = _calloutManager ??= await map.annotations
          .createPointAnnotationManager();
      if (!_calloutTapListenerRegistered) {
        manager.tapEvents(onTap: _onCalloutTapped);
        _calloutTapListenerRegistered = true;
      }
      final previous = _calloutAnnotation;
      _calloutAnnotation = await manager.create(
        PointAnnotationOptions(
          geometry: geometry,
          image: bytes,
          iconAnchor: IconAnchor.BOTTOM,
          iconOffset: [0, -16],
          symbolSortKey: 3,
          customData: {'action': 'open', 'facilityId': establishment.id},
        ),
      );
      if (previous != null) await manager.delete(previous);

      final previousClose = _calloutCloseAnnotation;
      if (closeBytes != null) {
        // Anchored to the same point as the bubble (so it tracks it
        // through pans/zooms) but offset to sit right on the bubble's
        // top-right corner, straddling the edge like a badge.
        _calloutCloseAnnotation = await manager.create(
          PointAnnotationOptions(
            geometry: geometry,
            image: closeBytes,
            iconAnchor: IconAnchor.CENTER,
            iconOffset: [
              _PinCalloutContent.cardWidth / 2,
              -(logicalHeight + 16),
            ],
            symbolSortKey: 4,
            customData: {'action': 'close'},
          ),
        );
      } else {
        _calloutCloseAnnotation = null;
      }
      if (previousClose != null) await manager.delete(previousClose);
    } catch (_) {
      // Leave _selected as-is so the highlighted card still reflects intent;
      // just skip showing a callout bubble if the native call failed.
    }

    if (mounted) setState(() => _pendingCapture = null);
  }

  /// Rasterizes the close ("X") badge once and caches the bytes — its
  /// appearance never changes, so there's no need to re-render it per
  /// callout the way the bubble itself is (which has per-clinic content).
  Future<Uint8List?> _ensureCloseButtonImage() async {
    final cached = _closeButtonImageBytes;
    if (cached != null) return cached;

    await WidgetsBinding.instance.endOfFrame;
    await WidgetsBinding.instance.endOfFrame;
    if (!mounted) return null;
    final boundary = _closeButtonCaptureKey.currentContext?.findRenderObject();
    if (boundary is! RenderRepaintBoundary) return null;
    final devicePixelRatio = MediaQuery.of(context).devicePixelRatio;
    final image = await boundary.toImage(pixelRatio: devicePixelRatio);
    final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    if (byteData == null) return null;
    return _closeButtonImageBytes = byteData.buffer.asUint8List();
  }

  Future<void> _dismissCallout() async {
    if (_selected == null &&
        _calloutAnnotation == null &&
        _calloutCloseAnnotation == null) {
      return;
    }
    final annotation = _calloutAnnotation;
    final closeAnnotation = _calloutCloseAnnotation;
    final manager = _calloutManager;
    _calloutAnnotation = null;
    _calloutCloseAnnotation = null;
    if (mounted) {
      setState(() {
        _selected = null;
        _pendingCapture = null;
      });
    } else {
      _selected = null;
      _pendingCapture = null;
    }
    if (manager != null) {
      try {
        if (annotation != null) await manager.delete(annotation);
        if (closeAnnotation != null) await manager.delete(closeAnnotation);
      } catch (_) {
        // Manager may already be gone (e.g. map was disposed) — ignore.
      }
    }
  }

  void _onCalloutTapped(PointAnnotation annotation) {
    final action = annotation.customData?['action'] as String?;
    if (action == 'close') {
      _dismissCallout();
      return;
    }
    final id = annotation.customData?['facilityId'] as String?;
    if (id != null) _openEstablishment(id);
  }

  void _openEstablishment(String id) {
    if (id == widget.facilityId) return;
    context.push('/workspace/clinic/$id');
  }

  Point _point(EstablishmentLocation loc) =>
      Point(coordinates: Position(loc.longitude, loc.latitude));
}

class _NearbyPinCluster {
  _NearbyPinCluster({
    required this.latitude,
    required this.longitude,
    required this.items,
  });

  final double latitude;
  final double longitude;
  final List<NearbyEstablishment> items;
}

class _StackedEstablishmentTile extends StatelessWidget {
  const _StackedEstablishmentTile({
    required this.establishment,
    required this.onTap,
  });

  final NearbyEstablishment establishment;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 12, 10, 12),
        decoration: BoxDecoration(
          color: const Color(0xFFf8f9fb),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFe5e7eb)),
        ),
        child: Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: establishment.status.color,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    establishment.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF0f1729),
                    ),
                  ),
                  if (establishment.specialtyLabel != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      establishment.specialtyLabel!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF6b7280),
                      ),
                    ),
                  ],
                  const SizedBox(height: 2),
                  Text(
                    '${establishment.distanceKm.toStringAsFixed(1)} km',
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF6b7280),
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              size: 18,
              color: Color(0xFF1e40af),
            ),
          ],
        ),
      ),
    );
  }
}

class _RadiusPanel extends StatelessWidget {
  const _RadiusPanel({
    required this.radiusKm,
    required this.count,
    required this.establishments,
    required this.onEstablishmentTap,
    required this.onChanged,
    required this.scrollController,
    this.selectedId,
  });

  final double radiusKm;
  final int count;
  final List<NearbyEstablishment> establishments;
  final String? selectedId;
  final ScrollController scrollController;
  final ValueChanged<String> onEstablishmentTap;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    // A plain section of the screen (below the map, not floating over it),
    // separated only by a hairline — not a card, so no elevation/rounding.
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFe5e7eb))),
      ),
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 14, 16, 14 + bottomInset),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Raio de busca',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF0f1729),
                  ),
                ),
                Text(
                  '${radiusKm.toStringAsFixed(1)} km · $count',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF1e40af),
                  ),
                ),
              ],
            ),
            SliderTheme(
              data: SliderTheme.of(context).copyWith(
                trackHeight: 5,
                activeTrackColor: const Color(0xFF1e40af),
                inactiveTrackColor: const Color(0xFFe5e7eb),
                thumbColor: const Color(0xFF1e40af),
                overlayColor: const Color(0x1F1e40af),
                thumbShape: const RoundSliderThumbShape(
                  enabledThumbRadius: 9,
                  elevation: 2,
                ),
                overlayShape: const RoundSliderOverlayShape(overlayRadius: 18),
                trackShape: const RoundedRectSliderTrackShape(),
              ),
              // 0.1 km steps from 0.1–10 km (99 divisions).
              child: Slider(
                value: snapNearbyRadiusKm(radiusKm),
                min: establishmentNearbyMinRadiusKm,
                max: establishmentNearbyDefaultRadiusKm,
                divisions: 99,
                onChanged: (value) => onChanged(snapNearbyRadiusKm(value)),
              ),
            ),
            if (establishments.isNotEmpty) ...[
              const SizedBox(height: 10),
              SizedBox(
                height: 128,
                child: ListView.separated(
                  controller: scrollController,
                  scrollDirection: Axis.horizontal,
                  itemCount: establishments.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (_, i) {
                    final e = establishments[i];
                    return _NearbyEstablishmentCard(
                      establishment: e,
                      isSelected: e.id == selectedId,
                      onTap: () => onEstablishmentTap(e.id),
                    );
                  },
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Compact card for one nearby establishment, shown in a horizontal strip
/// over the expanded map. Highlights when its pin's callout is open.
class _NearbyEstablishmentCard extends StatelessWidget {
  const _NearbyEstablishmentCard({
    required this.establishment,
    required this.isSelected,
    required this.onTap,
  });

  final NearbyEstablishment establishment;
  final bool isSelected;
  final VoidCallback onTap;

  static const double width = 168;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        width: width,
        padding: const EdgeInsets.fromLTRB(12, 10, 10, 10),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFeef4ff) : const Color(0xFFf8f9fb),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected
                ? const Color(0xFF1e40af)
                : const Color(0xFFe5e7eb),
            width: isSelected ? 1.4 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 8,
                  height: 8,
                  margin: const EdgeInsets.only(top: 3),
                  decoration: BoxDecoration(
                    color: establishment.status.color,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    establishment.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF0f1729),
                      height: 1.15,
                    ),
                  ),
                ),
              ],
            ),
            if (establishment.specialtyLabel != null) ...[
              const SizedBox(height: 3),
              Text(
                establishment.specialtyLabel!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 11, color: Color(0xFF6b7280)),
              ),
            ],
            if (establishment.shortAddress != null) ...[
              const SizedBox(height: 3),
              Text(
                establishment.shortAddress!,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 10.5,
                  color: Color(0xFF9ca3af),
                ),
              ),
            ],
            const Spacer(),
            Row(
              children: [
                const Icon(
                  Icons.near_me_rounded,
                  size: 11,
                  color: Color(0xFF6b7280),
                ),
                const SizedBox(width: 3),
                Text(
                  '${establishment.distanceKm.toStringAsFixed(1)} km',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF6b7280),
                  ),
                ),
                const Spacer(),
                const Icon(
                  Icons.chevron_right_rounded,
                  size: 15,
                  color: Color(0xFF1e40af),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Content of the pin callout/"info window". Never actually shown on
/// screen directly — [_ClinicNearbyMapScreenState._showCallout] renders
/// this off-screen, rasterizes it, and adds the bitmap to the map as a
/// real `PointAnnotation` so it stays attached to its pin natively.
///
/// Since it becomes a static image, the whole bubble is one tappable unit
/// (handled by the annotation's tap event, not by widgets in here) — no
/// individually-tappable close/detail buttons.
class _PinCalloutContent extends StatelessWidget {
  const _PinCalloutContent({required this.establishment});

  final NearbyEstablishment establishment;

  static const double cardWidth = 216;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: cardWidth,
          padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            boxShadow: const [
              BoxShadow(
                color: Color(0x40111827),
                blurRadius: 18,
                offset: Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                establishment.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0f1729),
                  height: 1.15,
                ),
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 3,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: establishment.status.color,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        establishment.status.label,
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          color: establishment.status.color,
                        ),
                      ),
                    ],
                  ),
                  if (establishment.specialtyLabel != null)
                    Text(
                      '· ${establishment.specialtyLabel}',
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: Color(0xFF6b7280),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 3),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.near_me_rounded,
                    size: 12,
                    color: Color(0xFF6b7280),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '${establishment.distanceKm.toStringAsFixed(1)} km de distância',
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: Color(0xFF6b7280),
                    ),
                  ),
                ],
              ),
              const Divider(height: 16, color: Color(0xFFf3f4f6)),
              const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Ir para página da clínica',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF1e40af),
                    ),
                  ),
                  SizedBox(width: 4),
                  Icon(
                    Icons.arrow_forward_rounded,
                    size: 13,
                    color: Color(0xFF1e40af),
                  ),
                ],
              ),
            ],
          ),
        ),
        const Align(
          alignment: Alignment.center,
          child: CustomPaint(size: Size(16, 8), painter: _CalloutTailPainter()),
        ),
      ],
    );
  }
}

/// Content of the callout's close ("X") badge. Same rasterize-off-screen
/// treatment as [_PinCalloutContent], but rendered once and cached (see
/// [_ClinicNearbyMapScreenState._ensureCloseButtonImage]) since it never
/// changes in appearance across establishments.
class _CalloutCloseButtonContent extends StatelessWidget {
  const _CalloutCloseButtonContent();

  static const double size = 26;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
        border: Border.all(color: const Color(0xFFe5e7eb)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x40111827),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: const Icon(
        Icons.close_rounded,
        size: 15,
        color: Color(0xFF4b5563),
      ),
    );
  }
}

class _CalloutTailPainter extends CustomPainter {
  const _CalloutTailPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width, 0)
      ..lineTo(size.width / 2, size.height)
      ..close();
    canvas.drawPath(path, Paint()..color = Colors.white);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _NearbyMapPlaceholder extends StatelessWidget {
  const _NearbyMapPlaceholder({
    required this.center,
    required this.establishments,
    required this.facilityId,
    required this.onTapEstablishment,
  });

  final EstablishmentLocation center;
  final List<NearbyEstablishment> establishments;
  final String facilityId;
  final ValueChanged<String> onTapEstablishment;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: Container(
            margin: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFe8eef5),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.map_outlined,
                    size: 48,
                    color: Color(0xFF1e40af),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${center.latitude.toStringAsFixed(4)}, ${center.longitude.toStringAsFixed(4)}',
                    style: const TextStyle(color: Color(0xFF6b7280)),
                  ),
                ],
              ),
            ),
          ),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: establishments.length,
            itemBuilder: (_, i) {
              final e = establishments[i];
              return ListTile(
                leading: const Icon(
                  Icons.local_hospital_rounded,
                  color: Color(0xFF16a373),
                ),
                title: Text(e.name),
                trailing: Text('${e.distanceKm.toStringAsFixed(1)} km'),
                onTap: () => onTapEstablishment(e.id),
              );
            },
          ),
        ),
      ],
    );
  }
}
