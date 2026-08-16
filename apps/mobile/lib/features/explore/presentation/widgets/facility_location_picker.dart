import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/shared/map/map_projection.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';

/// Full-screen pin placement: tap the map to move it, confirm to keep it.
///
/// Opened from [FacilityLocationCard]. Separate from the card because placing a
/// pin accurately needs the whole screen — the card's job is to show where the
/// clinic currently sits, and a 160pt-tall map is not somewhere anyone can aim.
class FacilityPinPickerScreen extends StatefulWidget {
  const FacilityPinPickerScreen({
    super.key,
    required this.initial,
    required this.title,
  });

  final MapCoordinate? initial;
  final String title;

  static Future<MapCoordinate?> show(
    BuildContext context, {
    MapCoordinate? initial,
    required String title,
  }) {
    return Navigator.of(context).push<MapCoordinate>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => FacilityPinPickerScreen(initial: initial, title: title),
      ),
    );
  }

  @override
  State<FacilityPinPickerScreen> createState() =>
      _FacilityPinPickerScreenState();
}

class _FacilityPinPickerScreenState extends State<FacilityPinPickerScreen> {
  /// Somewhere in Brazil to start from when there is no pin at all, so the map
  /// does not open on the middle of the Atlantic.
  static const _fallback = MapCoordinate(
    longitude: -46.6333,
    latitude: -23.5505,
  );

  MapboxMap? _map;
  late MapCoordinate _pin;
  late bool _placed;
  bool _mapUnavailable = false;

  @override
  void initState() {
    super.initState();
    _pin = widget.initial ?? _fallback;
    _placed = widget.initial != null;
    MapboxOptions.setAccessToken(AppConfig.mapboxAccessToken);
  }

  /// Tapping recentres, and the pin is drawn by Flutter over the middle.
  ///
  /// A `PointAnnotation` was the obvious way and it drew nothing: the icon
  /// names that ship with the older Streets sprite are not in Standard's, so
  /// the annotation existed with no image. Painting the marker ourselves also
  /// removes the guesswork about which sprite a style happens to carry.
  void _onMapTap(MapContentGestureContext context) {
    final position = context.point.coordinates;
    setState(() {
      _pin = MapCoordinate(
        longitude: position.lng.toDouble(),
        latitude: position.lat.toDouble(),
      );
      _placed = true;
    });
    _map?.easeTo(
      CameraOptions(
        center: Point(coordinates: Position(_pin.longitude, _pin.latitude)),
      ),
      MapAnimationOptions(duration: 220),
    );
  }

  MapboxMap? _mapboxMapOrNull() => _map;

  @override
  Widget build(BuildContext context) {
    final token = AppConfig.mapboxAccessToken;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(
          widget.title,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.gray900,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            color: AppColors.blue50,
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
            child: Text(
              _placed
                  ? 'Toque no mapa para mover o pino. O endereço é atualizado '
                        'a partir dele.'
                  : 'Toque no mapa para marcar onde fica a clínica.',
              style: const TextStyle(
                fontSize: 12.5,
                color: AppColors.blueDarker,
                height: 1.35,
              ),
            ),
          ),
          Expanded(
            child: token.isEmpty || _mapUnavailable
                ? const Center(
                    child: Text(
                      'Mapa indisponível.',
                      style: TextStyle(color: AppColors.gray500),
                    ),
                  )
                : Stack(
                    fit: StackFit.expand,
                    children: [
                      MapWidget(
                        key: const ValueKey('facility-pin-picker'),
                        styleUri: MapboxStyles.STANDARD,
                        viewport: CameraViewportState(
                          center: Point(
                            coordinates: Position(
                              _pin.longitude,
                              _pin.latitude,
                            ),
                          ),
                          zoom: widget.initial == null ? 10 : 16,
                        ),
                        onMapCreated: (map) {
                          _map = map;
                          map.scaleBar.updateSettings(
                            ScaleBarSettings(enabled: false),
                          );
                        },
                        onStyleLoadedListener: (_) =>
                            useFlatProjection(_mapboxMapOrNull()),
                        onMapLoadErrorListener: (_) =>
                            setState(() => _mapUnavailable = true),
                        // ignore: deprecated_member_use
                        onTapListener: _onMapTap,
                      ),
                      if (_placed)
                        const IgnorePointer(child: Center(child: _PinMarker())),
                    ],
                  ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: const Text('Cancelar'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      key: const Key('facility-pin-confirm'),
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.navyDeep,
                      ),
                      onPressed: _placed
                          ? () => Navigator.of(context).pop(_pin)
                          : null,
                      child: Text(
                        _placed ? 'Confirmar local' : 'Toque no mapa',
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The location section of the import wizard: a minimap of where the clinic
/// sits, and the two ways to change it.
///
/// This replaced two raw latitude/longitude text boxes. The pin decides which
/// manager zone and rep patch the clinic falls into, and asking someone to type
/// "-23.550520" is asking them to get that wrong.
class FacilityLocationCard extends StatelessWidget {
  const FacilityLocationCard({
    super.key,
    required this.point,
    required this.onPickOnMap,
    required this.onUseAddress,
    this.addressLabel,
    this.geocoding = false,
    this.canUseAddress = true,
    this.note,
  });

  final MapCoordinate? point;
  final VoidCallback onPickOnMap;
  final VoidCallback onUseAddress;

  /// What reverse geocoding said sits here, when the pin was moved by hand.
  final String? addressLabel;
  final bool geocoding;
  final bool canUseAddress;
  final String? note;

  @override
  Widget build(BuildContext context) {
    final placed = point != null;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.surfaceSecondary),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            height: 150,
            width: double.infinity,
            child: placed
                ? _MiniMap(point: point!, onTap: onPickOnMap)
                : _NoPinPlaceholder(onTap: onPickOnMap),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (addressLabel != null && addressLabel!.isNotEmpty) ...[
                  Text(
                    addressLabel!,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray900,
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 6),
                ],
                Text(
                  placed
                      ? '${point!.latitude.toStringAsFixed(6)}, '
                            '${point!.longitude.toStringAsFixed(6)}'
                      : 'Sem localização definida',
                  style: TextStyle(
                    fontSize: 12,
                    color: placed ? AppColors.gray500 : AppColors.amberDark,
                    fontWeight: placed ? FontWeight.w400 : FontWeight.w600,
                  ),
                ),
                if (note != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    note!,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.gray500,
                      height: 1.4,
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        key: const Key('facility-location-use-address'),
                        onPressed: geocoding || !canUseAddress
                            ? null
                            : onUseAddress,
                        icon: geocoding
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.my_location_rounded, size: 16),
                        label: const Text('Usar endereço'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.navyDeep,
                          side: const BorderSide(
                            color: AppColors.surfaceSecondary,
                          ),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        key: const Key('facility-location-pick'),
                        onPressed: onPickOnMap,
                        icon: const Icon(Icons.place_outlined, size: 16),
                        label: Text(placed ? 'Mover pino' : 'Marcar no mapa'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.navyDeep,
                          side: const BorderSide(
                            color: AppColors.surfaceSecondary,
                          ),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MiniMap extends StatefulWidget {
  const _MiniMap({required this.point, required this.onTap});

  final MapCoordinate point;
  final VoidCallback onTap;

  @override
  State<_MiniMap> createState() => _MiniMapState();
}

class _MiniMapState extends State<_MiniMap> {
  MapboxMap? _map;
  bool _unavailable = false;

  @override
  void initState() {
    super.initState();
    MapboxOptions.setAccessToken(AppConfig.mapboxAccessToken);
  }

  @override
  void didUpdateWidget(_MiniMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.point != widget.point) _recentre();
  }

  Future<void> _recentre() async {
    await _map?.setCamera(
      CameraOptions(
        center: Point(
          coordinates: Position(widget.point.longitude, widget.point.latitude),
        ),
        zoom: 15,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (AppConfig.mapboxAccessToken.isEmpty || _unavailable) {
      return _NoPinPlaceholder(onTap: widget.onTap, label: 'Mapa indisponível');
    }

    // The minimap is a picture of the pin, not a map to navigate: every gesture
    // is off, and a tap opens the full-screen picker where aiming is possible.
    return Stack(
      fit: StackFit.expand,
      children: [
        IgnorePointer(
          child: MapWidget(
            key: const ValueKey('facility-location-minimap'),
            styleUri: MapboxStyles.STANDARD,
            viewport: CameraViewportState(
              center: Point(
                coordinates: Position(
                  widget.point.longitude,
                  widget.point.latitude,
                ),
              ),
              zoom: 15,
            ),
            onMapCreated: (map) {
              _map = map;
              map.scaleBar.updateSettings(ScaleBarSettings(enabled: false));
              map.compass.updateSettings(CompassSettings(enabled: false));
            },
            onStyleLoadedListener: (_) => useFlatProjection(_map),
            onMapLoadErrorListener: (_) => setState(() => _unavailable = true),
          ),
        ),
        // The map is always centred on the point, so the marker belongs at the
        // centre — drawn here rather than as an annotation, because Standard's
        // sprite does not carry the icon names the older styles do and the
        // annotation rendered as nothing at all.
        const IgnorePointer(child: Center(child: _PinMarker())),
        Material(
          color: Colors.transparent,
          child: InkWell(onTap: widget.onTap),
        ),
      ],
    );
  }
}

/// The marker itself. Offset upward by half its height so the tip, not the
/// middle of the circle, sits on the coordinate.
class _PinMarker extends StatelessWidget {
  const _PinMarker();

  @override
  Widget build(BuildContext context) {
    return Transform.translate(
      offset: const Offset(0, -14),
      child: const Icon(
        Icons.location_on,
        size: 34,
        color: AppColors.navyBright,
        shadows: [
          Shadow(color: Colors.white, blurRadius: 3),
          Shadow(color: Color(0x40000000), blurRadius: 6, offset: Offset(0, 2)),
        ],
      ),
    );
  }
}

class _NoPinPlaceholder extends StatelessWidget {
  const _NoPinPlaceholder({required this.onTap, this.label});

  final VoidCallback onTap;
  final String? label;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surfaceTertiary,
      child: InkWell(
        onTap: onTap,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.add_location_alt_outlined,
                size: 26,
                color: AppColors.gray400,
              ),
              const SizedBox(height: 6),
              Text(
                label ?? 'Marcar no mapa',
                style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.gray500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
