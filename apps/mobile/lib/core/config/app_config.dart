final class AppConfig {
  AppConfig._();

  static String get apiBaseUrl {
    const value = String.fromEnvironment('API_BASE_URL');
    if (value.isEmpty) {
      throw StateError('Missing required dart-define: API_BASE_URL');
    }
    return value;
  }

  /// Public Mapbox access token passed at build/run time, never committed.
  static String get mapboxAccessToken =>
      const String.fromEnvironment('MAPBOX_ACCESS_TOKEN');
}
