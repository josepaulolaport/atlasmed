import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_mock.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/filter_data.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_nearby_map_screen.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';

/// Inline map preview + scrollable "Clínicas no raio" list. Tapping the map
/// (or the expand affordance) pushes the full-screen radius-slider map.
class ClinicLocationSection extends StatelessWidget {
  const ClinicLocationSection({
    super.key,
    required this.facilityId,
    required this.facilityName,
    required this.location,
    required this.nearbyEstablishments,
  });

  final String facilityId;
  final String facilityName;
  final EstablishmentLocation location;
  final List<NearbyEstablishment> nearbyEstablishments;

  @override
  Widget build(BuildContext context) {
    final nearby = filterNearbyByRadius(
      nearbyEstablishments,
      establishmentNearbyPreviewRadiusKm,
    );

    return ClinicDetailCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${nearby.length} dentro de ${establishmentNearbyPreviewRadiusKm.toStringAsFixed(1)} km',
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF6b7280),
                  ),
                ),
                _ExpandButton(onTap: () => _openFullScreen(context)),
              ],
            ),
          ),
          GestureDetector(
            onTap: () => _openFullScreen(context),
            child: ClipRRect(
              borderRadius: BorderRadius.zero,
              child: SizedBox(
                height: 160,
                child: _MiniMapPreview(location: location, nearby: nearby),
              ),
            ),
          ),
          if (location.formattedAddress != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
              child: Text(
                location.formattedAddress!,
                style: const TextStyle(fontSize: 13, color: Color(0xFF4b5563)),
              ),
            ),
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 14, 16, 4),
            child: Text(
              'CLÍNICAS NO RAIO',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.4,
                color: Color(0xFF9ca3af),
              ),
            ),
          ),
          if (nearby.isEmpty)
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 4, 16, 16),
              child: Text(
                'Nenhum estabelecimento no raio de busca',
                style: TextStyle(fontSize: 12.5, color: Color(0xFF9ca3af)),
              ),
            )
          else
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 220),
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
                shrinkWrap: true,
                itemCount: nearby.length,
                separatorBuilder: (_, _) =>
                    const Divider(height: 1, color: Color(0xFFf3f4f6)),
                itemBuilder: (_, i) => _NearbyRow(establishment: nearby[i]),
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => _openFullScreen(context),
                icon: const Icon(Icons.map_rounded, size: 18),
                label: const Text('Ver estabelecimentos próximos'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF1e40af),
                  side: const BorderSide(color: Color(0xFFdbeafe)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _openFullScreen(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ClinicNearbyMapScreen(
          facilityId: facilityId,
          facilityName: facilityName,
          center: location,
          allNearby: nearbyEstablishments,
        ),
      ),
    );
  }
}

class _ExpandButton extends StatelessWidget {
  const _ExpandButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0xFFeef4ff),
          borderRadius: BorderRadius.circular(20),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.open_in_full_rounded,
              size: 12,
              color: Color(0xFF1e40af),
            ),
            SizedBox(width: 4),
            Text(
              'Expandir',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1e40af),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NearbyRow extends StatelessWidget {
  const _NearbyRow({required this.establishment});

  final NearbyEstablishment establishment;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      dense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 8),
      leading: Container(
        width: 10,
        height: 10,
        margin: const EdgeInsets.only(top: 4),
        decoration: BoxDecoration(
          color: establishment.status.color,
          shape: BoxShape.circle,
        ),
      ),
      title: Text(
        establishment.name,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w500,
          color: Color(0xFF0f1729),
        ),
      ),
      subtitle: establishment.specialtyLabel != null
          ? Text(
              '${establishment.specialtyLabel} · ${establishment.status.label}',
              style: const TextStyle(fontSize: 11.5, color: Color(0xFF6b7280)),
            )
          : null,
      trailing: Text(
        '${establishment.distanceKm.toStringAsFixed(1)} km',
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: Color(0xFF4b5563),
        ),
      ),
      onTap: () => context.push('/workspace/clinic/${establishment.id}'),
    );
  }
}

class _MiniMapPreview extends StatefulWidget {
  const _MiniMapPreview({required this.location, required this.nearby});

  final EstablishmentLocation location;
  final List<NearbyEstablishment> nearby;

  @override
  State<_MiniMapPreview> createState() => _MiniMapPreviewState();
}

class _MiniMapPreviewState extends State<_MiniMapPreview> {
  bool _unavailable = false;
  MapboxMap? _mapboxMap;

  @override
  Widget build(BuildContext context) {
    final token = AppConfig.mapboxAccessToken;
    if (token.isEmpty || _unavailable) {
      return _MapPlaceholder(location: widget.location, nearby: widget.nearby);
    }

    MapboxOptions.setAccessToken(token);
    return MapWidget(
      key: ValueKey(
        'clinic-mini-${widget.location.latitude}-${widget.location.longitude}',
      ),
      styleUri: MapboxStyles.STANDARD,
      viewport: CameraViewportState(
        center: _point(widget.location),
        zoom: 13.5,
      ),
      onMapCreated: (map) => _mapboxMap = map,
      onMapLoadErrorListener: (_) => setState(() => _unavailable = true),
      onStyleLoadedListener: (_) => _addPins(),
    );
  }

  Future<void> _addPins() async {
    final map = _mapboxMap;
    if (map == null || !mounted) return;

    try {
      final manager = await map.annotations.createCircleAnnotationManager();
      await manager.create(
        CircleAnnotationOptions(
          geometry: _point(widget.location),
          circleColor: const Color(0xFF1e40af).toARGB32(),
          circleRadius: 10,
          circleStrokeColor: Colors.white.toARGB32(),
          circleStrokeWidth: 3,
          circleSortKey: 2,
        ),
      );
      if (widget.nearby.isNotEmpty) {
        await manager.createMulti(
          widget.nearby
              .map(
                (e) => CircleAnnotationOptions(
                  geometry: Point(
                    coordinates: Position(e.longitude, e.latitude),
                  ),
                  circleColor: e.status.color.toARGB32(),
                  circleRadius: 7,
                  circleStrokeColor: Colors.white.toARGB32(),
                  circleStrokeWidth: 2,
                  circleSortKey: 1,
                ),
              )
              .toList(),
        );
      }
    } catch (_) {
      if (mounted) setState(() => _unavailable = true);
    }
  }

  Point _point(EstablishmentLocation loc) =>
      Point(coordinates: Position(loc.longitude, loc.latitude));
}

class _MapPlaceholder extends StatelessWidget {
  const _MapPlaceholder({required this.location, required this.nearby});

  final EstablishmentLocation location;
  final List<NearbyEstablishment> nearby;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFe8eef5),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Icon(
            Icons.map_outlined,
            size: 64,
            color: const Color(0xFF1e40af).withValues(alpha: 0.15),
          ),
          const Icon(
            Icons.location_on_rounded,
            size: 36,
            color: Color(0xFF1e40af),
          ),
          Positioned(
            bottom: 8,
            left: 8,
            right: 8,
            child: Text(
              '${location.latitude.toStringAsFixed(4)}, ${location.longitude.toStringAsFixed(4)}',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 10, color: Color(0xFF6b7280)),
            ),
          ),
        ],
      ),
    );
  }
}
