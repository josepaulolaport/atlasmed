import 'dart:io';

import 'package:flutter/foundation.dart';

class ApiConfig {
  /// Override at run time:
  /// flutter run --dart-define=API_BASE_URL=http://192.168.1.x:3000/api/v1
  static String get baseUrl {
    const override = String.fromEnvironment('API_BASE_URL');
    if (override.isNotEmpty) return override;

    if (!kIsWeb && Platform.isAndroid) {
      return 'http://10.0.2.2:3000/api/v1';
    }

    return 'http://127.0.0.1:3000/api/v1';
  }

  static const useMockAuth = bool.fromEnvironment(
    'USE_MOCK_AUTH',
    defaultValue: false,
  );

  static const useMockExplore = bool.fromEnvironment(
    'USE_MOCK_EXPLORE',
    defaultValue: false,
  );
}
