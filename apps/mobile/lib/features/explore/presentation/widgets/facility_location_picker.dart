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
  PointAnnotationManager? _pins;
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

  Future<void> _drawPin() async {
    final pins = _pins;
    if (pins == null) return;
    await pins.deleteAll();
    if (!_placed) return;
    await pins.create(
      PointAnnotationOptions(
        geometry: Point(coordinates: Position(_pin.longitude, _pin.latitude)),
        iconImage: 'marker-15',
        iconSize: 2.2,
        iconColor: AppColors.navyBright.toARGB32(),
      ),
    );
  }

  void _onMapTap(MapContentGestureContext context) {
    final position = context.point.coordinates;
    setState(() {
      _pin = MapCoordinate(
        longitude: position.lng.toDouble(),
        latitude: position.lat.toDouble(),
      );
      _placed = true;
    });
    _drawPin();
  }

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
                : MapWidget(
                    key: const ValueKey('facility-pin-picker'),
                    styleUri: MapboxStyles.STANDARD,
                    viewport: CameraViewportState(
                      center: Point(
                        coordinates: Position(_pin.longitude, _pin.latitude),
                      ),
                      zoom: widget.initial == null ? 10 : 16,
                    ),
                    onMapCreated: (map) {
                      _map = map;
                      map.scaleBar.updateSettings(
                        ScaleBarSettings(enabled: false),
                      );
                    },
                    onStyleLoadedListener: (_) async {
                      await useFlatProjection(_map);
                      final map = _map;
                      if (map == null) return;
                      _pins = await map.annotations
                          .createPointAnnotationManager();
                      await _drawPin();
                    },
                    onMapLoadErrorListener: (_) =>
                        setState(() => _mapUnavailable = true),
                    // ignore: deprecated_member_use
                    onTapListener: _onMapTap,
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
  PointAnnotationManager? _pins;
  bool _unavailable = false;

  @override
  void initState() {
    super.initState();
    MapboxOptions.setAccessToken(AppConfig.mapboxAccessToken);
  }

  @override
  void didUpdateWidget(_MiniMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.point != widget.point) {
      _recentre();
      _draw();
    }
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

  Future<void> _draw() async {
    final pins = _pins;
    if (pins == null) return;
    await pins.deleteAll();
    await pins.create(
      PointAnnotationOptions(
        geometry: Point(
          coordinates: Position(widget.point.longitude, widget.point.latitude),
        ),
        iconImage: 'marker-15',
        iconSize: 2,
        iconColor: AppColors.navyBright.toARGB32(),
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
            onStyleLoadedListener: (_) async {
              await useFlatProjection(_map);
              final map = _map;
              if (map == null) return;
              _pins = await map.annotations.createPointAnnotationManager();
              await _draw();
            },
            onMapLoadErrorListener: (_) => setState(() => _unavailable = true),
          ),
        ),
        Material(
          color: Colors.transparent,
          child: InkWell(onTap: widget.onTap),
        ),
      ],
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
