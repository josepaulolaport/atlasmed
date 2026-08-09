import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_bucket.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_location_map_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_nearby_map_screen.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';
import 'package:atlasmed_mobile_app/shared/widgets/atlas_button.dart';
import 'package:atlasmed_mobile_app/shared/widgets/mapbox/sized_map_host.dart';
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
    this.clinicVerticalIds = const {},
  });

  final int facilityId;
  final String facilityName;
  final EstablishmentLocation location;
  final List<NearbyEstablishment> nearbyEstablishments;

  /// Vertical ids on the current clinic (for nearby map filter + badges).
  final Set<int> clinicVerticalIds;

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
                // Absorb Mapbox gestures; tap opens this clinic's location map.
                Positioned.fill(
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: _openLocationMap,
                      child: const SizedBox.expand(),
                    ),
                  ),
                ),
                Positioned(
                  top: 8,
                  right: 8,
                  child: Material(
                    color: Colors.white.withValues(alpha: 0.92),
                    shape: const CircleBorder(),
                    elevation: 1,
                    shadowColor: Colors.black26,
                    child: InkWell(
                      customBorder: const CircleBorder(),
                      onTap: _openLocationMap,
                      child: const Padding(
                        padding: EdgeInsets.all(8),
                        child: Icon(
                          Icons.open_in_full_rounded,
                          size: 18,
                          color: AppColors.gray800,
                        ),
                      ),
                    ),
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
              height: 152,
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
            child: AtlasButton.outline(
              width: double.infinity,
              onPressed: () => _openNearbyMap(),
              icon: const Icon(Icons.map_rounded, size: 18),
              label: const Text('Ver estabelecimentos próximos'),
            ),
          ),
        ],
      ),
    );
  }

  /// Minimap tap + expand control → this clinic only, full-screen.
  /// Nearby pins / radius live behind [_openNearbyMap].
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
  Future<void> _openNearbyMap({int? focusId}) async {
    await _openFullMap(
      ClinicNearbyMapScreen(
        facilityId: widget.facilityId,
        facilityName: widget.facilityName,
        center: widget.location,
        allNearby: widget.nearbyEstablishments,
        clinicVerticalIds: widget.clinicVerticalIds,
        initialFocusId: focusId,
      ),
    );
  }

  Future<void> _openFullMap(Widget screen) async {
    // Real screen push (Material slide). Keep the live mini map until the
    // route animation finishes covering it — disposing earlier flashed the
    // gray [_MapPlaceholder] under the transition.
    final route = MaterialPageRoute<void>(builder: (_) => screen);
    final navFuture = Navigator.of(context).push<void>(route);

    void disposeMiniWhenCovered() {
      if (!mounted || _fullMapOpen) return;
      setState(() => _fullMapOpen = true);
    }

    void onStatus(AnimationStatus status) {
      if (status != AnimationStatus.completed) return;
      route.animation?.removeStatusListener(onStatus);
      disposeMiniWhenCovered();
    }

    // Animation is attached after the route is installed — wait a frame.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final animation = route.animation;
      if (animation == null || animation.isCompleted) {
        disposeMiniWhenCovered();
        return;
      }
      animation.addStatusListener(onStatus);
    });

    await navFuture;
    if (!mounted) return;
    setState(() {
      _fullMapOpen = false;
      _miniMapGeneration++;
    });
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
              Text(
                establishment.shortAddress!,
                maxLines: 1,
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
    return SizedMapHost(
      builder: (context, width, height) => MapWidget(
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
          applyPreviewMapChrome(map);
        },
        onMapLoadErrorListener: (_) => setState(() => _unavailable = true),
        onStyleLoadedListener: (_) => _addPin(),
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
