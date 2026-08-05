import 'package:atlasmed_mobile_app/core/user/models/user_capabilities.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class UserCapabilitiesRepository extends Repository<UserCapabilities>
    with SessionEnvironmentMixin<UserCapabilities> {
  UserCapabilitiesRepository()
    : super(
        endpoint: Uri.parse('http://localhost/api/v1/user/capabilities'),
        fromJson: (json) =>
            UserCapabilities.fromJson(json as Map<String, dynamic>),
      );

  @override
  String get name => 'user_capabilities';
}
