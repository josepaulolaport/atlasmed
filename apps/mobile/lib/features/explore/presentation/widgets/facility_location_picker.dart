import 'dart:async';

import 'package:atlasmed_mobile_app/features/explore/data/repositories/cnes_facility_candidates_repository.dart';
import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/shared/map/map_projection.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';

/// A confirmed pin, and the address that sits at it.
class PickedLocation {
  const PickedLocation({required this.point, required this.address});

  final MapCoordinate point;
  final ReverseGeocodedAddress address;
}

/// Full-screen pin placement: move the map under the pin, confirm to keep it.
///
/// Opened from [FacilityLocationCard]. Separate from the card because placing a
/// pin accurately needs the whole screen — the card's job is to show where the
/// clinic currently sits, and a 160pt-tall map is not somewhere anyone can aim.
///
/// The pin has to land on an address. A clinic's point decides which manager
/// zone and rep patch it falls into, and a coordinate in the middle of the
/// Atlantic satisfies that question with an answer nobody can act on — so the
/// screen resolves whatever is under the pin as the map settles and will not
/// confirm a place it cannot name.
class FacilityPinPickerScreen extends StatefulWidget {
  const FacilityPinPickerScreen({
    super.key,
    required this.initial,
    required this.title,
    required this.resolve,
  });

  final MapCoordinate? initial;
  final String title;

  /// Describes what sits at a point, or returns null when nothing does.
  final Future<ReverseGeocodedAddress?> Function(double lat, double lng)
  resolve;

  static Future<PickedLocation?> show(
    BuildContext context, {
    MapCoordinate? initial,
    required String title,
    required Future<ReverseGeocodedAddress?> Function(double lat, double lng)
    resolve,
  }) {
    return Navigator.of(context).push<PickedLocation>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => FacilityPinPickerScreen(
          initial: initial,
          title: title,
          resolve: resolve,
        ),
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

  /// Where the map is centred, which is where the marker is drawn.
  late MapCoordinate _pin;

  /// The same value, but only updated for the readout — [_pin] changes on
  /// every frame of a drag and rebuilding that fast is wasted work.
  late MapCoordinate _readout;

  late bool _placed;
  bool _mapUnavailable = false;

  /// What sits under the pin, once the map has settled.
  ReverseGeocodedAddress? _address;
  bool _resolving = false;

  /// The lookup came back with nothing — open water, or somewhere the provider
  /// has no address for.
  bool _nowhere = false;

  Timer? _settle;

  /// Guards against a slow lookup for an old position landing after a newer
  /// one, which would let a stale address unlock the button.
  int _resolveToken = 0;

  @override
  void initState() {
    super.initState();
    _pin = widget.initial ?? _fallback;
    _readout = _pin;
    _placed = widget.initial != null;
    MapboxOptions.setAccessToken(AppConfig.mapboxAccessToken);
    if (widget.initial != null) _scheduleResolve();
  }

  @override
  void dispose() {
    _settle?.cancel();
    super.dispose();
  }

  /// Waits for the map to stop before asking. Resolving mid-drag would be one
  /// request per frame and every answer but the last one is thrown away.
  void _scheduleResolve() {
    _settle?.cancel();
    setState(() {
      _address = null;
      _nowhere = false;
      _resolving = true;
    });
    _settle = Timer(const Duration(milliseconds: 450), _resolveNow);
  }

  Future<void> _resolveNow() async {
    final token = ++_resolveToken;
    final at = _pin;
    try {
      final found = await widget.resolve(at.latitude, at.longitude);
      if (!mounted || token != _resolveToken) return;
      setState(() {
        _resolving = false;
        if (found == null || found.isEmpty) {
          _address = null;
          _nowhere = true;
        } else {
          _address = found;
          _nowhere = false;
        }
      });
    } catch (_) {
      if (!mounted || token != _resolveToken) return;
      // A failed lookup is not the same as open water: say it could not be
      // checked rather than claiming there is nothing there.
      setState(() {
        _resolving = false;
        _address = null;
        _nowhere = false;
      });
    }
  }

  bool get _canConfirm => _placed && _address != null;

  String get _confirmLabel {
    if (!_placed) return 'Posicione o pino';
    if (_resolving) return 'Verificando…';
    if (_nowhere) return 'Sem endereço aqui';
    if (_address == null) return 'Tente de novo';
    return 'Confirmar local';
  }

  /// The marker is painted over the middle of the map, so the middle of the
  /// map is the pin. Nothing else can be, or the two disagree.
  ///
  /// They did disagree: the marker sat at the widget's centre while the
  /// coordinate only moved on a tap, so dragging the map slid the marker over
  /// a new spot and confirmed the old one. The address then did not change,
  /// because as far as the code was concerned the pin had not moved.
  void _onCameraChanged(CameraChangedEventData event) {
    final centre = event.cameraState.center.coordinates;
    final moved = MapCoordinate(
      longitude: centre.lng.toDouble(),
      latitude: centre.lat.toDouble(),
    );
    if (moved == _pin) return;
    // No setState for the coordinate itself — this fires per frame while the
    // map moves, and only the readout below the map shows it.
    _pin = moved;
    if (_readout != _pin) setState(() => _readout = _pin);
    if (_placed) _scheduleResolve();
  }

  /// A gesture, rather than the camera settling after we moved it ourselves.
  void _onUserGesture() {
    if (_placed) return;
    setState(() => _placed = true);
    _scheduleResolve();
  }

  void _onMapTap(MapContentGestureContext context) {
    final position = context.point.coordinates;
    _onUserGesture();
    // Centres what was tapped; the camera listener takes the coordinate from
    // there, so tapping and dragging end in the same place.
    _map?.easeTo(
      CameraOptions(
        center: Point(coordinates: Position(position.lng, position.lat)),
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
            color: _nowhere ? AppColors.amber50 : AppColors.blue50,
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
            child: _PinStatus(
              placed: _placed,
              resolving: _resolving,
              nowhere: _nowhere,
              address: _address,
              point: _readout,
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
                        onCameraChangeListener: _onCameraChanged,
                        // Panning counts as placing the pin — with a centre
                        // marker, dragging the map under it is the gesture.
                        onScrollListener: (_) => _onUserGesture(),
                        // ignore: deprecated_member_use
                        onTapListener: _onMapTap,
                      ),
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
                      onPressed: _canConfirm
                          ? () => Navigator.of(context).pop(
                              PickedLocation(point: _pin, address: _address!),
                            )
                          : null,
                      child: Text(_confirmLabel),
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

/// What is under the pin right now: the address if there is one, the reason
/// there is not, or the coordinate while it is being checked.
class _PinStatus extends StatelessWidget {
  const _PinStatus({
    required this.placed,
    required this.resolving,
    required this.nowhere,
    required this.address,
    required this.point,
  });

  final bool placed;
  final bool resolving;
  final bool nowhere;
  final ReverseGeocodedAddress? address;
  final MapCoordinate point;

  @override
  Widget build(BuildContext context) {
    final coordinates = Text(
      '${point.latitude.toStringAsFixed(6)}, '
      '${point.longitude.toStringAsFixed(6)}',
      style: const TextStyle(
        fontSize: 11.5,
        color: AppColors.gray600,
        fontFeatures: [FontFeature.tabularFigures()],
      ),
    );

    if (!placed) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Arraste o mapa até a clínica ficar sob o pino, ou toque onde '
            'ela fica.',
            style: TextStyle(
              fontSize: 12.5,
              color: AppColors.blueDarker,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 4),
          coordinates,
        ],
      );
    }

    if (resolving) {
      return Row(
        children: [
          const SizedBox(
            width: 13,
            height: 13,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Verificando o endereço deste ponto…',
                  style: TextStyle(fontSize: 12.5, color: AppColors.blueDarker),
                ),
                const SizedBox(height: 2),
                coordinates,
              ],
            ),
          ),
        ],
      );
    }

    if (nowhere) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Não há endereço neste ponto.',
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              color: AppColors.amberDark,
            ),
          ),
          const SizedBox(height: 2),
          const Text(
            'Mova o pino para uma rua. O ponto define o território da '
            'clínica, e um lugar sem endereço não pertence a nenhum.',
            style: TextStyle(
              fontSize: 12,
              color: AppColors.gray700,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 4),
          coordinates,
        ],
      );
    }

    final resolved = address;
    if (resolved == null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Não foi possível verificar este ponto agora.',
            style: TextStyle(fontSize: 12.5, color: AppColors.gray700),
          ),
          const SizedBox(height: 4),
          coordinates,
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          resolved.fullAddress ?? 'Endereço encontrado',
          style: const TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: AppColors.blueDarker,
            height: 1.35,
          ),
        ),
        const SizedBox(height: 4),
        coordinates,
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
