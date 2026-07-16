import 'package:atlasmed_mobile_app/features/map/data/models/map_data.dart';
import 'package:flutter/material.dart';

/// Web/stub implementation of the territory map widget.
///
/// This file is loaded conditionally via [territory_map_widget.dart]
/// when `dart.library.io` is not available (i.e. Flutter Web).
/// Mapbox only supports Android and iOS, so we show a placeholder.
class TerritoryMapWidget extends StatelessWidget {
  final MapData data;
  final String accessToken;

  const TerritoryMapWidget({
    super.key,
    required this.data,
    required this.accessToken,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.map_outlined,
              size: 42,
              color: Color(0xFF6B7280),
            ),
            const SizedBox(height: 16),
            const Text(
              'Mapa indisponível no web',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              'O mapa interativo está disponível apenas nos aplicativos '
              'Android e iOS. ${data.facilities.length} clínicas no território.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
            ),
          ],
        ),
      ),
    );
  }
}
