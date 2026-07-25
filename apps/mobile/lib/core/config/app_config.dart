final class AppConfig {
  AppConfig._();

  static String get apiBaseUrl {
    const value = String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'https://api.tdomains.uk',
    );
    if (value.isEmpty) {
      throw StateError('Missing required dart-define: API_BASE_URL');
    }
    return value.replaceFirst(RegExp(r'/+$'), '');
  }

  static String get mapboxAccessToken =>
      const String.fromEnvironment('MAPBOX_ACCESS_TOKEN');

  /// Optional fixed GPS for local/dev (e.g. simulator without a real fix).
  /// Set via `DEBUG_FIXED_LATITUDE` + `DEBUG_FIXED_LONGITUDE` dart-defines.
  static ({double latitude, double longitude})? get debugFixedLocation {
    const latRaw = String.fromEnvironment('DEBUG_FIXED_LATITUDE');
    const lngRaw = String.fromEnvironment('DEBUG_FIXED_LONGITUDE');
    if (latRaw.isEmpty || lngRaw.isEmpty) return null;
    final latitude = double.tryParse(latRaw);
    final longitude = double.tryParse(lngRaw);
    if (latitude == null || longitude == null) return null;
    return (latitude: latitude, longitude: longitude);
  }

  static bool get hasDebugFixedLocation => debugFixedLocation != null;
}
