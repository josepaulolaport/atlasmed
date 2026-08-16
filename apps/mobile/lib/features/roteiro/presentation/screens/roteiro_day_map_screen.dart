import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/features/roteiro/data/roteiro.dart';
import 'package:atlasmed_mobile_app/features/roteiro/presentation/utils/roteiro_stop_pin.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart' hide Size;

/// One place on the day's map.
class _Marker {
  const _Marker({
    required this.order,
    required this.time,
    required this.lat,
    required this.lng,
    required this.booked,
    required this.name,
  });

  final int order;
  final String time;
  final double lat;
  final double lng;
  final bool booked;
  final String name;
}

String _hhmm(DateTime at) =>
    '${at.hour.toString().padLeft(2, '0')}:${at.minute.toString().padLeft(2, '0')}';

/// The day's in-person stops on a map, in visiting order.
///
/// Only in-person. A phone call has no place to drive to, and pinning one would
/// claim a destination the rep does not have — they are listed beside the map
/// instead, so the day is still complete without being misdrawn (§15.4.3).
class RoteiroDayMapScreen extends StatefulWidget {
  const RoteiroDayMapScreen({super.key, required this.roteiro});

  final Roteiro roteiro;

  @override
  State<RoteiroDayMapScreen> createState() => _RoteiroDayMapScreenState();
}

class _RoteiroDayMapScreenState extends State<RoteiroDayMapScreen> {
  bool _drawn = false;

  @override
  void initState() {
    super.initState();
    final token = AppConfig.mapboxAccessToken;
    if (token.isNotEmpty) {
      MapboxOptions.setAccessToken(token);
    }
  }

  /// Booked visits and suggestions on one timeline, numbered as the rep will
  /// actually do them — the order is the day's, not the roteiro's.
  List<_Marker> get _markers {
    final all = <_Marker>[
      for (final f in widget.roteiro.fixedPoints)
        if (f.lat != null && f.lng != null)
          _Marker(
            order: 0,
            time: _hhmm(f.startsAt),
            lat: f.lat!,
            lng: f.lng!,
            booked: true,
            name: f.facilityName,
          ),
      for (final s in widget.roteiro.stops)
        if (s.modality == RoteiroModality.inPerson &&
            s.lat != null &&
            s.lng != null)
          _Marker(
            order: 0,
            time: _hhmm(s.plannedStartsAt),
            lat: s.lat!,
            lng: s.lng!,
            booked: false,
            name: s.facilityName,
          ),
    ];
    all.sort((a, b) => a.time.compareTo(b.time));
    return [
      for (var i = 0; i < all.length; i += 1)
        _Marker(
          order: i + 1,
          time: all[i].time,
          lat: all[i].lat,
          lng: all[i].lng,
          booked: all[i].booked,
          name: all[i].name,
        ),
    ];
  }

  Future<void> _draw(MapboxMap map) async {
    if (_drawn) return;
    _drawn = true;
    final dpr = MediaQuery.of(context).devicePixelRatio;
    final manager = await map.annotations.createPointAnnotationManager();

    final markers = _markers;
    if (markers.isEmpty) return;

    for (final marker in markers) {
      final bytes = await RoteiroStopPin.png(
        order: marker.order,
        time: marker.time,
        devicePixelRatio: dpr,
        booked: marker.booked,
      );
      await manager.create(
        PointAnnotationOptions(
          geometry: Point(coordinates: Position(marker.lng, marker.lat)),
          image: bytes,
          iconAnchor: IconAnchor.BOTTOM,
          // Later stops draw above earlier ones where pins overlap, so the
          // order still reads top-to-bottom in a dense cluster.
          symbolSortKey: marker.order.toDouble(),
        ),
      );
    }

    await _fit(map, markers);
  }

  Future<void> _fit(MapboxMap map, List<_Marker> markers) async {
    var minLat = markers.first.lat, maxLat = markers.first.lat;
    var minLng = markers.first.lng, maxLng = markers.first.lng;
    for (final m in markers) {
      minLat = m.lat < minLat ? m.lat : minLat;
      maxLat = m.lat > maxLat ? m.lat : maxLat;
      minLng = m.lng < minLng ? m.lng : minLng;
      maxLng = m.lng > maxLng ? m.lng : maxLng;
    }
    await map.setCamera(
      CameraOptions(
        center: Point(
          coordinates: Position((minLng + maxLng) / 2, (minLat + maxLat) / 2),
        ),
        // A fixed zoom rather than a fitted bounds: a single-stop day would
        // otherwise zoom to street level and lose all context.
        zoom: markers.length == 1 ? 13.5 : 11.5,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final remote = widget.roteiro.stops
        .where((s) => s.modality == RoteiroModality.remote)
        .toList();
    final hasToken = AppConfig.mapboxAccessToken.isNotEmpty;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.cardBg,
        elevation: 0,
        title: const Text(
          'Dia no mapa',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: AppColors.gray900,
          ),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: hasToken
                ? MapWidget(
                    styleUri: MapboxStyles.STANDARD,
                    onMapCreated: _draw,
                  )
                : const _NoMap(),
          ),
          if (remote.isNotEmpty) _RemoteStrip(stops: remote),
        ],
      ),
    );
  }
}

class _NoMap extends StatelessWidget {
  const _NoMap();

  @override
  Widget build(BuildContext context) => const Center(
    child: Padding(
      padding: EdgeInsets.all(24),
      child: Text(
        'Mapa indisponível — o app está sem chave do Mapbox.',
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: 13, color: AppColors.gray600),
      ),
    ),
  );
}

/// Calls, beside the map rather than on it.
class _RemoteStrip extends StatelessWidget {
  const _RemoteStrip({required this.stops});

  final List<RoteiroStop> stops;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: AppColors.cardBg,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Por telefone',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AppColors.gray500,
            ),
          ),
          const SizedBox(height: 6),
          for (final stop in stops)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(
                children: [
                  const Icon(
                    Icons.phone_outlined,
                    size: 14,
                    color: AppColors.gray500,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _hhmm(stop.plannedStartsAt),
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray700,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      stop.facilityName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.gray700,
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
}
