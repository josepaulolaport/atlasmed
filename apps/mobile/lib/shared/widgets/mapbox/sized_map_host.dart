import 'package:flutter/material.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';

/// Builds a [MapWidget] once parent constraints are a real non-zero size.
typedef SizedMapHostBuilder =
    Widget Function(BuildContext context, double width, double height);

/// Defers mounting Mapbox until layout has width/height ≥ 2.
///
/// Mapbox iOS logs `Invalid size … {64, 64}` when the platform view is created
/// on a 0×0 first frame; waiting for real constraints cuts that race.
class SizedMapHost extends StatelessWidget {
  const SizedMapHost({super.key, required this.builder});

  final SizedMapHostBuilder builder;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final height = constraints.maxHeight;
        if (!width.isFinite || !height.isFinite || width < 2 || height < 2) {
          return const SizedBox.expand();
        }
        return builder(context, width, height);
      },
    );
  }
}

/// Compass/scale off; logo + attribution stay on (Mapbox ToS).
Future<void> applyPreviewMapChrome(MapboxMap map) async {
  await Future.wait([
    map.compass.updateSettings(CompassSettings(enabled: false)),
    map.scaleBar.updateSettings(ScaleBarSettings(enabled: false)),
    map.logo.updateSettings(
      LogoSettings(
        enabled: true,
        position: OrnamentPosition.BOTTOM_LEFT,
        marginLeft: 4,
        marginBottom: 4,
      ),
    ),
    map.attribution.updateSettings(
      AttributionSettings(
        enabled: true,
        position: OrnamentPosition.BOTTOM_RIGHT,
        marginRight: 4,
        marginBottom: 4,
        clickable: false,
      ),
    ),
  ]);
}
