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

  /// Whether the roteiro do dia is offered at all.
  ///
  /// The agenda and the capture loop stand on their own: nothing in
  /// `features/agenda`, `features/capture` or `features/dashboard` imports
  /// `features/roteiro`, and on the server nothing in `calendar` or
  /// `interactions` imports the roteiro module. The dependency runs one way, so
  /// the planning half can be withheld without touching the half that records
  /// what actually happened.
  ///
  /// Off by default, and left off for the first beta on purpose. It keeps the
  /// pilot's question to one thing — *will a rep keep a diary and press the
  /// buttons?* — with no Mapbox Matrix spend and no "did they like the
  /// suggestions?" confound. Turning it on is this flag, not another merge.
  static bool get roteiroEnabled =>
      const bool.fromEnvironment('ROTEIRO_ENABLED');

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
