import 'dart:async';
import 'dart:convert';
import 'dart:developer' as developer;
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/user/facility_vertical_filter_bar.dart';
import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_bucket.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_providers.dart';
import 'package:atlasmed_mobile_app/features/location/presentation/providers/location_session_provider.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/map/presentation/providers/map_provider.dart';
import 'package:atlasmed_mobile_app/features/map/presentation/utils/clinic_cluster_marker.dart';
import 'package:atlasmed_mobile_app/features/map/presentation/utils/clinic_map_pin.dart';
import 'package:atlasmed_mobile_app/features/map/presentation/widgets/clinic_pin_callout.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:atlasmed_mobile_app/shared/widgets/mapbox/sized_map_host.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart' hide Size;
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Live map tab: in-scope clinic pins with Mapbox Supercluster.
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
  static const _clusterAreaLayerId = 'clinicas-cluster-area';
  static const _clusterLayerId = 'clinicas-clusters';
  static const _unclusteredLayerId = 'clinicas-unclustered';

  /// Legacy ids — stripped on rebuild (pin is one atomic SymbolLayer now).
  static const _legacyClusterLayerIds = [
    'clinicas-cluster-pills',
    'clinicas-cluster-count',
    'clinicas-cluster-active',
    'clinicas-cluster-inactive',
    'clinicas-cluster-never',
  ];

  /// Paint order (bottom → top): halo → atomic pin (disc+pill) → pins.
  static const _clinicLayerIds = [
    _clusterLayerId,
    _clusterAreaLayerId,
    _unclusteredLayerId,
  ];

  /// Stable follow viewport — recreating it each rebuild retriggers camera
  /// transitions (Mapbox compares viewport by identity / value change).
  /// Top-down only — pitch locked at 0 (no tilt / side view).
  static const _followViewport = FollowPuckViewportState(
    zoom: 15.5,
    pitch: 0,
    bearing: FollowPuckViewportStateBearingHeading(),
  );

  /// Bump when GeoJSON source wiring changes (forces rebuild).
  static const _clusterSourceConfigVersion = 23;

  /// Screen-px clustering radius — larger = fewer, less cluttered pins.
  static const _clusterRadiusPx = 40.0;

  /// Keep same-coordinate clinics clustered through street-level zoom.
  /// (At/above this, Supercluster emits leaves — overlapping pins fight taps.)
  static const _clusterMaxZoom = 20.0;

  /// When focusing a clinic pin, zoom in only if farther out than this.
  static const _clinicFocusMinZoom = 15.5;

  /// Clinics within this distance count as one stacked location (drawer).
  static const _stackDistanceMeters = 40.0;

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
  bool _pointsRefreshing = false;

  static const _polygonGeometryFilter = <Object>[
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
  ];

  final Set<String> _pendingMissingImageIds = {};
  Timer? _missingImageFlush;

  /// Serializes style teardown/rebuild — styleLoaded + sync race otherwise
  /// removes a source still bound to layers.
  Future<void>? _ensureClinicLayersInFlight;

  int _mountedClusterSourceConfigVersion = 0;
  Timer? _clusterImageThrottle;

  /// Empty = show all buckets. Otherwise only selected Desempenho statuses.
  final Set<String> _statusFilters = {};

  /// Remount key so "Tentar novamente" recreates the native Mapbox view.
  int _mapGeneration = 0;

  MapboxMap? _mapboxMap;
  PointAnnotationManager? _calloutManager;
  PointAnnotation? _calloutAnnotation;
  PointAnnotation? _calloutCloseAnnotation;
  final GlobalKey _calloutCaptureKey = GlobalKey();
  final GlobalKey _closeButtonCaptureKey = GlobalKey();
  Uint8List? _closeButtonImageBytes;

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
    _clusterImageThrottle?.cancel();
    _missingImageFlush?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final token = AppConfig.mapboxAccessToken;
    final session = ref.watch(locationSessionProvider);
    final location = session.location;
    ref.watch(liveMapFacilityPointsProvider);

    ref.listen<AsyncValue<List<NearbyEstablishment>>>(
      liveMapFacilityPointsProvider,
      (previous, next) {
        next.when(
          data: (items) {
            if (!mounted) return;
            setState(() {
              _clinics = items;
              _pointsRefreshing = false;
            });
            unawaited(_syncAnnotations());
            if (_selected != null && !items.any((e) => e.id == _selected!.id)) {
              unawaited(_dismissCallout());
            }
          },
          loading: () {
            if (mounted) setState(() => _pointsRefreshing = true);
          },
          error: (_, _) {
            if (mounted) setState(() => _pointsRefreshing = false);
          },
        );
      },
    );

    ref.listen<AsyncValue<TerritoryGeometry?>>(mapTerritoryProvider, (_, next) {
      next.whenData((territory) => unawaited(_drawTerritory(territory)));
    });

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const AtlasAppBar(page: 'Mapa'),
      body: Column(
        children: [
          const FacilityVerticalFilterBar(
            padding: EdgeInsets.fromLTRB(16, 8, 16, 4),
          ),
          _MapStatusFilterBar(
            selected: _statusFilters,
            onToggle: _toggleStatusFilter,
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
                      SizedMapHost(
                        builder: (context, width, height) => MapWidget(
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
                            _pendingMissingImageIds.clear();
                            await _enableLocationPuck();
                            await _drawTerritory(
                              ref.read(mapTerritoryProvider).valueOrNull,
                            );
                            await _ensureClinicLayers();
                            await _syncAnnotations();
                          },
                          onStyleImageMissingListener: _onStyleImageMissing,
                          onMapLoadErrorListener: _onMapLoadError,
                          onScrollListener: (_) => _stopFollowing(),
                          onCameraChangeListener: (_) =>
                              _scheduleClusterPinImages(),
                        ),
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
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _MapIconButton(
                              tooltip: 'Atualizar clínicas',
                              onPressed: _pointsRefreshing
                                  ? null
                                  : _refreshMapPoints,
                              child: _pointsRefreshing
                                  ? const SizedBox(
                                      width: 22,
                                      height: 22,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Icon(Icons.refresh_rounded),
                            ),
                            const SizedBox(height: 10),
                            _RecenterButton(
                              following: _following,
                              onPressed: _resumeFollowing,
                            ),
                          ],
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
    unawaited(
      map.gestures.updateSettings(GesturesSettings(pitchEnabled: false)),
    );
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
    final message = details == null ? '$error' : '$error ($details)';
    // Always surface — Mapbox layer failures are otherwise silent on device.
    debugPrint('[map.$action] $message');
    if (!kDebugMode) return;
    developer.log(
      message,
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

  void _onStyleImageMissing(StyleImageMissingEventData event) {
    final id = event.id;
    if (!id.startsWith(ClinicClusterMarker.imageIdPrefix) &&
        !id.startsWith('atlasmed-clinic-pin')) {
      return;
    }
    _pendingMissingImageIds.add(id);
    _missingImageFlush?.cancel();
    _missingImageFlush = Timer(const Duration(milliseconds: 32), () {
      unawaited(_flushMissingStyleImages());
    });
  }

  Future<void> _flushMissingStyleImages() async {
    final map = _mapboxMap;
    if (map == null || !mounted || _pendingMissingImageIds.isEmpty) return;
    final ids = _pendingMissingImageIds.toList(growable: false);
    _pendingMissingImageIds.clear();
    try {
      final dpr = MediaQuery.devicePixelRatioOf(context);
      final clusterIds = ids
          .where((id) => id.startsWith(ClinicClusterMarker.imageIdPrefix))
          .toList(growable: false);
      if (clusterIds.isNotEmpty) {
        await ClinicClusterMarker.ensureImagesById(
          map.style,
          devicePixelRatio: dpr,
          imageIds: clusterIds,
        );
      }
      if (ids.any((id) => id.startsWith('atlasmed-clinic-pin'))) {
        await ClinicMapPin.ensureRegistered(map.style, devicePixelRatio: dpr);
      }
    } catch (error, stack) {
      _logMapIssue('style-image-missing', error, stack);
    }
  }

  Future<void> _drawTerritory(TerritoryGeometry? territory) async {
    final map = _mapboxMap;
    if (map == null) return;
    final safe = territory?.sanitized();
    if (safe == null) {
      await _clearTerritoryOverlay();
      return;
    }
    try {
      final style = map.style;
      final payload = jsonEncode(safe.toFeatureCollection());
      if (await style.styleSourceExists(_territorySourceId)) {
        await style.setStyleSourceProperty(_territorySourceId, 'data', payload);
        return;
      }
      await style.addSource(
        GeoJsonSource(id: _territorySourceId, data: payload),
      );
      await style.addLayer(
        FillLayer(
          id: _territoryFillLayerId,
          sourceId: _territorySourceId,
          slot: 'bottom',
          filter: _polygonGeometryFilter,
          fillColor: AppColors.blue600.toARGB32(),
          fillOpacity: 0.10,
        ),
      );
      await style.addLayer(
        LineLayer(
          id: _territoryLineLayerId,
          sourceId: _territorySourceId,
          slot: 'middle',
          lineColor: AppColors.blueDark.toARGB32(),
          lineWidth: 2,
          lineOpacity: 0.85,
          lineJoin: LineJoin.ROUND,
        ),
      );
    } catch (_) {
      // Territory overlay is optional.
    }
  }

  Future<void> _clearTerritoryOverlay() async {
    final map = _mapboxMap;
    if (map == null) return;
    try {
      final style = map.style;
      if (await style.styleLayerExists(_territoryLineLayerId)) {
        await style.removeStyleLayer(_territoryLineLayerId);
      }
      if (await style.styleLayerExists(_territoryFillLayerId)) {
        await style.removeStyleLayer(_territoryFillLayerId);
      }
      if (await style.styleSourceExists(_territorySourceId)) {
        await style.removeStyleSource(_territorySourceId);
      }
    } catch (_) {
      // Best-effort clear (admin / no territory).
    }
  }

  void _refreshMapPoints() {
    setState(() => _pointsRefreshing = true);
    ref.read(mapFacilityPointsRefreshProvider.notifier).state++;
  }

  void _toggleStatusFilter(String bucket) {
    setState(() {
      if (_statusFilters.contains(bucket)) {
        _statusFilters.remove(bucket);
      } else {
        _statusFilters.add(bucket);
      }
    });
    unawaited(_syncAnnotations());
  }

  void _stopFollowing() {
    if (!_following) return;
    setState(() {
      _following = false;
      _viewport = const IdleViewportState();
    });
  }

  void _resumeFollowing() {
    unawaited(_dismissCallout());
    // ignore: experimental_member_use
    setStateWithViewportAnimation(() {
      _following = true;
      _viewport = _followViewport;
    });
  }

  void _onMapBackgroundTapped(MapContentGestureContext _) {
    if (_suppressNextMapTap) {
      _suppressNextMapTap = false;
      return;
    }
    unawaited(_dismissCallout());
  }

  Future<void> _ensureClinicLayers() async {
    if (_clinicLayersReady) return;
    final existing = _ensureClinicLayersInFlight;
    if (existing != null) {
      await existing;
      return;
    }
    final future = _ensureClinicLayersBody();
    _ensureClinicLayersInFlight = future;
    try {
      await future;
    } finally {
      if (identical(_ensureClinicLayersInFlight, future)) {
        _ensureClinicLayersInFlight = null;
      }
    }
  }

  Future<void> _ensureClinicLayersBody() async {
    final map = _mapboxMap;
    if (map == null || _clinicLayersReady) return;
    final dpr = MediaQuery.devicePixelRatioOf(context);

    try {
      final style = map.style;

      await ClinicMapPin.ensureRegistered(style, devicePixelRatio: dpr);
      await ClinicClusterMarker.ensureRegistered(style, devicePixelRatio: dpr);

      final layerIds = _clinicLayerIds;
      final sourceExists = await style.styleSourceExists(_clinicsSourceId);
      final configCurrent =
          _mountedClusterSourceConfigVersion == _clusterSourceConfigVersion;
      var allLayersExist = sourceExists && configCurrent;
      if (sourceExists && configCurrent) {
        for (final id in layerIds) {
          if (!await style.styleLayerExists(id)) {
            allLayersExist = false;
            break;
          }
        }
      }

      if (sourceExists && allLayersExist) {
        _clinicLayersReady = true;
        _registerClinicInteractions(map);
        return;
      }

      for (final id in [...layerIds, ..._legacyClusterLayerIds]) {
        try {
          if (await style.styleLayerExists(id)) {
            await style.removeStyleLayer(id);
          }
        } catch (error, stack) {
          _logMapIssue('clinic-layer-remove', error, stack, details: id);
        }
      }

      if (await style.styleSourceExists(_clinicsSourceId)) {
        try {
          await style.removeStyleSource(_clinicsSourceId);
        } catch (error, stack) {
          _logMapIssue('clinic-source-remove', error, stack);
        }
      }

      if (!await style.styleSourceExists(_clinicsSourceId)) {
        await style.addSource(
          GeoJsonSource(
            id: _clinicsSourceId,
            data: jsonEncode({
              'type': 'FeatureCollection',
              'features': <Object>[],
            }),
            cluster: true,
            clusterRadius: _clusterRadiusPx,
            clusterMaxZoom: _clusterMaxZoom,
            clusterMinPoints: 2,
            // Aggregate Desempenho buckets for legend pills.
            clusterProperties: {
              'active': [
                '+',
                [
                  'case',
                  [
                    '==',
                    ['get', 'purchaseBucket'],
                    PurchaseBucketFilter.active,
                  ],
                  1,
                  0,
                ],
              ],
              'inactive': [
                '+',
                [
                  'case',
                  [
                    '==',
                    ['get', 'purchaseBucket'],
                    PurchaseBucketFilter.inactive,
                  ],
                  1,
                  0,
                ],
              ],
              'neverBought': [
                '+',
                [
                  'case',
                  [
                    '==',
                    ['get', 'purchaseBucket'],
                    PurchaseBucketFilter.neverBought,
                  ],
                  1,
                  0,
                ],
              ],
            },
          ),
        );
        _mountedClusterSourceConfigVersion = _clusterSourceConfigVersion;
      }

      const clusterFilter = ['has', 'point_count'];
      const unclusteredFilter = [
        '!',
        ['has', 'point_count'],
      ];

      Future<void> addSymbolIfMissing(String id, SymbolLayer layer) async {
        if (await style.styleLayerExists(id)) return;
        await style.addLayer(layer);
      }

      // Soft halo — visual only (not tappable; large radius stole pin taps).
      if (!await style.styleLayerExists(_clusterAreaLayerId)) {
        await style.addLayer(
          CircleLayer(
            id: _clusterAreaLayerId,
            sourceId: _clinicsSourceId,
            filter: clusterFilter,
            circleColor: AppColors.blue600.toARGB32(),
            circleOpacity: 0.08,
            circleStrokeColor: AppColors.blue600.toARGB32(),
            circleStrokeWidth: 1.0,
            circleStrokeOpacity: 0.16,
            circleRadiusExpression: [
              'step',
              ['get', 'point_count'],
              18,
              10,
              22,
              25,
              26,
              50,
              30,
              100,
              34,
            ],
          ),
        );
      }

      // One atomic pin bitmap (disc+pill+all numbers). No Mapbox text —
      // text glyphs still paint over neighbor icons in the same layer.
      await addSymbolIfMissing(
        _clusterLayerId,
        SymbolLayer(
          id: _clusterLayerId,
          sourceId: _clinicsSourceId,
          filter: clusterFilter,
          iconImageExpression: ClinicClusterMarker.iconImageExpression,
          iconAnchor: IconAnchor.CENTER,
          iconAllowOverlap: true,
          iconIgnorePlacement: true,
          iconOpacity: 0.68,
        ),
      );

      await addSymbolIfMissing(
        _unclusteredLayerId,
        SymbolLayer(
          id: _unclusteredLayerId,
          sourceId: _clinicsSourceId,
          filter: unclusteredFilter,
          iconImageExpression: ClinicMapPin.iconImageExpression,
          iconAnchor: IconAnchor.BOTTOM,
          iconAllowOverlap: true,
          iconIgnorePlacement: true,
          iconSize: 1,
        ),
      );

      _clinicLayersReady = true;
      _registerClinicInteractions(map);
    } catch (error, stack) {
      _logMapIssue('clinic-layers', error, stack);
    }
  }

  void _registerClinicInteractions(MapboxMap map) {
    if (_clinicInteractionsRegistered) return;

    try {
      // Drop legacy halo tap — it used a huge circle and ate nearby pin taps.
      for (final id in [
        'tap-$_clusterAreaLayerId',
        'tap-$_clusterLayerId',
        'tap-clinicas-pin',
      ]) {
        try {
          map.removeInteraction(id);
        } catch (_) {}
      }

      // Unclustered first + stopPropagation: pins win over clusters when both
      // fall inside the hit radius (TapInteraction first-match wins).
      map.addInteraction(
        TapInteraction(
          FeaturesetDescriptor(layerId: _unclusteredLayerId),
          (feature, context) {
            unawaited(_onUnclusteredFeatureTapped(feature, context));
          },
          // Cover pin body above BOTTOM tip; keep small so neighbors lose.
          radius: 16,
          stopPropagation: true,
        ),
        interactionID: 'tap-clinicas-pin',
      );
      map.addInteraction(
        TapInteraction(
          FeaturesetDescriptor(layerId: _clusterLayerId),
          (feature, context) {
            unawaited(_onClusterFeatureTapped(feature, context));
          },
          radius: 18,
          stopPropagation: true,
        ),
        interactionID: 'tap-$_clusterLayerId',
      );
      _clinicInteractionsRegistered = true;
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
      if (!_clinicLayersReady || !mounted) return;

      final selectedId = _selected?.id;
      final features = [
        for (final e in _visibleClinics) _pinFeature(e, selectedId: selectedId),
      ];

      await map.style.setStyleSourceProperty(
        _clinicsSourceId,
        'data',
        jsonEncode({'type': 'FeatureCollection', 'features': features}),
      );
      // Cluster aggregates exist after source update — bake pin bitmaps.
      _scheduleClusterPinImages();
    } catch (error, stack) {
      _logMapIssue('sync-pins', error, stack);
    }
  }

  void _scheduleClusterPinImages() {
    _clusterImageThrottle?.cancel();
    _clusterImageThrottle = Timer(const Duration(milliseconds: 120), () {
      unawaited(_ensureClusterPinImages());
    });
  }

  /// Lazily paint+register atomic pin PNGs for current cluster aggregates.
  Future<void> _ensureClusterPinImages() async {
    final map = _mapboxMap;
    if (map == null || !_clinicLayersReady || !mounted) return;
    try {
      // Clustering tiles lag the data write — retry once if empty.
      var specs = await _queryClusterPinSpecs(map);
      if (specs.isEmpty) {
        await Future<void>.delayed(const Duration(milliseconds: 200));
        if (!mounted || _mapboxMap == null) return;
        specs = await _queryClusterPinSpecs(_mapboxMap!);
      }
      if (specs.isEmpty || !mounted) return;

      final dpr = MediaQuery.devicePixelRatioOf(context);
      await ClinicClusterMarker.ensureImages(
        map.style,
        devicePixelRatio: dpr,
        specs: specs,
      );
    } catch (error, stack) {
      _logMapIssue('cluster-pin-images', error, stack);
    }
  }

  Future<
    Set<
      ({String sizeTier, num total, num active, num inactive, num neverBought})
    >
  >
  _queryClusterPinSpecs(MapboxMap map) async {
    final queried = await map.querySourceFeatures(
      _clinicsSourceId,
      SourceQueryOptions(filter: jsonEncode(['has', 'point_count'])),
    );
    final specs =
        <
          ({
            String sizeTier,
            num total,
            num active,
            num inactive,
            num neverBought,
          })
        >{};
    for (final row in queried) {
      final feature = row?.queriedFeature.feature;
      if (feature == null) continue;
      final props = feature['properties'];
      final Map<Object?, Object?> rawProps;
      if (props is Map) {
        rawProps = props;
      } else {
        rawProps = feature;
      }
      final total = _asNum(rawProps['point_count']);
      if (total < 2) continue;
      specs.add((
        sizeTier: ClinicClusterMarker.sizeTierForCount(total.round()),
        total: total,
        active: _asNum(rawProps['active']),
        inactive: _asNum(rawProps['inactive']),
        neverBought: _asNum(rawProps['neverBought']),
      ));
    }
    return specs;
  }

  static num _asNum(Object? value) {
    if (value is num) return value;
    if (value is String) return num.tryParse(value) ?? 0;
    return 0;
  }

  static Map<String, Object?> _pinFeature(
    NearbyEstablishment e, {
    required String? selectedId,
  }) {
    return {
      'type': 'Feature',
      'geometry': {
        'type': 'Point',
        'coordinates': [e.longitude, e.latitude],
      },
      'properties': {
        'facilityId': e.id,
        'name': e.name,
        'purchaseBucket': e.purchaseBucket ?? PurchaseBucketFilter.neverBought,
        'focused': selectedId == e.id ? 1 : 0,
      },
    };
  }

  Future<void> _onClusterFeatureTapped(
    FeaturesetFeature feature,
    MapContentGestureContext context,
  ) async {
    _suppressNextMapTap = true;
    Future.delayed(
      const Duration(milliseconds: 300),
      () => _suppressNextMapTap = false,
    );

    final map = _mapboxMap;
    if (map == null) return;

    _stopFollowing();
    await _dismissCallout();

    // Gesture point is reliable; Featureset geometry shape varies by platform.
    final fromGeom = _pointFromGeometry(feature.geometry);
    final lat = fromGeom?.latitude ?? context.point.coordinates.lat.toDouble();
    final lng = fromGeom?.longitude ?? context.point.coordinates.lng.toDouble();

    // Native API expects a GeoJSON Feature, not bare properties.
    final clusterFeature = <String?, Object?>{
      'type': 'Feature',
      'geometry': feature.geometry,
      'properties': Map<String?, Object?>.from(feature.properties),
      if (feature.properties['cluster_id'] != null)
        'id': feature.properties['cluster_id'],
    };

    try {
      final pointCount =
          (feature.properties['point_count'] as num?)?.toInt() ?? 80;
      final leafLimit = pointCount.clamp(2, 200);
      final leaves = await map.getGeoJsonClusterLeaves(
        _clinicsSourceId,
        clusterFeature,
        leafLimit,
        0,
      );
      final leafFc = leaves.featureCollection;
      final items = _establishmentsFromClusterLeaves(leafFc);

      final camera = await map.getCameraState();

      // Same / near-same coords → zoom never splits pins. Drawer immediately.
      // Must run before expansion zoom — Supercluster still returns higher zooms
      // for identical points all the way to clusterMaxZoom.
      final coLocated =
          _areLeafGeometriesStacked(leafFc) ||
          (items.length > 1 && _areStackedCoordinates(items));
      if (coLocated && items.length > 1) {
        await _centerOn(lat, lng);
        if (!mounted) return;
        await _showStackedSheet(items);
        return;
      }

      // Already at/above cluster max — leaves won't uncluster further.
      if (items.length > 1 && camera.zoom >= _clusterMaxZoom - 0.05) {
        await _centerOn(lat, lng);
        if (!mounted) return;
        await _showStackedSheet(items);
        return;
      }

      double? targetZoom;
      try {
        final expansion = await map.getGeoJsonClusterExpansionZoom(
          _clinicsSourceId,
          clusterFeature,
        );
        targetZoom = double.tryParse(expansion.value ?? '');
      } catch (error, stack) {
        _logMapIssue('cluster-expansion-zoom', error, stack);
      }

      // Only zoom when Mapbox reports a real expansion past current zoom.
      // Never fake +1.8 — that caused endless zoom on same-spot clusters.
      final canExpand = targetZoom != null && targetZoom > camera.zoom + 0.05;

      if (canExpand) {
        await map.easeTo(
          CameraOptions(
            center: Point(coordinates: Position(lng, lat)),
            zoom: targetZoom.clamp(0.0, _clusterMaxZoom),
            pitch: 0,
            bearing: camera.bearing,
          ),
          MapAnimationOptions(duration: 450),
        );
        return;
      }

      // Nothing left to uncluster.
      if (items.length > 1) {
        await _centerOn(lat, lng);
        if (!mounted) return;
        await _showStackedSheet(items);
        return;
      }

      await _centerOn(lat, lng);
    } catch (error, stack) {
      _logMapIssue('cluster-tap', error, stack);
      // Don't zoom on error — prefer drawer if we already know the leaves.
      try {
        final pointCount =
            (feature.properties['point_count'] as num?)?.toInt() ?? 0;
        if (pointCount > 1) {
          final leaves = await map.getGeoJsonClusterLeaves(
            _clinicsSourceId,
            clusterFeature,
            pointCount.clamp(2, 200),
            0,
          );
          final items = _establishmentsFromClusterLeaves(
            leaves.featureCollection,
          );
          if (items.length > 1) {
            await _centerOn(lat, lng);
            if (!mounted) return;
            await _showStackedSheet(items);
            return;
          }
        }
      } catch (_) {}
      await _centerOn(lat, lng);
    }
  }

  List<NearbyEstablishment> _establishmentsFromClusterLeaves(
    List<Map<String?, Object?>?>? featureCollection,
  ) {
    if (featureCollection == null || featureCollection.isEmpty) {
      return const [];
    }
    final byId = {for (final e in _visibleClinics) e.id: e};
    final out = <NearbyEstablishment>[];
    for (final raw in featureCollection) {
      if (raw == null) continue;
      final props = raw['properties'];
      if (props is! Map) continue;
      final id = props['facilityId']?.toString();
      if (id == null) continue;
      final e = byId[id];
      if (e != null) out.add(e);
    }
    return out;
  }

  /// True when every clinic lies within [_stackDistanceMeters] of the first.
  static bool _areStackedCoordinates(List<NearbyEstablishment> items) {
    if (items.length < 2) return false;
    final lat0 = items.first.latitude;
    final lng0 = items.first.longitude;
    for (var i = 1; i < items.length; i++) {
      if (_distanceMeters(lat0, lng0, items[i].latitude, items[i].longitude) >
          _stackDistanceMeters) {
        return false;
      }
    }
    return true;
  }

  /// Raw leaf geometries — catches near-duplicate coords in the source.
  static bool _areLeafGeometriesStacked(
    List<Map<String?, Object?>?>? featureCollection,
  ) {
    if (featureCollection == null || featureCollection.length < 2) {
      return false;
    }
    final points = <({double lat, double lng})>[];
    for (final raw in featureCollection) {
      if (raw == null) continue;
      final geom = raw['geometry'];
      if (geom is! Map) continue;
      final coords = geom['coordinates'];
      if (coords is! List || coords.length < 2) continue;
      final lng = (coords[0] as num?)?.toDouble();
      final lat = (coords[1] as num?)?.toDouble();
      if (lat == null || lng == null) continue;
      points.add((lat: lat, lng: lng));
    }
    if (points.length < 2) return false;
    final lat0 = points.first.lat;
    final lng0 = points.first.lng;
    for (var i = 1; i < points.length; i++) {
      if (_distanceMeters(lat0, lng0, points[i].lat, points[i].lng) >
          _stackDistanceMeters) {
        return false;
      }
    }
    return true;
  }

  static double _distanceMeters(
    double lat1,
    double lng1,
    double lat2,
    double lng2,
  ) {
    const metersPerDegLat = 111320.0;
    final dLat = (lat1 - lat2) * metersPerDegLat;
    final dLng =
        (lng1 - lng2) * metersPerDegLat * math.cos(lat1 * math.pi / 180.0);
    return math.sqrt(dLat * dLat + dLng * dLng);
  }

  Future<void> _onUnclusteredFeatureTapped(
    FeaturesetFeature feature,
    MapContentGestureContext context,
  ) async {
    _suppressNextMapTap = true;
    Future.delayed(
      const Duration(milliseconds: 300),
      () => _suppressNextMapTap = false,
    );

    // Prefer pin closest to finger on screen — radius can catch a neighbor.
    final match = await _resolveUnclusteredTap(feature, context);
    if (match == null) return;

    final stacked = _establishmentsNear(match.latitude, match.longitude);
    _stopFollowing();
    await _centerOn(
      match.latitude,
      match.longitude,
      minZoom: _clinicFocusMinZoom,
    );

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

  Future<NearbyEstablishment?> _resolveUnclusteredTap(
    FeaturesetFeature feature,
    MapContentGestureContext context,
  ) async {
    final map = _mapboxMap;
    final byId = {for (final e in _visibleClinics) e.id: e};

    NearbyEstablishment? fromFeature() {
      final id = feature.properties['facilityId']?.toString();
      if (id != null && byId.containsKey(id)) return byId[id];
      final point = _pointFromGeometry(feature.geometry);
      if (point == null) return null;
      final near = _establishmentsNear(point.latitude, point.longitude);
      return near.isEmpty ? null : near.first;
    }

    if (map == null) return fromFeature();

    try {
      final touch = context.touchPosition;
      const pad = 18.0;
      final hits = await map.queryRenderedFeatures(
        RenderedQueryGeometry.fromScreenBox(
          ScreenBox(
            min: ScreenCoordinate(x: touch.x - pad, y: touch.y - pad),
            max: ScreenCoordinate(x: touch.x + pad, y: touch.y + pad),
          ),
        ),
        RenderedQueryOptions(layerIds: [_unclusteredLayerId]),
      );

      NearbyEstablishment? best;
      var bestDist = double.infinity;
      for (final hit in hits) {
        final raw = hit?.queriedFeature.feature;
        if (raw == null) continue;
        final props = raw['properties'];
        final id = props is Map
            ? props['facilityId']?.toString()
            : raw['facilityId']?.toString();
        final e = id == null ? null : byId[id];
        if (e == null) continue;
        final screen = await map.pixelForCoordinate(
          Point(coordinates: Position(e.longitude, e.latitude)),
        );
        // Pin tip is at coordinate; visual body sits above — bias target up.
        final dx = screen.x - touch.x;
        final dy = (screen.y - 16) - touch.y;
        final dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          best = e;
        }
      }
      if (best != null) return best;
    } catch (error, stack) {
      _logMapIssue('unclustered-tap-resolve', error, stack);
    }
    return fromFeature();
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
    unawaited(_syncAnnotations());

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
      unawaited(_syncAnnotations());
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

  /// Center on [latitude]/[longitude]. Keeps current facing (bearing).
  /// Zooms in only when [minZoom] is set and camera is farther out.
  Future<void> _centerOn(
    double latitude,
    double longitude, {
    double? minZoom,
  }) async {
    final map = _mapboxMap;
    if (map == null) return;
    final camera = await map.getCameraState();
    final needsZoom = minZoom != null && camera.zoom < minZoom - 0.05;
    await map.easeTo(
      CameraOptions(
        center: Point(coordinates: Position(longitude, latitude)),
        zoom: needsZoom ? minZoom : camera.zoom,
        pitch: 0,
        bearing: camera.bearing,
      ),
      MapAnimationOptions(duration: 300),
    );
  }

  /// Clinics currently on the map (status chips applied). Stack drawer /
  /// co-location must use this — not raw [_clinics] — or a filtered pin
  /// still opens the full unfiltered stack.
  List<NearbyEstablishment> get _visibleClinics {
    if (_statusFilters.isEmpty) return _clinics;
    return _clinics
        .where((e) {
          final bucket = e.purchaseBucket ?? PurchaseBucketFilter.neverBought;
          return _statusFilters.contains(bucket);
        })
        .toList(growable: false);
  }

  List<NearbyEstablishment> _establishmentsNear(
    double latitude,
    double longitude,
  ) {
    return _visibleClinics
        .where(
          (e) =>
              _distanceMeters(latitude, longitude, e.latitude, e.longitude) <=
              _stackDistanceMeters,
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
                      color: AppColors.gray300,
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
                    color: AppColors.gray900,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Escolha qual estabelecimento deseja abrir',
                  style: TextStyle(fontSize: 12.5, color: AppColors.gray500),
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
    for (final clinic in _clinics) {
      if (clinic.id == id) {
        seedClinicDetailShellFromNearby(ref, clinic);
        break;
      }
    }
    // Pass map Linha as entry hint; detail bootstraps without forcing it when
    // clinic profiles don't include that Linha (avoids wrong-Linha 404).
    final verticalId = ref
        .read(effectiveFacilityVerticalIdProvider)
        .valueOrNull;
    if (verticalId != null && verticalId.isNotEmpty) {
      context.push(
        Uri(
          path: '/explore/clinic/$id',
          queryParameters: {'verticalId': verticalId},
        ).toString(),
      );
      return;
    }
    context.push('/explore/clinic/$id');
  }
}

class _MapStatusFilterBar extends StatelessWidget {
  const _MapStatusFilterBar({required this.selected, required this.onToggle});

  final Set<String> selected;
  final ValueChanged<String> onToggle;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: Row(
        children: [
          for (var i = 0; i < PurchaseBucketFilter.values.length; i++) ...[
            if (i > 0) const SizedBox(width: 8),
            Builder(
              builder: (_) {
                final bucket = PurchaseBucketFilter.values[i];
                return _MapStatusChip(
                  label: PurchaseBucketFilter.mapLabel(bucket),
                  color: PurchaseBucketFilter.mapColor(bucket),
                  selected: selected.isEmpty || selected.contains(bucket),
                  emphasized: selected.contains(bucket),
                  onTap: () => onToggle(bucket),
                );
              },
            ),
          ],
        ],
      ),
    );
  }
}

class _MapStatusChip extends StatelessWidget {
  const _MapStatusChip({
    required this.label,
    required this.color,
    required this.selected,
    required this.emphasized,
    required this.onTap,
  });

  final String label;
  final Color color;
  final bool selected;
  final bool emphasized;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final borderColor = emphasized
        ? color
        : selected
        ? AppColors.gray300
        : AppColors.gray200;
    final bg = emphasized
        ? color.withValues(alpha: 0.12)
        : selected
        ? Colors.white
        : AppColors.gray100;
    final fg = selected ? AppColors.gray900 : AppColors.gray400;

    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: borderColor),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: emphasized ? FontWeight.w700 : FontWeight.w600,
                  color: fg,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MapIconButton extends StatelessWidget {
  const _MapIconButton({
    required this.child,
    required this.onPressed,
    this.tooltip,
  });

  final Widget child;
  final VoidCallback? onPressed;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final button = Material(
      color: Colors.white,
      elevation: 3,
      shadowColor: const Color(0x33111827),
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onPressed,
        child: SizedBox(width: 48, height: 48, child: Center(child: child)),
      ),
    );
    if (tooltip == null) return button;
    return Tooltip(message: tooltip!, child: button);
  }
}

class _RecenterButton extends StatelessWidget {
  const _RecenterButton({required this.following, required this.onPressed});

  final bool following;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return _MapIconButton(
      tooltip: following ? 'Seguindo sua localização' : 'Centralizar em mim',
      onPressed: following ? null : onPressed,
      child: Icon(
        following ? Icons.my_location_rounded : Icons.navigation_rounded,
        color: following ? AppColors.navyBright : AppColors.gray900,
        size: 22,
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
          color: AppColors.surfaceTertiary,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.gray200),
        ),
        child: Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: PurchaseBucketFilter.mapColor(
                  establishment.purchaseBucket ??
                      PurchaseBucketFilter.neverBought,
                ),
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
                    style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray900,
                      height: 1.25,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${establishment.distanceKm.toStringAsFixed(1)} km',
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w500,
                      color: AppColors.gray500,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              size: 18,
              color: AppColors.navyBright,
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
              Icon(icon, size: 42, color: AppColors.gray500),
            const SizedBox(height: 16),
            Text(
              title,
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, color: AppColors.gray500),
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
