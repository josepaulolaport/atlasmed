import 'dart:async';
import 'dart:convert';
import 'dart:developer' as developer;
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/user/facility_vertical_filter_bar.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/filter_data.dart';
import 'package:atlasmed_mobile_app/features/location/presentation/providers/location_session_provider.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/map/presentation/providers/map_provider.dart';
import 'package:atlasmed_mobile_app/features/map/presentation/utils/clinic_map_pin.dart';
import 'package:atlasmed_mobile_app/features/map/presentation/utils/cluster_count_badge.dart';
import 'package:atlasmed_mobile_app/features/map/presentation/widgets/clinic_pin_callout.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart' hide Size;

/// Live map tab: clinics as pins in the current camera view, Waze-style follow.
class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({super.key});

  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends ConsumerState<MapScreen> {
  static const _territorySourceId = 'territorio-atlasmed';
  static const _territoryFillLayerId = 'territorio-atlasmed-preenchimento';
  static const _territoryLineLayerId = 'territorio-atlasmed-contorno';

  static const _clinicsSourceId = 'clinicas-ao-vivo';
  static const _clusterLayerId = 'clinicas-clusters';
  static const _clusterCountLayerId = 'clinicas-cluster-count';
  static const _unclusteredLayerId = 'clinicas-unclustered';

  /// Stable follow viewport — recreating it each rebuild retriggers camera
  /// transitions (Mapbox compares viewport by identity / value change).
  static const _followViewport = FollowPuckViewportState(
    zoom: 15.5,
    pitch: 50,
    bearing: FollowPuckViewportStateBearingHeading(),
  );

  /// API allows up to 500 km; keep a floor so tiny zooms still hit something.
  static const _minFetchRadiusKm = 0.5;
  static const _maxFetchRadiusKm = 500.0;

  /// Supercluster radius (1/512ths of a tile; Mapbox default 50). Tear pins
  /// are ~28–34px wide — merge when their heads would overlap, not while
  /// still clearly separate.
  static const _clusterRadius = 30.0;

  /// Keep pixel-based clustering through street-level zooms; only exact
  /// duplicates remain clustered past this.
  static const _clusterMaxZoom = 18.0;

  /// Clinics closer than this are treated as the same address (sheet, no zoom).
  static const _coLocatedThresholdKm = 0.025;

  LiveMapClinicsQuery? _query;
  List<NearbyEstablishment> _clinics = const [];
  NearbyEstablishment? _selected;
  NearbyEstablishment? _pendingCapture;

  bool _following = true;
  ViewportState? _viewport = _followViewport;
  bool _mapUnavailable = false;
  bool _suppressNextMapTap = false;
  bool _clinicLayersReady = false;
  bool _clinicInteractionsRegistered = false;
  bool _calloutTapListenerRegistered = false;

  /// Remount key so "Tentar novamente" recreates the native Mapbox view.
  int _mapGeneration = 0;

  MapboxMap? _mapboxMap;
  PointAnnotationManager? _calloutManager;
  PointAnnotation? _calloutAnnotation;
  PointAnnotation? _calloutCloseAnnotation;
  final GlobalKey _calloutCaptureKey = GlobalKey();
  final GlobalKey _closeButtonCaptureKey = GlobalKey();
  Uint8List? _closeButtonImageBytes;
  Timer? _viewportDebounce;

  /// Last visible bounds used to client-filter pins to the current view.
  CoordinateBounds? _visibleBounds;

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
    _viewportDebounce?.cancel();
    super.dispose();
  }

  List<NearbyEstablishment> get _visibleInView {
    final bounds = _visibleBounds;
    if (bounds == null) return _clinics;
    return _clinics
        .where((e) => _isInsideBounds(e.latitude, e.longitude, bounds))
        .toList(growable: false);
  }

  @override
  Widget build(BuildContext context) {
    final token = AppConfig.mapboxAccessToken;
    final session = ref.watch(locationSessionProvider);
    final location = session.location;

    ref.listen<LocationSessionState>(locationSessionProvider, (_, next) {
      if (_following && next.location != null) {
        _scheduleViewportRefresh();
      }
    });

    final query = _query;
    if (query != null) {
      // Subscribe so rebuilds pick up fetch completion.
      ref.watch(liveMapClinicsProvider(query));
      ref.listen<AsyncValue<List<NearbyEstablishment>>>(
        liveMapClinicsProvider(query),
        (previous, next) {
          next.whenData((items) {
            if (!mounted) return;
            setState(() => _clinics = items);
            unawaited(_syncAnnotations());
            if (_selected != null &&
                !_visibleInView.any((e) => e.id == _selected!.id)) {
              unawaited(_dismissCallout());
            }
          });
        },
      );
    }

    ref.listen<AsyncValue<TerritoryGeometry?>>(mapTerritoryProvider, (_, next) {
      next.whenData((territory) => unawaited(_drawTerritory(territory)));
    });

    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FB),
      appBar: const AtlasAppBar(page: 'Mapa'),
      body: Column(
        children: [
          const FacilityVerticalFilterBar(
            padding: EdgeInsets.fromLTRB(16, 8, 16, 8),
          ),
          Expanded(
            child: token.isEmpty
                ? const _MapMessage(
                      icon: Icons.key_off_outlined,
                      title: 'Mapa indisponível',
                      message: 'A configuração do mapa não foi encontrada.',
                    )
                  : location == null
                  ? const _MapMessage(
                      icon: Icons.location_searching,
                      title: 'Obtendo sua localização',
                      message: 'Ative o GPS para ver as clínicas ao redor.',
                      loading: true,
                    )
                : _mapUnavailable
                ? _MapMessage(
                      icon: Icons.map_outlined,
                      title: 'Mapa indisponível',
                      message:
                          'Não foi possível carregar o mapa agora. Tente novamente.',
                      actionLabel: 'Tentar novamente',
                      onAction: () {
                        setState(() {
                          _mapUnavailable = false;
                          _mapGeneration += 1;
                          _mapboxMap = null;
                          _calloutManager = null;
                          _calloutAnnotation = null;
                          _calloutCloseAnnotation = null;
                          _calloutTapListenerRegistered = false;
                          _clinicLayersReady = false;
                          _clinicInteractionsRegistered = false;
                          _selected = null;
                          _pendingCapture = null;
                          _following = true;
                          _viewport = _followViewport;
                        });
                      },
                    )
                : Stack(
                    children: [
                      MapWidget(
                        key: ValueKey('mapa-ao-vivo-$_mapGeneration'),
                        styleUri: MapboxStyles.STANDARD,
                        viewport: _viewport,
                        onMapCreated: _onMapCreated,
                        onStyleLoadedListener: (_) async {
                            _clinicLayersReady = false;
                            _clinicInteractionsRegistered = false;
                            _calloutManager = null;
                            _calloutAnnotation = null;
                            _calloutCloseAnnotation = null;
                            _calloutTapListenerRegistered = false;
                            await _enableLocationPuck();
                            await _drawTerritory(
                              ref.read(mapTerritoryProvider).valueOrNull,
                            );
                            await _ensureClinicLayers();
                            await _refreshViewportClinics();
                          },
                          onMapLoadErrorListener: _onMapLoadError,
                          onScrollListener: (_) => _stopFollowing(),
                          onMapIdleListener: (_) => _scheduleViewportRefresh(),
                          onCameraChangeListener: (_) {
                            // While following, camera moves continuously —
                            // refresh on idle is enough; debounce here too
                            // so pans without a clean idle still update.
                            if (!_following) _scheduleViewportRefresh();
                          },
                      ),
                      if (_pendingCapture != null)
                        Positioned(
                            left: -1000,
                            top: 0,
                            child: RepaintBoundary(
                              key: _calloutCaptureKey,
                              child: ClinicPinCalloutContent(
                                establishment: _pendingCapture!,
                              ),
                            ),
                          ),
                        Positioned(
                          left: -1000,
                          top: 0,
                          child: RepaintBoundary(
                            key: _closeButtonCaptureKey,
                            child: const ClinicPinCalloutCloseButton(),
                          ),
                        ),
                        Positioned(
                          right: 16,
                          bottom: 16,
                          child: _RecenterButton(
                            following: _following,
                            onPressed: _resumeFollowing,
                          ),
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  void _onMapCreated(MapboxMap map) {
    _mapboxMap = map;
    _clinicLayersReady = false;
    _clinicInteractionsRegistered = false;
    _calloutManager = null;
    _calloutAnnotation = null;
    _calloutCloseAnnotation = null;
    _calloutTapListenerRegistered = false;
    map.scaleBar.updateSettings(ScaleBarSettings(enabled: false));
    map.compass.updateSettings(CompassSettings(enabled: false));
    try {
      map.addInteraction(TapInteraction.onMap(_onMapBackgroundTapped));
    } catch (error, stack) {
      _logMapIssue('tap-mapa-fundo', error, stack);
    }
  }

  /// Only style/source failures are fatal. Tile/glyph/sprite blips are common
  /// on cellular and must not replace the whole map with an empty state.
  void _onMapLoadError(MapLoadingErrorEventData event) {
    _logMapIssue(
      'map-load-${event.type.name}',
      event.message,
      null,
      details: 'sourceId=${event.sourceId}',
    );
    if (event.type != MapLoadErrorType.STYLE &&
        event.type != MapLoadErrorType.SOURCE) {
      return;
    }
    if (!mounted) return;
    setState(() => _mapUnavailable = true);
  }

  void _logMapIssue(
    String action,
    Object error,
    StackTrace? stack, {
    String? details,
  }) {
    if (!kDebugMode) return;
    developer.log(
      details == null ? '$error' : '$error ($details)',
      name: 'map.$action',
      error: error is String ? null : error,
      stackTrace: stack,
    );
  }

  Future<void> _enableLocationPuck() async {
    final map = _mapboxMap;
    if (map == null) return;
    try {
      await map.location.updateSettings(
        LocationComponentSettings(
          enabled: true,
          pulsingEnabled: true,
          showAccuracyRing: true,
          puckBearingEnabled: true,
          puckBearing: PuckBearing.HEADING,
          locationPuck: LocationPuck(locationPuck2D: DefaultLocationPuck2D()),
        ),
      );
    } catch (_) {
      // Puck is best-effort; clinic pins still work without it.
    }
  }

  Future<void> _drawTerritory(TerritoryGeometry? territory) async {
    final map = _mapboxMap;
    if (map == null || territory == null) return;
    try {
      final style = map.style;
      if (await style.styleSourceExists(_territorySourceId)) {
        await style.setStyleSourceProperty(
          _territorySourceId,
          'data',
          jsonEncode(territory.toFeatureCollection()),
        );
        return;
      }
      await style.addSource(
        GeoJsonSource(
          id: _territorySourceId,
          data: jsonEncode(territory.toFeatureCollection()),
        ),
      );
      await style.addLayer(
        FillLayer(
          id: _territoryFillLayerId,
          sourceId: _territorySourceId,
          slot: 'bottom',
          fillColor: const Color(0xFF2563EB).toARGB32(),
          fillOpacity: 0.10,
        ),
      );
      await style.addLayer(
        LineLayer(
          id: _territoryLineLayerId,
          sourceId: _territorySourceId,
          slot: 'middle',
          lineColor: const Color(0xFF1D4ED8).toARGB32(),
          lineWidth: 2,
          lineOpacity: 0.85,
          lineJoin: LineJoin.ROUND,
        ),
      );
    } catch (_) {
      // Territory overlay is optional.
    }
  }

  void _scheduleViewportRefresh() {
    _viewportDebounce?.cancel();
    _viewportDebounce = Timer(const Duration(milliseconds: 280), () {
      if (!mounted) return;
      unawaited(_refreshViewportClinics());
    });
  }

  /// Reads the current camera bounds, fetches clinics covering that view,
  /// and redraws pins for establishments inside it.
  Future<void> _refreshViewportClinics() async {
    final map = _mapboxMap;
    if (map == null || !mounted) return;

    try {
      final camera = await map.getCameraState();
      final bounds = await map.coordinateBoundsForCamera(
        CameraOptions(
          center: camera.center,
          padding: camera.padding,
          zoom: camera.zoom,
          bearing: camera.bearing,
          pitch: camera.pitch,
        ),
      );

      final sw = bounds.southwest.coordinates;
      final ne = bounds.northeast.coordinates;
      final centerLat = (sw.lat.toDouble() + ne.lat.toDouble()) / 2;
      final centerLng = (sw.lng.toDouble() + ne.lng.toDouble()) / 2;
      final halfDiagonalKm =
          _haversineKm(
            sw.lat.toDouble(),
            sw.lng.toDouble(),
            ne.lat.toDouble(),
            ne.lng.toDouble(),
          ) /
          2;
      final radiusKm = halfDiagonalKm
          .clamp(_minFetchRadiusKm, _maxFetchRadiusKm)
          .toDouble();

      // Round so tiny camera jitter doesn't spam the provider family.
      final nextQuery = LiveMapClinicsQuery(
        latitude: double.parse(centerLat.toStringAsFixed(4)),
        longitude: double.parse(centerLng.toStringAsFixed(4)),
        radiusKm: double.parse(radiusKm.toStringAsFixed(2)),
      );

      if (!mounted) return;
      setState(() {
        _visibleBounds = bounds;
        _query = nextQuery;
      });
      // Annotations update when the provider listen fires; also refresh the
      // filter against whatever we already have for an immediate paint.
      await _syncAnnotations();
    } catch (_) {
      // Camera may not be ready yet on first frames.
    }
  }

  void _stopFollowing() {
    if (!_following) return;
    setState(() {
      _following = false;
      _viewport = const IdleViewportState();
    });
    _scheduleViewportRefresh();
  }

  void _resumeFollowing() {
    unawaited(_dismissCallout());
    // ignore: experimental_member_use
    setStateWithViewportAnimation(() {
      _following = true;
      _viewport = _followViewport;
    });
    _scheduleViewportRefresh();
  }

  void _onMapBackgroundTapped(MapContentGestureContext _) {
    if (_suppressNextMapTap) {
      _suppressNextMapTap = false;
      return;
    }
    unawaited(_dismissCallout());
  }

  Future<void> _ensureClinicLayers() async {
    final map = _mapboxMap;
    if (map == null || _clinicLayersReady) return;
    final dpr = MediaQuery.devicePixelRatioOf(context);

    try {
      final style = map.style;

      // Mapbox has no built-in tear pin — rasterize and register style images.
      await ClinicMapPin.ensureRegistered(style, devicePixelRatio: dpr);
      await ClusterCountBadge.ensureRegistered(style, devicePixelRatio: dpr);

      // Recreate so clusterRadius / icons pick up the latest constants
      // (GeoJSON cluster options are immutable after the source is added).
      for (final id in [
        _clusterCountLayerId,
        _clusterLayerId,
        _unclusteredLayerId,
      ]) {
        if (await style.styleLayerExists(id)) {
          await style.removeStyleLayer(id);
        }
      }
      if (await style.styleSourceExists(_clinicsSourceId)) {
        await style.removeStyleSource(_clinicsSourceId);
      }

      await style.addSource(
        GeoJsonSource(
          id: _clinicsSourceId,
          data: jsonEncode({
            'type': 'FeatureCollection',
            'features': <Object>[],
          }),
          cluster: true,
          clusterRadius: _clusterRadius,
          clusterMaxZoom: _clusterMaxZoom,
          clusterMinPoints: 2,
        ),
      );

      // No `slot`: on Mapbox Standard, slotted layers sit under buildings /
      // place labels. Omitting the slot puts clinic pins above the basemap.
      await style.addLayer(
        SymbolLayer(
          id: _clusterLayerId,
          sourceId: _clinicsSourceId,
          filter: const ['has', 'point_count'],
          iconImage: ClinicMapPin.clusterImageId,
          iconAnchor: IconAnchor.BOTTOM,
          iconAllowOverlap: true,
          iconIgnorePlacement: true,
          // Slightly grow the blue cluster pin as density increases.
          iconSizeExpression: [
            'step',
            ['get', 'point_count'],
            1.0,
            10,
            1.12,
            25,
            1.24,
          ],
        ),
      );

      // Pre-baked red chip with the number inside (avoids ems/px drift).
      await style.addLayer(
        SymbolLayer(
          id: _clusterCountLayerId,
          sourceId: _clinicsSourceId,
          filter: const ['has', 'point_count'],
          iconImageExpression: ClusterCountBadge.iconImageExpression,
          iconAnchor: IconAnchor.CENTER,
          iconOffset: ClusterCountBadge.symbolIconOffset,
          iconAllowOverlap: true,
          iconIgnorePlacement: true,
        ),
      );

      await style.addLayer(
        SymbolLayer(
          id: _unclusteredLayerId,
          sourceId: _clinicsSourceId,
          filter: const [
            '!',
            ['has', 'point_count'],
          ],
          iconImage: ClinicMapPin.singleImageId,
          iconAnchor: IconAnchor.BOTTOM,
          iconAllowOverlap: true,
          iconIgnorePlacement: true,
          iconSize: 1,
        ),
      );

      _clinicLayersReady = true;
      _registerClinicInteractions(map);
    } catch (error, stack) {
      // Keep the basemap visible even if pins fail to mount.
      _logMapIssue('clinic-layers', error, stack);
    }
  }

  void _registerClinicInteractions(MapboxMap map) {
    if (_clinicInteractionsRegistered) return;
    _clinicInteractionsRegistered = true;

    try {
      map.addInteraction(
        TapInteraction(FeaturesetDescriptor(layerId: _clusterLayerId), (
          feature,
          _,
        ) {
          unawaited(_onClusterFeatureTapped(feature));
        }),
        interactionID: 'tap-clinicas-cluster',
      );
      map.addInteraction(
        TapInteraction(FeaturesetDescriptor(layerId: _clusterCountLayerId), (
          feature,
          _,
        ) {
          unawaited(_onClusterFeatureTapped(feature));
        }),
        interactionID: 'tap-clinicas-cluster-count',
      );
      map.addInteraction(
        TapInteraction(FeaturesetDescriptor(layerId: _unclusteredLayerId), (
          feature,
          _,
        ) {
          unawaited(_onUnclusteredFeatureTapped(feature));
        }),
        interactionID: 'tap-clinicas-pin',
      );
    } catch (error, stack) {
      _clinicInteractionsRegistered = false;
      _logMapIssue('clinic-interactions', error, stack);
    }
  }

  Future<void> _syncAnnotations() async {
    final map = _mapboxMap;
    if (map == null || !mounted) return;

    try {
      await _ensureClinicLayers();
      if (!_clinicLayersReady) return;

      final features = _visibleInView
          .map(
            (e) => {
              'type': 'Feature',
              'geometry': {
                'type': 'Point',
                'coordinates': [e.longitude, e.latitude],
              },
              'properties': {'facilityId': e.id, 'name': e.name},
            },
          )
          .toList(growable: false);

      await map.style.setStyleSourceProperty(
        _clinicsSourceId,
        'data',
        jsonEncode({'type': 'FeatureCollection', 'features': features}),
      );
    } catch (error, stack) {
      _logMapIssue('sync-pins', error, stack);
    }
  }

  Future<void> _onClusterFeatureTapped(FeaturesetFeature feature) async {
    _suppressNextMapTap = true;
    Future.delayed(
      const Duration(milliseconds: 300),
      () => _suppressNextMapTap = false,
    );

    final map = _mapboxMap;
    if (map == null) return;

    _stopFollowing();
    await _dismissCallout();
    final clusterFeature = _clusterFeaturePayload(feature);
    final center = _pointFromGeometry(feature.geometry);
    if (center == null) return;

    try {
      final leaves = await map.getGeoJsonClusterLeaves(
        _clinicsSourceId,
        clusterFeature,
        100,
        0,
      );
      final items = _establishmentsFromLeafFeatures(leaves.featureCollection);

      // Same address / nearly identical coords → list panel, no zoom chase.
      if (items.length > 1 && _areCoLocated(items)) {
        await _centerOn(center.latitude, center.longitude);
        if (!mounted) return;
        await _showStackedSheet(items);
        return;
      }

      final expansion = await map.getGeoJsonClusterExpansionZoom(
        _clinicsSourceId,
        clusterFeature,
      );
      final camera = await map.getCameraState();
      final currentZoom = camera.zoom;
      final targetZoom = double.tryParse(expansion.value ?? '');

      // Already at/past expansion zoom but still clustered → co-located.
      if (targetZoom == null || targetZoom <= currentZoom + 0.05) {
        if (items.length > 1) {
          await _centerOn(center.latitude, center.longitude);
          if (!mounted) return;
          await _showStackedSheet(items);
          return;
        }
      }

      await map.easeTo(
        CameraOptions(
          center: Point(
            coordinates: Position(center.longitude, center.latitude),
          ),
          zoom: (targetZoom ?? (currentZoom + 1.5)).clamp(
            currentZoom + 0.5,
            18,
          ),
          pitch: 0,
          bearing: 0,
        ),
        MapAnimationOptions(duration: 400),
      );
    } catch (_) {
      await _centerOn(center.latitude, center.longitude);
    }
  }

  Future<void> _onUnclusteredFeatureTapped(FeaturesetFeature feature) async {
    _suppressNextMapTap = true;
    Future.delayed(
      const Duration(milliseconds: 300),
      () => _suppressNextMapTap = false,
    );

    final facilityId = feature.properties['facilityId']?.toString();
    NearbyEstablishment? match;
    if (facilityId != null) {
      for (final e in _visibleInView) {
        if (e.id == facilityId) {
          match = e;
          break;
        }
      }
    }
    match ??= () {
      final point = _pointFromGeometry(feature.geometry);
      if (point == null) return null;
      final near = _establishmentsNear(point.latitude, point.longitude);
      return near.isEmpty ? null : near.first;
    }();
    if (match == null) return;

    final stacked = _establishmentsNear(match.latitude, match.longitude);
    _stopFollowing();
    await _centerOn(match.latitude, match.longitude);

    if (stacked.length > 1) {
      await _dismissCallout();
      if (!mounted) return;
      await _showStackedSheet(stacked);
      return;
    }

    if (_selected?.id == match.id) {
      await _dismissCallout();
      return;
    }

    await _showCallout(match);
  }

  /// Same bubble as the nearby-clinics minimap: rasterize off-screen, then
  /// attach as a Mapbox point annotation so it stays glued to the pin.
  Future<void> _showCallout(NearbyEstablishment establishment) async {
    final map = _mapboxMap;
    if (map == null) return;

    setState(() {
      _selected = establishment;
      _pendingCapture = establishment;
    });

    await WidgetsBinding.instance.endOfFrame;
    await WidgetsBinding.instance.endOfFrame;
    if (!mounted || _pendingCapture?.id != establishment.id) return;

    final boundary = _calloutCaptureKey.currentContext?.findRenderObject();
    if (boundary is! RenderRepaintBoundary) return;
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
          symbolSortKey: 10,
          customData: {'action': 'open', 'facilityId': establishment.id},
        ),
      );
      if (previous != null) await manager.delete(previous);

      final previousClose = _calloutCloseAnnotation;
      if (closeBytes != null) {
        _calloutCloseAnnotation = await manager.create(
          PointAnnotationOptions(
            geometry: geometry,
            image: closeBytes,
            iconAnchor: IconAnchor.CENTER,
            iconOffset: [
              ClinicPinCalloutContent.cardWidth / 2,
              -(logicalHeight + 16),
            ],
            symbolSortKey: 11,
            customData: {'action': 'close'},
          ),
        );
      } else {
        _calloutCloseAnnotation = null;
      }
      if (previousClose != null) await manager.delete(previousClose);
    } catch (error, stack) {
      _logMapIssue('show-callout', error, stack);
    }

    if (mounted) setState(() => _pendingCapture = null);
  }

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
        // Manager may already be gone with the map.
      }
    }
  }

  void _onCalloutTapped(PointAnnotation annotation) {
    _suppressNextMapTap = true;
    Future.delayed(
      const Duration(milliseconds: 300),
      () => _suppressNextMapTap = false,
    );
    final action = annotation.customData?['action']?.toString();
    if (action == 'close') {
      unawaited(_dismissCallout());
      return;
    }
    final id = annotation.customData?['facilityId']?.toString();
    if (id != null) _openEstablishment(id);
  }

  Map<String?, Object?> _clusterFeaturePayload(FeaturesetFeature feature) {
    return {
      'type': 'Feature',
      'geometry': feature.geometry,
      'properties': feature.properties.map(
        (key, value) => MapEntry(key, value),
      ),
    };
  }

  List<NearbyEstablishment> _establishmentsFromLeafFeatures(
    List<Map<String?, Object?>?>? featureCollection,
  ) {
    if (featureCollection == null || featureCollection.isEmpty) {
      return const [];
    }
    final byId = {for (final e in _clinics) e.id: e};
    final items = <NearbyEstablishment>[];
    for (final feature in featureCollection) {
      if (feature == null) continue;
      final props = feature['properties'];
      String? id;
      if (props is Map) {
        id = props['facilityId']?.toString();
      }
      if (id == null) continue;
      final match = byId[id];
      if (match != null) items.add(match);
    }
    return items;
  }

  bool _areCoLocated(List<NearbyEstablishment> items) {
    if (items.length < 2) return true;
    final origin = items.first;
    return items.every(
      (e) =>
          _haversineKm(
            origin.latitude,
            origin.longitude,
            e.latitude,
            e.longitude,
          ) <=
          _coLocatedThresholdKm,
    );
  }

  ({double latitude, double longitude})? _pointFromGeometry(
    Map<String?, Object?> geometry,
  ) {
    final coords = geometry['coordinates'];
    if (coords is! List || coords.length < 2) return null;
    final lng = (coords[0] as num?)?.toDouble();
    final lat = (coords[1] as num?)?.toDouble();
    if (lat == null || lng == null) return null;
    return (latitude: lat, longitude: lng);
  }

  Future<void> _centerOn(double latitude, double longitude) async {
    await _mapboxMap?.easeTo(
      CameraOptions(
        center: Point(coordinates: Position(longitude, latitude)),
        pitch: 0,
        bearing: 0,
      ),
      MapAnimationOptions(duration: 300),
    );
  }

  List<NearbyEstablishment> _establishmentsNear(
    double latitude,
    double longitude,
  ) {
    return _visibleInView
        .where(
          (e) =>
              _haversineKm(latitude, longitude, e.latitude, e.longitude) <=
              _coLocatedThresholdKm,
        )
        .toList(growable: false);
  }

  Future<void> _showStackedSheet(List<NearbyEstablishment> establishments) {
    return showModalBottomSheet<void>(
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
                      return _StackedClinicTile(
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

  void _openEstablishment(String id) {
    context.push('/explore/clinic/$id');
  }

  static bool _isInsideBounds(
    double latitude,
    double longitude,
    CoordinateBounds bounds,
  ) {
    final sw = bounds.southwest.coordinates;
    final ne = bounds.northeast.coordinates;
    final minLat = math.min(sw.lat.toDouble(), ne.lat.toDouble());
    final maxLat = math.max(sw.lat.toDouble(), ne.lat.toDouble());
    final minLng = math.min(sw.lng.toDouble(), ne.lng.toDouble());
    final maxLng = math.max(sw.lng.toDouble(), ne.lng.toDouble());
    return latitude >= minLat &&
        latitude <= maxLat &&
        longitude >= minLng &&
        longitude <= maxLng;
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
}

class _RecenterButton extends StatelessWidget {
  const _RecenterButton({required this.following, required this.onPressed});

  final bool following;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      elevation: 3,
      shadowColor: const Color(0x33111827),
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: following ? null : onPressed,
        child: SizedBox(
          width: 48,
          height: 48,
          child: Icon(
            following ? Icons.my_location_rounded : Icons.navigation_rounded,
            color: following
                ? const Color(0xFF1e40af)
                : const Color(0xFF0f1729),
            size: 22,
          ),
        ),
      ),
    );
  }
}

class _StackedClinicTile extends StatelessWidget {
  const _StackedClinicTile({required this.establishment, required this.onTap});

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

class _MapMessage extends StatelessWidget {
  final IconData icon;
  final String title;
  final String message;
  final bool loading;
  final String? actionLabel;
  final VoidCallback? onAction;

  const _MapMessage({
    required this.icon,
    required this.title,
    required this.message,
    this.loading = false,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (loading)
              const SizedBox(
                width: 32,
                height: 32,
                child: CircularProgressIndicator(strokeWidth: 3),
              )
            else
              Icon(icon, size: 42, color: const Color(0xFF6B7280)),
            const SizedBox(height: 16),
            Text(
              title,
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
            ),
            if (actionLabel != null) ...[
              const SizedBox(height: 20),
              FilledButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}
