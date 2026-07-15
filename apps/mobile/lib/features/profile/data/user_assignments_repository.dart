import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/repositories/mixins/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/profile/data/user_assignments.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class UserAssignmentsRepository extends Repository<UserAssignments>
    with SessionEnvironmentMixin<UserAssignments> {
  UserAssignmentsRepository({String? baseUrl})
    : super(
        endpoint: Uri.parse(
          '${baseUrl ?? AppConfig.apiBaseUrl}/api/v1/user/assignments',
        ),
        name: 'UserAssignmentsRepository',
      );

  @override
  UserAssignments fromJson(String json) => UserAssignments.fromRawJson(json);
}
