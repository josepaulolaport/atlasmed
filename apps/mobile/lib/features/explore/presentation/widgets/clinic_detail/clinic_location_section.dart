import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/filter_data.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_location_map_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_nearby_map_screen.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Inline map preview + horizontal "Clínicas no raio" card strip.
///
/// The map preview (tap or "Expandir") only ever shows *this*
/// establishment's own location, full-screen — the richer radius-slider
/// experience with nearby pins and cards lives behind the dedicated
/// "Ver estabelecimentos próximos" entry point (`ClinicNearbyMapScreen`).
class ClinicLocationSection extends StatefulWidget {
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
  State<ClinicLocationSection> createState() => _ClinicLocationSectionState();
}

class _ClinicLocationSectionState extends State<ClinicLocationSection> {
  /// Bumped after a full-screen Mapbox route pops so the mini preview gets a
  /// fresh platform view. Leaving the mini `MapWidget` mounted under another
  /// Mapbox screen blanks its surface on return (Mapbox Flutter quirk).
  int _miniMapGeneration = 0;

  /// While a full-screen map is open we swap the preview for a placeholder so
  /// only one native Mapbox view is alive at a time.
  bool _fullMapOpen = false;

  @override
  Widget build(BuildContext context) {
    final nearby = filterNearbyByRadius(
      widget.nearbyEstablishments,
      establishmentNearbyPreviewRadiusKm,
    );

    return ClinicDetailCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: 160,
            child: Stack(
              children: [
                _fullMapOpen
                    ? _MapPlaceholder(location: widget.location)
                    : _MiniMapPreview(
                        key: ValueKey('clinic-mini-$_miniMapGeneration'),
                        location: widget.location,
                      ),
                Positioned.fill(
                  child: GestureDetector(
                    onTap: () {
                      if (nearby.isEmpty) {
                        _openLocationMap();
                      } else {
                        _openNearbyMap(focusId: nearby.first.id);
                      }
                    },
                    behavior: HitTestBehavior.opaque,
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
            child: Text(
              'CLÍNICAS NO RAIO DE '
              '${establishmentNearbyPreviewRadiusKm.toStringAsFixed(0)} KM: '
              '${nearby.length}',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.4,
                color: AppColors.gray400,
              ),
            ),
          ),
          if (nearby.isEmpty)
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 4, 16, 16),
              child: Text(
                'Nenhum estabelecimento no raio de busca',
                style: TextStyle(fontSize: 12.5, color: AppColors.gray400),
              ),
            )
          else
            SizedBox(
              height: 132,
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                scrollDirection: Axis.horizontal,
                itemCount: nearby.length,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (_, i) => _NearbyClinicCard(
                  establishment: nearby[i],
                  onViewMore: () => _openNearbyMap(focusId: nearby[i].id),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => _openNearbyMap(),
                icon: const Icon(Icons.map_rounded, size: 18),
                label: const Text('Ver estabelecimentos próximos'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.navyBright,
                  side: const BorderSide(color: AppColors.blue100),
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

  /// "Expandir" and tapping the mini preview both just show this
  /// establishment's own pin, full-screen — no nearby pins, no radius
  /// controls. That richer view is [_openNearbyMap] below.
  Future<void> _openLocationMap() async {
    await _openFullMap(
      ClinicLocationMapScreen(
        facilityName: widget.facilityName,
        location: widget.location,
      ),
    );
  }

  /// Opens the radius-slider nearby-clinics map. When [focusId] is given
  /// (from a card's "Ver mais"), that establishment is centered/zoomed in
  /// on with its callout already open, instead of showing the overview.
  Future<void> _openNearbyMap({String? focusId}) async {
    await _openFullMap(
      ClinicNearbyMapScreen(
        facilityId: widget.facilityId,
        facilityName: widget.facilityName,
        center: widget.location,
        allNearby: widget.nearbyEstablishments,
        initialFocusId: focusId,
      ),
    );
  }

  Future<void> _openFullMap(Widget screen) async {
    setState(() => _fullMapOpen = true);
    // Let the mini MapWidget dispose before the full-screen one mounts.
    await WidgetsBinding.instance.endOfFrame;
    if (!mounted) return;
    await Navigator.of(
      context,
    ).push(MaterialPageRoute<void>(builder: (_) => screen));
    if (!mounted) return;
    setState(() {
      _fullMapOpen = false;
      _miniMapGeneration++;
    });
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
          color: AppColors.blueLight,
          borderRadius: BorderRadius.circular(20),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.open_in_full_rounded,
              size: 12,
              color: AppColors.navyBright,
            ),
            SizedBox(width: 4),
            Text(
              'Expandir',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.navyBright,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Compact card for one nearby establishment, shown in the inline
/// "Clínicas no raio" horizontal strip — same card language as the radius
/// map's own nearby-clinic strip. Tapping it (the "Ver mais" affordance)
/// opens the full radius map centered/zoomed on this clinic with its
/// callout already active and its card highlighted in that screen's strip.
class _NearbyClinicCard extends StatelessWidget {
  const _NearbyClinicCard({
    required this.establishment,
    required this.onViewMore,
  });

  final NearbyEstablishment establishment;
  final VoidCallback onViewMore;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onViewMore,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        width: 168,
        padding: const EdgeInsets.fromLTRB(12, 10, 10, 10),
        decoration: BoxDecoration(
          color: AppColors.surfaceTertiary,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.gray200),
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
              Text(
                establishment.shortAddress!,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 10.5,
                  color: AppColors.gray400,
                ),
              ),
            ],
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

class _MiniMapPreview extends StatefulWidget {
  const _MiniMapPreview({super.key, required this.location});

  final EstablishmentLocation location;

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
      return _MapPlaceholder(location: widget.location);
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
      onMapCreated: (map) {
        _mapboxMap = map;
        map.scaleBar.updateSettings(ScaleBarSettings(enabled: false));
      },
      onMapLoadErrorListener: (_) => setState(() => _unavailable = true),
      onStyleLoadedListener: (_) => _addPin(),
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
          circleRadius: 10,
          circleStrokeColor: Colors.white.toARGB32(),
          circleStrokeWidth: 3,
        ),
      );
    } catch (_) {
      if (mounted) setState(() => _unavailable = true);
    }
  }

  Point _point(EstablishmentLocation loc) =>
      Point(coordinates: Position(loc.longitude, loc.latitude));
}

class _MapPlaceholder extends StatelessWidget {
  const _MapPlaceholder({required this.location});

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
            bottom: 8,
            left: 8,
            right: 8,
            child: Text(
              '${location.latitude.toStringAsFixed(4)}, ${location.longitude.toStringAsFixed(4)}',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 10, color: AppColors.gray500),
            ),
          ),
        ],
      ),
    );
  }
}
