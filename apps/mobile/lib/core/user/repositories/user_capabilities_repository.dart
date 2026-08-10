import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_capabilities.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class UserCapabilitiesRepository extends Repository<UserCapabilities>
    with SessionEnvironmentMixin<UserCapabilities> {
  UserCapabilitiesRepository()
    : super(
        endpoint: Uri.parse('${AppConfig.apiBaseUrl}/api/v1/user/capabilities'),
        fromJson: (json) => .fromJson(jsonDecode(json)),
      );

  @override
  String get name => 'UserCapabilitiesRepository';
}
