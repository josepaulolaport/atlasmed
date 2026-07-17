import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_mock.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/filter_data.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart' hide Size;

/// Full-screen map of establishments near the current facility (mock Phase 1).
class ClinicNearbyMapScreen extends StatefulWidget {
  const ClinicNearbyMapScreen({
    super.key,
    required this.facilityId,
    required this.facilityName,
    required this.center,
    required this.allNearby,
  });

  final String facilityId;
  final String facilityName;
  final EstablishmentLocation center;
  final List<NearbyEstablishment> allNearby;

  @override
  State<ClinicNearbyMapScreen> createState() => _ClinicNearbyMapScreenState();
}

class _ClinicNearbyMapScreenState extends State<ClinicNearbyMapScreen> {
  late double _radiusKm = establishmentNearbyDefaultRadiusKm;
  MapboxMap? _mapboxMap;
  CircleAnnotationManager? _pinAnnotationManager;
  PolygonAnnotationManager? _radiusCircleManager;
  PointAnnotationManager? _calloutManager;
  PointAnnotation? _calloutAnnotation;
  bool _mapUnavailable = false;
  bool _pinTapListenerRegistered = false;
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

  List<NearbyEstablishment> get _visible =>
      filterNearbyByRadius(widget.allNearby, _radiusKm);

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
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;

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
                    establishments: _visible,
                    facilityId: widget.facilityId,
                    onTapEstablishment: _openEstablishment,
                  )
                : Stack(
                    children: [
                      MapWidget(
                        key: const ValueKey('nearby-map'),
                        styleUri: MapboxStyles.STANDARD,
                        viewport: CameraViewportState(
                          center: _point(widget.center),
                          zoom: _zoomForRadius(_radiusKm),
                        ),
                        onMapCreated: _onMapCreated,
                        onMapLoadErrorListener: (_) =>
                            setState(() => _mapUnavailable = true),
                        onStyleLoadedListener: (_) => _syncAnnotations(),
                        onTapListener: _onMapBackgroundTapped,
                      ),
                      Positioned(
                        left: 16,
                        right: 16,
                        bottom: 16,
                        child: _RadiusPanel(
                          radiusKm: _radiusKm,
                          count: _visible.length,
                          establishments: _visible,
                          selectedId: _selected?.id,
                          onEstablishmentTap: _openEstablishment,
                          onChanged: _onRadiusChanged,
                        ),
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
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  void _onMapCreated(MapboxMap map) {
    _mapboxMap = map;
    _pinAnnotationManager = null;
    _radiusCircleManager = null;
    _calloutManager = null;
    _calloutAnnotation = null;
    _pinTapListenerRegistered = false;
    _calloutTapListenerRegistered = false;
  }

  void _onRadiusChanged(double value) {
    setState(() => _radiusKm = value);
    _updateRadiusCircle();
    _mapboxMap?.easeTo(
      CameraOptions(zoom: _zoomForRadius(value)),
      MapAnimationOptions(duration: 200),
    );
    // Re-syncing pins on every slider tick (and tearing down/rebuilding the
    // whole MapWidget, as this screen used to) raced the annotation manager
    // against an in-flight native map teardown and could leave the map
    // permanently stuck on the offline placeholder — debounce it instead so
    // it only runs once the user stops dragging.
    _pinResyncDebounce?.cancel();
    _pinResyncDebounce = Timer(const Duration(milliseconds: 200), () {
      _syncAnnotations();
      if (_selected != null && !_visible.any((e) => e.id == _selected!.id)) {
        _dismissCallout();
      }
    });
  }

  double _zoomForRadius(double km) {
    if (km <= 2) return 14;
    if (km <= 5) return 13;
    if (km <= 10) return 12;
    if (km <= 25) return 11;
    return 10;
  }

  Future<void> _syncAnnotations() async {
    final map = _mapboxMap;
    if (map == null || !mounted) return;

    try {
      // Creation order matters: layers created later render on top, so the
      // radius circle (bottom), then pins, then the callout (created lazily
      // in _showCallout) always end up correctly stacked.
      await _updateRadiusCircle();

      _pinAnnotationManager ??= await map.annotations
          .createCircleAnnotationManager();
      if (!_pinTapListenerRegistered) {
        _pinAnnotationManager!.tapEvents(onTap: _onPinTapped);
        _pinTapListenerRegistered = true;
      }
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

      if (_visible.isNotEmpty) {
        await _pinAnnotationManager!.createMulti(
          _visible
              .map(
                (e) => CircleAnnotationOptions(
                  geometry: Point(
                    coordinates: Position(e.longitude, e.latitude),
                  ),
                  circleColor: const Color(0xFF16a373).toARGB32(),
                  circleRadius: 8,
                  circleStrokeColor: Colors.white.toARGB32(),
                  circleStrokeWidth: 2,
                  circleSortKey: 1,
                  customData: {'facilityId': e.id, 'name': e.name},
                ),
              )
              .toList(),
        );
      }
    } catch (_) {
      if (mounted) setState(() => _mapUnavailable = true);
    }
  }

  /// Draws (or redraws) a lightly-shaded circle over the current search
  /// radius. Cheap enough to call on every slider tick — unlike the pins,
  /// it doesn't need debouncing to look smooth as the slider moves.
  Future<void> _updateRadiusCircle() async {
    final map = _mapboxMap;
    if (map == null || !mounted) return;
    try {
      _radiusCircleManager ??= await map.annotations
          .createPolygonAnnotationManager();
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
    final id = annotation.customData?['facilityId'];
    if (id == null || id == widget.facilityId) return;

    _suppressNextMapTap = true;
    Future.delayed(
      const Duration(milliseconds: 300),
      () => _suppressNextMapTap = false,
    );

    if (_selected?.id == id) {
      await _dismissCallout();
      return;
    }

    NearbyEstablishment? match;
    for (final e in _visible) {
      if (e.id == id) {
        match = e;
        break;
      }
    }
    if (match == null) return;
    await _showCallout(match);
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
    final image = await boundary.toImage(pixelRatio: 1.0);
    final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    if (byteData == null ||
        !mounted ||
        _pendingCapture?.id != establishment.id) {
      return;
    }
    final bytes = byteData.buffer.asUint8List();

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
          geometry: Point(
            coordinates: Position(
              establishment.longitude,
              establishment.latitude,
            ),
          ),
          image: bytes,
          iconAnchor: IconAnchor.BOTTOM,
          iconOffset: [0, -16],
          symbolSortKey: 3,
          customData: {'facilityId': establishment.id},
        ),
      );
      if (previous != null) await manager.delete(previous);
    } catch (_) {
      // Leave _selected as-is so the highlighted card still reflects intent;
      // just skip showing a callout bubble if the native call failed.
    }

    if (mounted) setState(() => _pendingCapture = null);
  }

  Future<void> _dismissCallout() async {
    if (_selected == null && _calloutAnnotation == null) return;
    final annotation = _calloutAnnotation;
    final manager = _calloutManager;
    _calloutAnnotation = null;
    if (mounted) {
      setState(() {
        _selected = null;
        _pendingCapture = null;
      });
    } else {
      _selected = null;
      _pendingCapture = null;
    }
    if (annotation != null && manager != null) {
      try {
        await manager.delete(annotation);
      } catch (_) {
        // Manager may already be gone (e.g. map was disposed) — ignore.
      }
    }
  }

  void _onCalloutTapped(PointAnnotation annotation) {
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

class _RadiusPanel extends StatelessWidget {
  const _RadiusPanel({
    required this.radiusKm,
    required this.count,
    required this.establishments,
    required this.onEstablishmentTap,
    required this.onChanged,
    this.selectedId,
  });

  final double radiusKm;
  final int count;
  final List<NearbyEstablishment> establishments;
  final String? selectedId;
  final ValueChanged<String> onEstablishmentTap;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1A111827),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
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
                  '${radiusKm.round()} km · $count',
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
              // Continuous (no divisions/label snapping) so it moves freely,
              // like a volume slider, instead of stepping in whole km.
              child: Slider(
                value: radiusKm,
                min: 1,
                max: establishmentNearbyDefaultRadiusKm,
                onChanged: onChanged,
              ),
            ),
            if (establishments.isNotEmpty) ...[
              const SizedBox(height: 10),
              SizedBox(
                height: 92,
                child: ListView.separated(
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

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        width: 168,
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
                    'Toque para ver detalhes',
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
