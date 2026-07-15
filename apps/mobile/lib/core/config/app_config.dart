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
}
