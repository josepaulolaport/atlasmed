import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_mock.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';

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
                : Stack(
                    children: [
                      MapWidget(
                        key: ValueKey('nearby-map-$_radiusKm'),
                        styleUri: MapboxStyles.STANDARD,
                        viewport: CameraViewportState(
                          center: _point(widget.center),
                          zoom: _zoomForRadius(_radiusKm),
                        ),
                        onMapCreated: (map) => _mapboxMap = map,
                        onMapLoadErrorListener: (_) =>
                            setState(() => _mapUnavailable = true),
                        onStyleLoadedListener: (_) => _syncAnnotations(),
                      ),
                      Positioned(
                        left: 16,
                        right: 16,
                        bottom: 16,
                        child: _RadiusPanel(
                          radiusKm: _radiusKm,
                          count: _visible.length,
                          establishments: _visible,
                          onEstablishmentTap: _openEstablishment,
                          onChanged: (value) {
                            setState(() => _radiusKm = value);
                            _syncAnnotations();
                          },
                        ),
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
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
  });

  final double radiusKm;
  final int count;
  final List<NearbyEstablishment> establishments;
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
              const SizedBox(height: 4),
              SizedBox(
                height: 36,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: establishments.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (_, i) {
                    final e = establishments[i];
                    return ActionChip(
                      label: Text(
                        '${e.name} · ${e.distanceKm.toStringAsFixed(1)} km',
                        style: const TextStyle(fontSize: 11),
                      ),
                      onPressed: () => onEstablishmentTap(e.id),
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
