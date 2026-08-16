import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';
import 'package:atlasmed_mobile_app/shared/map/map_projection.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Full-screen, single-pin map of just this establishment's own location —
/// what "Expandir" on the inline preview opens. Deliberately has no nearby
/// pins, radius slider or card strip; that richer experience lives behind
/// the dedicated "Ver estabelecimentos próximos" entry point instead
/// (`ClinicNearbyMapScreen`).
class ClinicLocationMapScreen extends StatefulWidget {
  const ClinicLocationMapScreen({
    super.key,
    required this.facilityName,
    required this.location,
  });

  final String facilityName;
  final EstablishmentLocation location;

  @override
  State<ClinicLocationMapScreen> createState() =>
      _ClinicLocationMapScreenState();
}

class _ClinicLocationMapScreenState extends State<ClinicLocationMapScreen> {
  MapboxMap? _mapboxMap;
  bool _mapUnavailable = false;

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
                      Text(
                        widget.facilityName,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: AppColors.gray900,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (widget.location.formattedAddress != null)
                        Text(
                          widget.location.formattedAddress!,
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
          Expanded(
            child: _mapUnavailable || AppConfig.mapboxAccessToken.isEmpty
                ? _LocationMapPlaceholder(location: widget.location)
                : MapWidget(
                    key: const ValueKey('clinic-location-map'),
                    styleUri: MapboxStyles.STANDARD,
                    viewport: CameraViewportState(
                      center: _point(widget.location),
                      zoom: 15,
                    ),
                    onMapCreated: (map) {
                      _mapboxMap = map;
                      map.scaleBar.updateSettings(
                        ScaleBarSettings(enabled: false),
                      );
                    },
                    onMapLoadErrorListener: (_) =>
                        setState(() => _mapUnavailable = true),
                    onStyleLoadedListener: (_) async {
                      await useFlatProjection(_mapboxMap);
                      await _addPin();
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Future<void> _addPin() async {
    final map = _mapboxMap;
    if (map == null || !mounted) return;
    try {
      final manager = await map.annotations.createCircleAnnotationManager();
      await manager.create(
        CircleAnnotationOptions(
          geometry: _point(widget.location),
          circleColor: AppColors.navyBright.toARGB32(),
          circleRadius: 11,
          circleStrokeColor: Colors.white.toARGB32(),
          circleStrokeWidth: 3,
        ),
      );
    } catch (_) {
      if (mounted) setState(() => _mapUnavailable = true);
    }
  }

  Point _point(EstablishmentLocation loc) =>
      Point(coordinates: Position(loc.longitude, loc.latitude));
}

class _LocationMapPlaceholder extends StatelessWidget {
  const _LocationMapPlaceholder({required this.location});

  final EstablishmentLocation location;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.surfaceSecondary,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Icon(
            Icons.map_outlined,
            size: 64,
            color: AppColors.navyBright.withValues(alpha: 0.15),
          ),
          const Icon(
            Icons.location_on_rounded,
            size: 36,
            color: AppColors.navyBright,
          ),
          Positioned(
            bottom: 24,
            left: 16,
            right: 16,
            child: Text(
              '${location.latitude.toStringAsFixed(4)}, ${location.longitude.toStringAsFixed(4)}',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12, color: AppColors.gray500),
            ),
          ),
        ],
      ),
    );
  }
}
