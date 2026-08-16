import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';

/// Flattens a map to Mercator.
///
/// `MapboxStyles.STANDARD` projects onto a globe, and switches to it as the
/// camera pulls back. Nothing in this app is looked at from orbit, but plenty
/// of it is territory-scale: framing a manager zone that spans ~40° of
/// longitude lands around zoom 2.4, and at that zoom the globe shows the
/// curved edge of the planet with space beside it — which reads as the map
/// having lost its place rather than as the zone being that large.
///
/// Harmless on the street-level maps, where the two projections are
/// indistinguishable; applied everywhere so that two maps in the same app
/// never disagree about the shape of the world.
///
/// Call it from `onStyleLoadedListener` — the projection is a style property,
/// so setting it before the style loads does nothing. Takes the nullable
/// controller each of these screens already holds, so no call site has to
/// unwrap it first.
Future<void> useFlatProjection(MapboxMap? map) async {
  if (map == null) return;
  try {
    await map.style.setProjection(
      StyleProjection(name: StyleProjectionName.mercator),
    );
  } catch (_) {
    // A map that failed to take the projection is still a usable map.
  }
}
