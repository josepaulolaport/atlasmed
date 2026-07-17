import 'package:flutter/material.dart';
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
  CircleAnnotationManager? _annotationManager;
  bool _mapUnavailable = false;
  bool _tapListenerRegistered = false;

  /// Guards against the native map's generic tap listener firing right
  /// after an annotation tap for the same gesture and immediately
  /// dismissing the callout that annotation tap just opened.
  bool _suppressNextMapTap = false;

  NearbyEstablishment? _selected;
  Offset? _selectedScreenPosition;
  Size _mapAreaSize = Size.zero;

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
                : LayoutBuilder(
                    builder: (context, constraints) {
                      _mapAreaSize = constraints.biggest;
                      return Stack(
                        children: [
                          MapWidget(
                            key: ValueKey('nearby-map-$_radiusKm'),
                            styleUri: MapboxStyles.STANDARD,
                            viewport: CameraViewportState(
                              center: _point(widget.center),
                              zoom: _zoomForRadius(_radiusKm),
                            ),
                            onMapCreated: (map) => _onMapCreated(map),
                            onMapLoadErrorListener: (_) =>
                                setState(() => _mapUnavailable = true),
                            onStyleLoadedListener: (_) => _syncAnnotations(),
                            onTapListener: _onMapBackgroundTapped,
                            onMapIdleListener: (_) =>
                                _refreshSelectedPinPosition(),
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
                              onChanged: (value) {
                                setState(() {
                                  _radiusKm = value;
                                  _selected = null;
                                  _selectedScreenPosition = null;
                                });
                                _syncAnnotations();
                              },
                            ),
                          ),
                          if (_selected != null &&
                              _selectedScreenPosition != null)
                            _PinCallout(
                              establishment: _selected!,
                              anchor: _selectedScreenPosition!,
                              areaSize: _mapAreaSize,
                              onClose: () => setState(() {
                                _selected = null;
                                _selectedScreenPosition = null;
                              }),
                              onViewDetails: () =>
                                  _openEstablishment(_selected!.id),
                            ),
                        ],
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  void _onMapCreated(MapboxMap map) {
    // A remount (radius change forces a new MapWidget key) spins up a brand
    // new native map/annotation manager — drop the stale references so the
    // next sync creates a fresh manager and re-registers the tap listener
    // instead of touching a manager tied to a destroyed native view.
    _mapboxMap = map;
    _annotationManager = null;
    _tapListenerRegistered = false;
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
      _annotationManager ??= await map.annotations
          .createCircleAnnotationManager();
      if (!_tapListenerRegistered) {
        _annotationManager!.tapEvents(onTap: _onPinTapped);
        _tapListenerRegistered = true;
      }
      await _annotationManager!.deleteAll();

      await _annotationManager!.create(
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
        await _annotationManager!.createMulti(
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

  Future<void> _onPinTapped(CircleAnnotation annotation) async {
    final id = annotation.customData?['facilityId'];
    final map = _mapboxMap;
    if (id == null || id == widget.facilityId || map == null) return;

    NearbyEstablishment? match;
    for (final e in _visible) {
      if (e.id == id) {
        match = e;
        break;
      }
    }
    if (match == null) return;

    _suppressNextMapTap = true;
    final pixel = await map.pixelForCoordinate(annotation.geometry);
    if (!mounted) return;
    setState(() {
      _selected = match;
      _selectedScreenPosition = Offset(pixel.x, pixel.y);
    });
    Future.delayed(
      const Duration(milliseconds: 300),
      () => _suppressNextMapTap = false,
    );
  }

  void _onMapBackgroundTapped(MapContentGestureContext gestureContext) {
    if (_suppressNextMapTap) {
      _suppressNextMapTap = false;
      return;
    }
    if (_selected != null) {
      setState(() {
        _selected = null;
        _selectedScreenPosition = null;
      });
    }
  }

  Future<void> _refreshSelectedPinPosition() async {
    final selected = _selected;
    final map = _mapboxMap;
    if (selected == null || map == null) return;
    final pixel = await map.pixelForCoordinate(
      Point(coordinates: Position(selected.longitude, selected.latitude)),
    );
    if (!mounted || _selected?.id != selected.id) return;
    setState(() => _selectedScreenPosition = Offset(pixel.x, pixel.y));
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
            Slider(
              value: radiusKm,
              min: 1,
              max: establishmentNearbyDefaultRadiusKm,
              divisions: (establishmentNearbyDefaultRadiusKm - 1).round(),
              label: '${radiusKm.round()} km',
              activeColor: const Color(0xFF1e40af),
              onChanged: onChanged,
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

/// Floating "info window" shown above a tapped pin with basic clinic info.
/// Positioned near [anchor] (the pin's on-screen pixel), clamped to
/// [areaSize] so it never renders off the visible map area.
class _PinCallout extends StatelessWidget {
  const _PinCallout({
    required this.establishment,
    required this.anchor,
    required this.areaSize,
    required this.onClose,
    required this.onViewDetails,
  });

  final NearbyEstablishment establishment;
  final Offset anchor;
  final Size areaSize;
  final VoidCallback onClose;
  final VoidCallback onViewDetails;

  static const double _cardWidth = 224;
  static const double _cardHeight = 128;

  @override
  Widget build(BuildContext context) {
    final maxWidth = areaSize.width > 0 ? areaSize.width : 320.0;
    final maxHeight = areaSize.height > 0 ? areaSize.height : 480.0;
    final left = _clamp(
      anchor.dx - _cardWidth / 2,
      8,
      maxWidth - _cardWidth - 8,
    );
    final top = _clamp(
      anchor.dy - _cardHeight - 4,
      8,
      maxHeight - _cardHeight - 8,
    );

    return Positioned(
      left: left,
      top: top,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: _cardWidth,
            padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
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
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
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
                    ),
                    InkWell(
                      onTap: onClose,
                      borderRadius: BorderRadius.circular(12),
                      child: const Padding(
                        padding: EdgeInsets.all(2),
                        child: Icon(
                          Icons.close_rounded,
                          size: 16,
                          color: Color(0xFF9ca3af),
                        ),
                      ),
                    ),
                  ],
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
                InkWell(
                  onTap: onViewDetails,
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Ver detalhes',
                        style: TextStyle(
                          fontSize: 12.5,
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
                ),
              ],
            ),
          ),
          const Align(
            alignment: Alignment.center,
            child: CustomPaint(
              size: Size(16, 8),
              painter: _CalloutTailPainter(),
            ),
          ),
        ],
      ),
    );
  }

  static double _clamp(double value, double min, double max) =>
      max < min ? min : value.clamp(min, max);
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
