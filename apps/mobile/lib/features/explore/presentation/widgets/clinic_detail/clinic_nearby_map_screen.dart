import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/json/crm_id.dart';
import 'package:atlasmed_mobile_app/core/user/facility_vertical_filter_bar.dart';
import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_bucket.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_linha_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_nearby_provider.dart';
import 'package:atlasmed_mobile_app/features/map/presentation/utils/clinic_map_pin.dart';
import 'package:atlasmed_mobile_app/features/map/presentation/utils/nearby_stack_marker.dart';
import 'package:atlasmed_mobile_app/features/map/presentation/widgets/clinic_pin_callout.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart' hide Size;
import 'package:atlasmed_mobile_app/shared/map/map_projection.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';

Color _nearbyStatusDotColor(NearbyEstablishment e) =>
    PurchaseBucketFilter.mapColor(
      e.purchaseBucket ?? PurchaseBucketFilter.neverBought,
    );

/// Full-screen map of establishments near the current facility.
///
/// Proximity is establishment-centered: slider changes refetch
/// `GET /facilities` with this facility's lat/lng as the origin.
///
/// When both the clinic and the user have 2+ shared business verticals,
/// a chip bar lets the user choose which vertical(s) to show.
class ClinicNearbyMapScreen extends ConsumerStatefulWidget {
  const ClinicNearbyMapScreen({
    super.key,
    required this.facilityId,
    required this.facilityName,
    required this.center,
    required this.allNearby,
    this.clinicVerticalIds = const {},
    this.initialFocusId,
  });

  final int facilityId;
  final String facilityName;
  final EstablishmentLocation center;

  /// Seed from the detail preview (same radius as the initial slider).
  final List<NearbyEstablishment> allNearby;

  /// Vertical ids on the origin clinic — intersected with the user's.
  final Set<int> clinicVerticalIds;

  /// When set (e.g. opened from a "Ver mais" on one of the inline nearby
  /// cards), the map centers/zooms on this establishment and opens its
  /// callout as soon as it's ready, instead of just showing the overview.
  final int? initialFocusId;

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
  PointAnnotationManager? _calloutManager;
  PointAnnotation? _calloutAnnotation;
  PointAnnotation? _calloutCloseAnnotation;
  bool _mapUnavailable = false;
  bool _calloutTapListenerRegistered = false;
  bool _clinicLayersReady = false;
  bool _clinicInteractionsRegistered = false;
  bool _closeStyleImageReady = false;

  /// Bumped on map create / style reload so a stale ensure cannot mark ready
  /// after its sources were torn down.
  int _clinicLayersEpoch = 0;

  /// Serializes source/layer setup — concurrent ensures race-remove sources
  /// while layers still reference them ("Source … missing for layer").
  Future<void>? _clinicLayersEnsureInFlight;
  Timer? _pinResyncDebounce;
  Timer? _missingImageFlush;
  final Set<String> _pendingMissingImageIds = {};
  DateTime? _lastRadiusCommitAt;

  /// Nearby clinics as plain GeoJSON points (no Supercluster).
  ///
  /// The live map clusters city-wide; this screen is radius-bounded (≤10 km)
  /// and camera-fitted to the circle — Supercluster at fit zoom merges the
  /// whole radius. Co-located addresses (~25 m) become count badges instead;
  /// the current clinic is a navy ball (or inside a stack when co-located).
  static const _nearbySourceId = 'nearby-clinicas';
  static const _nearbyStackSourceId = 'nearby-stacks';
  static const _nearbyFocusSourceId = 'nearby-focus';
  static const _nearbyRadiusSourceId = 'nearby-radius';
  static const _nearbyRadiusFillLayerId = 'nearby-radius-fill';
  static const _nearbyRadiusLineLayerId = 'nearby-radius-line';
  static const _nearbyUnclusteredLayerId = 'nearby-clinicas-unclustered';
  static const _nearbyStackLayerId = 'nearby-clinicas-stacks';
  static const _nearbyFocusLayerId = 'nearby-focus-ball';
  static const _calloutImageId = 'atlasmed-nearby-callout';
  static const _calloutCloseImageId = 'atlasmed-nearby-callout-close';
  static const _pinInteractionId = 'tap-nearby-pin';
  static const _stackInteractionId = 'tap-nearby-stack';

  static const _coLocatedThresholdKm = 0.025;

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
  /// and registered as a stable style image.
  final GlobalKey _closeButtonCaptureKey = GlobalKey();

  /// Drives the horizontal nearby-clinic card strip so it can be
  /// re-centered on whichever establishment's pin/callout is active.
  final ScrollController _cardScrollController = ScrollController();

  /// Empty = all Desempenho buckets. Same chip semantics as live map.
  final Set<String> _statusFilters = {};

  /// Co-location stack id → members (includes origin when co-located).
  Map<String, List<NearbyEstablishment>> _stackMembersById = const {};

  /// Guards [widget.initialFocusId] handling so it only runs once, even
  /// though the stable `MapWidget` key means `onStyleLoadedListener` could
  /// in theory fire again later (e.g. a style reload).
  bool _initialFocusHandled = false;

  NearbyEstablishment get _originEstablishment {
    /// The current clinic's own bucket, when the nearby list carries it.
    ///
    /// This pin is built here rather than taken from the list, so it used to
    /// have no `purchaseBucket` at all and its callout showed no status —
    /// alone among the pins on the map. The list usually contains the clinic
    /// itself (see the `e.id == widget.facilityId` branch when placing
    /// features), so its bucket is normally in hand.
    ///
    /// Left null when it genuinely is not: silence is right where the alternative
    /// is defaulting to "Nunca comprou" on a clinic that may well have bought.
    final self = widget.allNearby
        .where((e) => e.id == widget.facilityId)
        .firstOrNull;

    return NearbyEstablishment(
      id: widget.facilityId,
      name: widget.facilityName,
      latitude: widget.center.latitude,
      longitude: widget.center.longitude,
      distanceKm: 0,
      purchaseBucket: self?.purchaseBucket,
    );
  }

  Set<int> _sharedFor(List<int> userVerticalIds) => sharedNearbyVerticalIds(
    clinicVerticalIds: widget.clinicVerticalIds,
    userVerticalIds: userVerticalIds,
  );

  List<int> _userVerticalIds() {
    final verticals = ref
        .read(currentUserVerticalAssignmentsProvider)
        .valueOrNull;
    if (verticals == null) return const [];
    return verticals.map((v) => v.verticalId).toList(growable: false);
  }

  int? _verticalIdFor({
    required Set<int> shared,
    required int? selected,
    required int? fallback,
  }) => resolveNearbyVerticalId(
    sharedVerticalIds: shared,
    selectedVerticalId: selected,
    fallbackEffectiveId: fallback,
  );

  List<NearbyEstablishment> _scoped(
    List<NearbyEstablishment> items, {
    required Set<int> shared,
    int? verticalId,
  }) => applyNearbyVerticalScope(
    items: items,
    sharedVerticalIds: shared,
    queryVerticalId: verticalId,
  );

  List<NearbyEstablishment> _filterByStatus(List<NearbyEstablishment> items) {
    if (_statusFilters.isEmpty) return items;
    return items
        .where((e) {
          final bucket = e.purchaseBucket ?? PurchaseBucketFilter.neverBought;
          return _statusFilters.contains(bucket);
        })
        .toList(growable: false);
  }

  NearbyFacilitiesQuery _queryFor(int? verticalId) => NearbyFacilitiesQuery(
    facilityId: widget.facilityId,
    latitude: widget.center.latitude,
    longitude: widget.center.longitude,
    radiusKm: _committedRadiusKm,
    verticalId: verticalId,
  );

  int? _mapSelectedVerticalId() {
    final clinicLinha = ref.read(
      clinicDetailActiveLinhaIdProvider(widget.facilityId),
    );
    return clinicLinha ?? ref.read(selectedFacilityVerticalIdProvider);
  }

  void _toggleStatusFilter(String bucket) {
    setState(() {
      if (_statusFilters.contains(bucket)) {
        _statusFilters.remove(bucket);
      } else {
        _statusFilters.add(bucket);
      }
    });
    unawaited(_syncClinicPins());
    if (_selected != null && !_visible.any((e) => e.id == _selected!.id)) {
      _dismissCallout();
    }
  }

  /// Imperative pin/card helpers — uses [ref.read] (not watch).
  List<NearbyEstablishment> get _visible {
    final userVerticalIds = _userVerticalIds();
    final shared = _sharedFor(userVerticalIds);
    final clinicLinha = ref.read(
      clinicDetailActiveLinhaIdProvider(widget.facilityId),
    );
    final verticalId = _verticalIdFor(
      shared: shared,
      selected: _mapSelectedVerticalId(),
      fallback:
          ref.read(effectiveFacilityVerticalIdProvider).valueOrNull ??
          clinicLinha,
    );
    return _filterByStatus(
      filterNearbyByRadius(
        _scoped(_nearby, shared: shared, verticalId: verticalId),
        _radiusKm,
      ),
    );
  }

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
    _missingImageFlush?.cancel();
    _cardScrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    final userVerticalIds = _userVerticalIds();
    final shared = _sharedFor(userVerticalIds);
    final clinicLinha = ref.watch(
      clinicDetailActiveLinhaIdProvider(widget.facilityId),
    );
    final selected =
        clinicLinha ?? ref.watch(selectedFacilityVerticalIdProvider);
    final fallback =
        ref.watch(effectiveFacilityVerticalIdProvider).valueOrNull ??
        clinicLinha;
    final verticalId = _verticalIdFor(
      shared: shared,
      selected: selected,
      fallback: fallback,
    );
    final query = _queryFor(verticalId);
    final nearbyAsync = ref.watch(facilityNearbyProvider(query));
    ref.listen<AsyncValue<List<NearbyEstablishment>>>(
      facilityNearbyProvider(query),
      (previous, next) {
        next.whenData((items) {
          if (!mounted) return;
          setState(() => _nearby = items);
          unawaited(_syncClinicPins());
          final visibleNow = filterNearbyByRadius(
            _scoped(items, shared: shared, verticalId: verticalId),
            _radiusKm,
          );
          if (_selected != null &&
              !_filterByStatus(visibleNow).any((e) => e.id == _selected!.id)) {
            _dismissCallout();
          }
        });
      },
    );
    final visible = _filterByStatus(
      filterNearbyByRadius(
        _scoped(
          nearbyAsync.valueOrNull ?? _nearby,
          shared: shared,
          verticalId: verticalId,
        ),
        _radiusKm,
      ),
    );

    return Scaffold(
      backgroundColor: AppColors.surfaceTertiary,
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
                          color: AppColors.gray900,
                        ),
                      ),
                      Text(
                        widget.facilityName,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.gray500,
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
          FacilityVerticalFilterBar(
            allowedVerticalIds: shared.isEmpty ? null : shared,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
            allowAll: false,
            syncExploreSelection: false,
            selectedVerticalId: clinicLinha,
            onChanged: (id) {
              if (id == null) return;
              ref
                      .read(
                        clinicDetailSelectedLinhaIdProvider(
                          widget.facilityId,
                        ).notifier,
                      )
                      .state =
                  id;
            },
          ),
          _NearbyStatusFilterBar(
            selected: _statusFilters,
            onToggle: _toggleStatusFilter,
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
                        onStyleImageMissingListener: _onStyleImageMissing,
                        onStyleLoadedListener: (_) async {
                          await useFlatProjection(_mapboxMap);
                          _clinicLayersEpoch++;
                          _clinicLayersReady = false;
                          _clinicInteractionsRegistered = false;
                          _closeStyleImageReady = false;
                          _pendingMissingImageIds.clear();
                          await _ensureClinicLayers();
                          await _updateRadiusCircle();
                          await _syncClinicPins();
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
                            child: ClinicPinCalloutContent(
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
                          child: const ClinicPinCalloutCloseButton(),
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
    _clinicLayersEpoch++;
    _clinicLayersReady = false;
    _clinicInteractionsRegistered = false;
    _closeStyleImageReady = false;
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

  void _onStyleImageMissing(StyleImageMissingEventData event) {
    final id = event.id;
    if (!id.startsWith(NearbyStackMarker.imageIdPrefix) &&
        !id.startsWith('atlasmed-clinic-pin') &&
        id != _calloutCloseImageId &&
        id != _calloutImageId) {
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
      final stackIds = ids
          .where((id) => id.startsWith(NearbyStackMarker.imageIdPrefix))
          .toList(growable: false);
      if (stackIds.isNotEmpty) {
        await NearbyStackMarker.ensureImagesById(
          map.style,
          devicePixelRatio: dpr,
          imageIds: stackIds,
        );
      }
      if (ids.any((id) => id.startsWith('atlasmed-clinic-pin'))) {
        await ClinicMapPin.ensureRegistered(map.style, devicePixelRatio: dpr);
      }
    } catch (_) {
      // Best-effort; next camera/sync pass may retry.
    }
  }

  void _onRadiusChanged(double value) {
    final radius = snapNearbyRadiusKm(value);
    setState(() => _radiusKm = radius);
    unawaited(_updateRadiusCircle());
    // Always snap back to the establishment the page is about (not
    // wherever the user may have panned/zoomed to) and auto-fit the zoom
    // so the whole search radius stays visible as it grows/shrinks.
    _fitCameraToRadius(radius);
    // Drop out-of-range pins/cards immediately via [_visible] filter —
    // do not wait for the next API response (which still has the wider set
    // cached until [_committedRadiusKm] updates).
    unawaited(_syncClinicPins());
    if (_selected != null && !_visible.any((e) => e.id == _selected!.id)) {
      _dismissCallout();
    }
    // Progressive refetch while enlarging: trailing debounce + max-wait so
    // continuous drags keep querying instead of waiting until the thumb stops.
    _scheduleRadiusCommit(radius);
  }

  static const _radiusCommitDebounce = Duration(milliseconds: 140);
  static const _radiusCommitMaxWait = Duration(milliseconds: 320);

  void _scheduleRadiusCommit(double radius) {
    _pinResyncDebounce?.cancel();
    final enlarging = radius > _committedRadiusKm;
    final last = _lastRadiusCommitAt;
    final forceCommit =
        enlarging &&
        (last == null ||
            DateTime.now().difference(last) >= _radiusCommitMaxWait);

    if (forceCommit) {
      _commitRadiusKm(radius);
      return;
    }

    _pinResyncDebounce = Timer(_radiusCommitDebounce, () {
      if (!mounted) return;
      _commitRadiusKm(radius);
    });
  }

  void _commitRadiusKm(double radius) {
    if (radius == _committedRadiusKm) return;
    _lastRadiusCommitAt = DateTime.now();
    setState(() => _committedRadiusKm = radius);
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

  Future<void> _ensureClinicLayers() async {
    final map = _mapboxMap;
    if (map == null || !mounted) return;

    // Loop so a waiter that joined a build invalidated by a style reload
    // starts a fresh build for the new epoch instead of returning unready.
    while (mounted) {
      if (_clinicLayersReady && await _clinicSourcesPresent(map.style)) {
        return;
      }
      _clinicLayersReady = false;

      final inFlight = _clinicLayersEnsureInFlight;
      if (inFlight != null) {
        await inFlight;
        continue;
      }

      final epoch = _clinicLayersEpoch;
      final future = _buildClinicLayers(epoch);
      _clinicLayersEnsureInFlight = future;
      try {
        await future;
      } finally {
        if (identical(_clinicLayersEnsureInFlight, future)) {
          _clinicLayersEnsureInFlight = null;
        }
      }

      if (_clinicLayersReady && await _clinicSourcesPresent(map.style)) {
        return;
      }
      // Build failed or was aborted for this epoch — stop unless a newer
      // style load bumped the epoch and needs another pass.
      if (epoch == _clinicLayersEpoch) return;
    }
  }

  Future<bool> _clinicSourcesPresent(StyleManager style) async {
    return await style.styleSourceExists(_nearbySourceId) &&
        await style.styleSourceExists(_nearbyStackSourceId) &&
        await style.styleSourceExists(_nearbyFocusSourceId);
  }

  Future<void> _removeLayerIfExists(StyleManager style, String id) async {
    if (await style.styleLayerExists(id)) {
      await style.removeStyleLayer(id);
    }
  }

  Future<void> _removeSourceIfExists(StyleManager style, String id) async {
    if (await style.styleSourceExists(id)) {
      await style.removeStyleSource(id);
    }
  }

  Future<void> _buildClinicLayers(int epoch) async {
    final map = _mapboxMap;
    if (map == null || !mounted || epoch != _clinicLayersEpoch) return;
    final dpr = MediaQuery.devicePixelRatioOf(context);

    try {
      final style = map.style;

      await ClinicMapPin.ensureRegistered(style, devicePixelRatio: dpr);
      await NearbyStackMarker.ensureImages(
        style,
        devicePixelRatio: dpr,
        specs: [
          for (final bucket in PurchaseBucketFilter.values)
            for (final count in const [2, 3, 4, 5])
              (bucket: bucket, count: count),
        ],
      );
      if (!mounted || epoch != _clinicLayersEpoch) return;

      // Always layers-before-sources. Never leave a layer without its source.
      // Also drop legacy cluster / focus-pin layers from earlier builds.
      for (final id in [
        _nearbyFocusLayerId,
        'nearby-focus-pin',
        _nearbyStackLayerId,
        _nearbyUnclusteredLayerId,
        'nearby-clinicas-cluster-count',
        'nearby-clinicas-clusters',
        _nearbyRadiusLineLayerId,
        _nearbyRadiusFillLayerId,
      ]) {
        await _removeLayerIfExists(style, id);
      }
      for (final id in [
        _nearbySourceId,
        _nearbyStackSourceId,
        _nearbyFocusSourceId,
        _nearbyRadiusSourceId,
      ]) {
        await _removeSourceIfExists(style, id);
      }
      if (!mounted || epoch != _clinicLayersEpoch) return;

      // Radius under pins: add fill/line first, then pin/stack/focus on top.
      // Style layers (not PolygonAnnotation) so taps reach pins.
      await style.addSource(
        GeoJsonSource(
          id: _nearbyRadiusSourceId,
          data: jsonEncode({
            'type': 'FeatureCollection',
            'features': <Object>[],
          }),
        ),
      );
      await style.addLayer(
        FillLayer(
          id: _nearbyRadiusFillLayerId,
          sourceId: _nearbyRadiusSourceId,
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
          fillColor: AppColors.navyBright.toARGB32(),
          fillOpacity: 0.10,
        ),
      );
      await style.addLayer(
        LineLayer(
          id: _nearbyRadiusLineLayerId,
          sourceId: _nearbyRadiusSourceId,
          lineColor: AppColors.blue600.toARGB32(),
          lineWidth: 1.5,
          lineOpacity: 0.40,
        ),
      );

      await style.addSource(
        GeoJsonSource(
          id: _nearbySourceId,
          data: jsonEncode({
            'type': 'FeatureCollection',
            'features': <Object>[],
          }),
        ),
      );
      await style.addSource(
        GeoJsonSource(
          id: _nearbyStackSourceId,
          data: jsonEncode({
            'type': 'FeatureCollection',
            'features': <Object>[],
          }),
        ),
      );
      await style.addSource(
        GeoJsonSource(
          id: _nearbyFocusSourceId,
          data: jsonEncode({
            'type': 'FeatureCollection',
            'features': <Object>[],
          }),
        ),
      );
      if (!mounted || epoch != _clinicLayersEpoch) return;

      await style.addLayer(
        SymbolLayer(
          id: _nearbyUnclusteredLayerId,
          sourceId: _nearbySourceId,
          iconImageExpression: ClinicMapPin.iconImageExpression,
          iconAnchor: IconAnchor.BOTTOM,
          iconAllowOverlap: true,
          iconIgnorePlacement: true,
          iconSize: 1,
        ),
      );
      await style.addLayer(
        SymbolLayer(
          id: _nearbyStackLayerId,
          sourceId: _nearbyStackSourceId,
          iconImageExpression: NearbyStackMarker.iconImageExpression,
          iconAnchor: IconAnchor.CENTER,
          iconAllowOverlap: true,
          iconIgnorePlacement: true,
          iconSize: 1,
        ),
      );
      // Current clinic “you are here”: white fill + navy ring — not a
      // status-colored count disc (those are co-location stacks).
      await style.addLayer(
        CircleLayer(
          id: _nearbyFocusLayerId,
          sourceId: _nearbyFocusSourceId,
          circleColor: Colors.white.toARGB32(),
          circleRadius: 7,
          circleStrokeColor: AppColors.navyBright.toARGB32(),
          circleStrokeWidth: 4,
          circleOpacity: 1,
        ),
      );

      if (!await _clinicSourcesPresent(style) || epoch != _clinicLayersEpoch) {
        return;
      }

      _clinicLayersReady = true;
      // Layers were recreated — re-bind pin/stack taps.
      _clinicInteractionsRegistered = false;
      _registerClinicInteractions(map);
    } catch (_) {
      _clinicLayersReady = false;
      if (mounted) setState(() => _mapUnavailable = true);
    }
  }

  void _registerClinicInteractions(MapboxMap map) {
    if (_clinicInteractionsRegistered) return;
    try {
      for (final id in [
        _pinInteractionId,
        _stackInteractionId,
        'tap-nearby-cluster',
        'tap-nearby-cluster-count',
      ]) {
        try {
          map.removeInteraction(id);
        } catch (_) {}
      }
      map.addInteraction(
        TapInteraction(
          FeaturesetDescriptor(layerId: _nearbyUnclusteredLayerId),
          (feature, _) {
            unawaited(_onUnclusteredFeatureTapped(feature));
          },
        ),
        interactionID: _pinInteractionId,
      );
      map.addInteraction(
        TapInteraction(FeaturesetDescriptor(layerId: _nearbyStackLayerId), (
          feature,
          _,
        ) {
          unawaited(_onStackFeatureTapped(feature));
        }),
        interactionID: _stackInteractionId,
      );
      _clinicInteractionsRegistered = true;
    } catch (_) {
      _clinicInteractionsRegistered = false;
    }
  }

  /// Pushes singleton pins, co-location stacks, and origin ball into sources.
  Future<void> _syncClinicPins() async {
    final map = _mapboxMap;
    if (map == null || !mounted) return;

    try {
      await _ensureClinicLayers();
      if (!_clinicLayersReady) return;

      final groups = _colocateGroups(_visible);
      final pinFeatures = <Map<String, Object?>>[];
      final stackFeatures = <Map<String, Object?>>[];
      final focusFeatures = <Map<String, Object?>>[];
      final stackMembers = <String, List<NearbyEstablishment>>{};
      final stackSpecs = <({String bucket, num count})>[];

      for (final group in groups) {
        if (group.length == 1) {
          final e = group.first;
          if (e.id == widget.facilityId) {
            focusFeatures.add(_focusFeature());
          } else {
            pinFeatures.add(_pinFeature(e));
          }
          continue;
        }

        final stackId = group.map((e) => e.id).join('|');
        stackMembers[stackId] = group;
        final count = group.length;
        // Worst bucket among clinics that have status (skip origin if null).
        final worst = NearbyStackMarker.worstBucket(
          group
              .where(
                (e) => e.id != widget.facilityId || e.purchaseBucket != null,
              )
              .map((e) => e.purchaseBucket),
        );
        stackSpecs.add((bucket: worst, count: count));
        var lat = 0.0;
        var lng = 0.0;
        for (final e in group) {
          lat += e.latitude;
          lng += e.longitude;
        }
        lat /= count;
        lng /= count;
        stackFeatures.add({
          'type': 'Feature',
          'geometry': {
            'type': 'Point',
            'coordinates': [lng, lat],
          },
          'properties': {
            'stackId': stackId,
            'point_count': count,
            'purchaseBucket': worst,
            'includesOrigin': group.any((e) => e.id == widget.facilityId)
                ? 1
                : 0,
          },
        });
      }

      _stackMembersById = stackMembers;

      if (!mounted) return;
      final dpr = MediaQuery.devicePixelRatioOf(context);
      await NearbyStackMarker.ensureImages(
        map.style,
        devicePixelRatio: dpr,
        specs: stackSpecs,
      );
      if (!mounted) return;

      await map.style.setStyleSourceProperty(
        _nearbySourceId,
        'data',
        jsonEncode({'type': 'FeatureCollection', 'features': pinFeatures}),
      );
      await map.style.setStyleSourceProperty(
        _nearbyStackSourceId,
        'data',
        jsonEncode({'type': 'FeatureCollection', 'features': stackFeatures}),
      );
      await map.style.setStyleSourceProperty(
        _nearbyFocusSourceId,
        'data',
        jsonEncode({'type': 'FeatureCollection', 'features': focusFeatures}),
      );
    } catch (_) {
      // Keep the basemap; pins can retry on the next sync/style load.
    }
  }

  Map<String, Object?> _pinFeature(NearbyEstablishment e) => {
    'type': 'Feature',
    'geometry': {
      'type': 'Point',
      'coordinates': [e.longitude, e.latitude],
    },
    'properties': {
      'facilityId': e.id,
      'name': e.name,
      'purchaseBucket': e.purchaseBucket ?? PurchaseBucketFilter.neverBought,
      'focused': 0,
    },
  };

  Map<String, Object?> _focusFeature() => {
    'type': 'Feature',
    'geometry': {
      'type': 'Point',
      'coordinates': [widget.center.longitude, widget.center.latitude],
    },
    'properties': {
      'facilityId': widget.facilityId,
      'name': widget.facilityName,
    },
  };

  /// Geographic co-location groups (~25 m), including the current clinic.
  List<List<NearbyEstablishment>> _colocateGroups(
    List<NearbyEstablishment> nearby,
  ) {
    final members = <NearbyEstablishment>[
      ...nearby.where((e) => e.id != widget.facilityId),
      _originEstablishment,
    ];
    if (members.isEmpty) return const [];

    final parent = List<int>.generate(members.length, (i) => i);
    int find(int i) {
      while (parent[i] != i) {
        parent[i] = parent[parent[i]];
        i = parent[i];
      }
      return i;
    }

    void union(int a, int b) {
      final ra = find(a);
      final rb = find(b);
      if (ra != rb) parent[rb] = ra;
    }

    for (var i = 0; i < members.length; i++) {
      for (var j = i + 1; j < members.length; j++) {
        if (_haversineKm(
              members[i].latitude,
              members[i].longitude,
              members[j].latitude,
              members[j].longitude,
            ) <=
            _coLocatedThresholdKm) {
          union(i, j);
        }
      }
    }

    final buckets = <int, List<NearbyEstablishment>>{};
    for (var i = 0; i < members.length; i++) {
      buckets.putIfAbsent(find(i), () => []).add(members[i]);
    }
    return buckets.values.toList(growable: false);
  }

  /// Draws (or redraws) a lightly-shaded circle over the current search
  /// radius. Cheap enough to call on every slider tick — unlike the pins,
  /// it doesn't need debouncing to look smooth as the slider moves.
  ///
  /// Uses a GeoJSON Fill/Line layer (not PolygonAnnotation). Annotation
  /// managers own an interactive layer that steals taps across the whole
  /// radius, so pin TapInteractions never fire.
  Future<void> _updateRadiusCircle() async {
    final map = _mapboxMap;
    if (map == null || !mounted) return;
    try {
      await _ensureClinicLayers();
      if (!_clinicLayersReady) return;
      if (!await map.style.styleSourceExists(_nearbyRadiusSourceId)) return;
      final ring = _circlePositions(widget.center, _radiusKm)
          .map((p) => [p.lng.toDouble(), p.lat.toDouble()])
          .toList(growable: false);
      await map.style.setStyleSourceProperty(
        _nearbyRadiusSourceId,
        'data',
        jsonEncode({
          'type': 'FeatureCollection',
          'features': [
            {
              'type': 'Feature',
              'geometry': {
                'type': 'Polygon',
                'coordinates': [ring],
              },
              'properties': <String, Object>{},
            },
          ],
        }),
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

  Future<void> _onUnclusteredFeatureTapped(FeaturesetFeature feature) async {
    _suppressNextMapTap = true;
    Future.delayed(
      const Duration(milliseconds: 300),
      () => _suppressNextMapTap = false,
    );

    final facilityId = readCrmIdLoose(feature.properties['facilityId']);
    NearbyEstablishment? match;
    if (facilityId != null) {
      for (final e in _visible) {
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

    await _selectPinEstablishment(match);
  }

  Future<void> _onStackFeatureTapped(FeaturesetFeature feature) async {
    _suppressNextMapTap = true;
    Future.delayed(
      const Duration(milliseconds: 300),
      () => _suppressNextMapTap = false,
    );

    final stackId = feature.properties['stackId']?.toString();
    var members = stackId == null ? null : _stackMembersById[stackId];
    if (members == null || members.isEmpty) {
      final point = _pointFromGeometry(feature.geometry);
      if (point == null) return;
      members = _establishmentsNear(point.latitude, point.longitude);
    }
    if (members.isEmpty) return;

    await _centerOn(members.first.latitude, members.first.longitude, zoom: 15);
    await _dismissCallout();
    if (!mounted) return;
    await _showStackedEstablishmentsSheet(members);
  }

  Future<void> _selectPinEstablishment(NearbyEstablishment match) async {
    final stacked = _establishmentsNear(match.latitude, match.longitude);
    await _centerOn(match.latitude, match.longitude, zoom: 15);

    if (stacked.length > 1) {
      await _dismissCallout();
      if (!mounted) return;
      await _showStackedEstablishmentsSheet(stacked);
      return;
    }

    if (match.id == widget.facilityId) return;

    if (_selected?.id == match.id) {
      await _dismissCallout();
      return;
    }

    await _showCallout(match);
    _scrollToCard(match.id);
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

  /// Tapping a card zooms/centers on that pin and opens callout or stack sheet.
  Future<void> _onCardTapped(int id) => _focusOnEstablishment(id);

  Future<void> _centerOn(
    double latitude,
    double longitude, {
    double? zoom,
  }) async {
    await _mapboxMap?.easeTo(
      CameraOptions(
        center: Point(coordinates: Position(longitude, latitude)),
        zoom: zoom,
      ),
      MapAnimationOptions(duration: 300),
    );
  }

  /// Clinics within ~25 m of a point — treated as the same map spot.
  /// Includes the current clinic when it shares that spot.
  List<NearbyEstablishment> _establishmentsNear(
    double latitude,
    double longitude,
  ) {
    final matches = _visible
        .where(
          (e) =>
              e.id != widget.facilityId &&
              _haversineKm(latitude, longitude, e.latitude, e.longitude) <=
                  _coLocatedThresholdKm,
        )
        .toList();
    final originNear =
        _haversineKm(
          latitude,
          longitude,
          widget.center.latitude,
          widget.center.longitude,
        ) <=
        _coLocatedThresholdKm;
    if (originNear) {
      matches.insert(0, _originEstablishment);
    }
    return matches;
  }

  Future<void> _showStackedEstablishmentsSheet(
    List<NearbyEstablishment> establishments,
  ) async {
    // Current clinic always first when present in the stack.
    final ordered = [
      ...establishments.where((e) => e.id == widget.facilityId),
      ...establishments.where((e) => e.id != widget.facilityId),
    ];
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
                      color: AppColors.gray300,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  '${ordered.length} clínicas neste local',
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
                    itemCount: ordered.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (_, i) {
                      final e = ordered[i];
                      final isCurrent = e.id == widget.facilityId;
                      return _StackedEstablishmentTile(
                        establishment: e,
                        isCurrentClinic: isCurrent,
                        onTap: () {
                          Navigator.of(sheetContext).pop();
                          if (!isCurrent) _openEstablishment(e.id);
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
  Future<void> _focusOnEstablishment(int id) async {
    NearbyEstablishment? match;
    for (final e in _visible) {
      if (e.id == id) {
        match = e;
        break;
      }
    }
    if (match == null) return;

    final stacked = _establishmentsNear(match.latitude, match.longitude);
    await _centerOn(match.latitude, match.longitude, zoom: 15);
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
  void _scrollToCard(int id) {
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
    final pxW = image.width;
    final pxH = image.height;
    final logicalHeight = pxH / devicePixelRatio;
    final closeReady = await _ensureCloseButtonStyleImage(map);
    if (!mounted || _pendingCapture?.id != establishment.id) return;

    final geometry = Point(
      coordinates: Position(establishment.longitude, establishment.latitude),
    );

    try {
      // Stable style image ids — never pass raw `image:` bytes (UUID churn).
      await map.style.addStyleImage(
        _calloutImageId,
        devicePixelRatio,
        MbxImage(width: pxW, height: pxH, data: bytes),
        false,
        [],
        [],
        null,
      );

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
          iconImage: _calloutImageId,
          iconAnchor: IconAnchor.BOTTOM,
          iconOffset: [0, -16],
          symbolSortKey: 3,
          customData: {'action': 'open', 'facilityId': establishment.id},
        ),
      );
      if (previous != null) await manager.delete(previous);

      final previousClose = _calloutCloseAnnotation;
      if (closeReady) {
        // Anchored to the same point as the bubble (so it tracks it
        // through pans/zooms) but offset to sit right on the bubble's
        // top-right corner, straddling the edge like a badge.
        _calloutCloseAnnotation = await manager.create(
          PointAnnotationOptions(
            geometry: geometry,
            iconImage: _calloutCloseImageId,
            iconAnchor: IconAnchor.CENTER,
            iconOffset: [
              ClinicPinCalloutContent.cardWidth / 2,
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

  /// Rasterizes the close ("X") badge once and registers it as a style image.
  Future<bool> _ensureCloseButtonStyleImage(MapboxMap map) async {
    if (_closeStyleImageReady) return true;

    await WidgetsBinding.instance.endOfFrame;
    await WidgetsBinding.instance.endOfFrame;
    if (!mounted) return false;
    final boundary = _closeButtonCaptureKey.currentContext?.findRenderObject();
    if (boundary is! RenderRepaintBoundary) return false;
    final devicePixelRatio = MediaQuery.of(context).devicePixelRatio;
    final image = await boundary.toImage(pixelRatio: devicePixelRatio);
    final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
    final pxW = image.width;
    final pxH = image.height;
    image.dispose();
    if (byteData == null) return false;
    await map.style.addStyleImage(
      _calloutCloseImageId,
      devicePixelRatio,
      MbxImage(width: pxW, height: pxH, data: byteData.buffer.asUint8List()),
      false,
      [],
      [],
      null,
    );
    if (!mounted) return false;
    _closeStyleImageReady = true;
    return true;
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
    final id = readCrmIdLoose(annotation.customData?['facilityId']);
    if (id != null) _openEstablishment(id);
  }

  void _openEstablishment(int id) {
    if (id == widget.facilityId) return;
    ClinicDetailRoute(id: id).push(context);
  }

  Point _point(EstablishmentLocation loc) =>
      Point(coordinates: Position(loc.longitude, loc.latitude));
}

class _StackedEstablishmentTile extends StatelessWidget {
  const _StackedEstablishmentTile({
    required this.establishment,
    required this.onTap,
    this.isCurrentClinic = false,
  });

  final NearbyEstablishment establishment;
  final VoidCallback onTap;
  final bool isCurrentClinic;

  @override
  Widget build(BuildContext context) {
    final dotColor = isCurrentClinic
        ? AppColors.navyBright
        : _nearbyStatusDotColor(establishment);
    return InkWell(
      onTap: isCurrentClinic ? null : onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 12, 10, 12),
        decoration: BoxDecoration(
          color: isCurrentClinic
              ? AppColors.blueLight
              : AppColors.surfaceTertiary,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isCurrentClinic ? AppColors.navyBright : AppColors.gray200,
            width: isCurrentClinic ? 1.4 : 1,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: isCurrentClinic ? 10 : 8,
              height: isCurrentClinic ? 10 : 8,
              decoration: BoxDecoration(
                color: dotColor,
                shape: BoxShape.circle,
                border: isCurrentClinic
                    ? Border.all(color: Colors.white, width: 2)
                    : null,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    establishment.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray900,
                    ),
                  ),
                  if (isCurrentClinic) ...[
                    const SizedBox(height: 2),
                    const Text(
                      'Clínica atual',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.navyBright,
                      ),
                    ),
                  ] else ...[
                    if (establishment.specialtyLabel != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        establishment.specialtyLabel!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.gray500,
                        ),
                      ),
                    ],
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
                ],
              ),
            ),
            if (!isCurrentClinic)
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
  final int? selectedId;
  final ScrollController scrollController;
  final ValueChanged<int> onEstablishmentTap;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    // A plain section of the screen (below the map, not floating over it),
    // separated only by a hairline — not a card, so no elevation/rounding.
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.gray200)),
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
                    color: AppColors.gray900,
                  ),
                ),
                Text(
                  '${radiusKm.toStringAsFixed(1)} km · $count',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: AppColors.navyBright,
                  ),
                ),
              ],
            ),
            SliderTheme(
              data: SliderTheme.of(context).copyWith(
                trackHeight: 5,
                activeTrackColor: AppColors.navyBright,
                inactiveTrackColor: AppColors.gray200,
                thumbColor: AppColors.navyBright,
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
            const SizedBox(height: 10),
            SizedBox(
              height: 152,
              child: establishments.isEmpty
                  ? const Center(
                      child: Text(
                        'Nenhuma clínica encontrada',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w500,
                          color: AppColors.gray400,
                        ),
                      ),
                    )
                  : ListView.separated(
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
          color: isSelected ? AppColors.blueLight : AppColors.surfaceTertiary,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected ? AppColors.navyBright : AppColors.gray200,
            width: isSelected ? 1.4 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: _nearbyStatusDotColor(establishment),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    establishment.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    softWrap: false,
                    style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray900,
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
                style: const TextStyle(fontSize: 11, color: AppColors.gray500),
              ),
            ],
            if (establishment.shortAddress != null) ...[
              const SizedBox(height: 3),
              // Takes the room the Spacer used to hold empty.
              //
              // The address was capped at one line above a Spacer, so
              // "Av. Paes de Barros, 2128 …" was clipped mid-street while the
              // card sat half blank beneath it. Expanded lets it use whatever
              // the card has left and ellipsize only at the real bottom, and it
              // keeps the distance row pinned exactly where the Spacer put it.
              Expanded(
                child: Text(
                  establishment.shortAddress!,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 10.5,
                    color: AppColors.gray400,
                  ),
                ),
              ),
            ] else
              const Spacer(),
            Row(
              children: [
                const Icon(
                  Icons.near_me_rounded,
                  size: 11,
                  color: AppColors.gray500,
                ),
                const SizedBox(width: 3),
                Text(
                  '${establishment.distanceKm.toStringAsFixed(1)} km',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: AppColors.gray500,
                  ),
                ),
                const Spacer(),
                const Icon(
                  Icons.chevron_right_rounded,
                  size: 15,
                  color: AppColors.navyBright,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
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
  final int facilityId;
  final ValueChanged<int> onTapEstablishment;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: Container(
            margin: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surfaceSecondary,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.map_outlined,
                    size: 48,
                    color: AppColors.navyBright,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${center.latitude.toStringAsFixed(4)}, ${center.longitude.toStringAsFixed(4)}',
                    style: const TextStyle(color: AppColors.gray500),
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
                  color: AppColors.green,
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

/// Desempenho status chips — same semantics as live map.
class _NearbyStatusFilterBar extends StatelessWidget {
  const _NearbyStatusFilterBar({
    required this.selected,
    required this.onToggle,
  });

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
                return _NearbyStatusChip(
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

class _NearbyStatusChip extends StatelessWidget {
  const _NearbyStatusChip({
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
