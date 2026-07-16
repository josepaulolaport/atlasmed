// Conditional export for the territory map widget.
//
// Uses Flutter's conditional imports to load the Mapbox-backed
// implementation on mobile (Android/iOS) and a safe stub on web.
//
// `dart.library.io` is available on Dart VM platforms (mobile, desktop)
// but NOT on Flutter Web, making it the correct guard for native plugins.
export 'territory_map_stub.dart'
    if (dart.library.io) 'territory_map_mobile.dart';
