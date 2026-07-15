import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/profile/data/user_preferences.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class UserPreferencesRepository extends Repository<UserPreferences>
    with SessionEnvironmentMixin<UserPreferences> {
  UserPreferencesRepository({String? baseUrl})
    : _baseUrl = baseUrl ?? AppConfig.apiBaseUrl,
      super(
        endpoint: Uri.parse(
          '${baseUrl ?? AppConfig.apiBaseUrl}/api/v1/user/preferences',
        ),
        name: 'UserPreferencesRepository',
      );

  final String _baseUrl;

  @override
  UserPreferences fromJson(String json) => UserPreferences.fromRawJson(json);

  Future<UserPreferences?> patch(UpdateUserPreferencesPayload payload) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('$_baseUrl/api/v1/user/preferences'),
        method: RepositoryHttpMethod.patch,
        headers: {'Content-Type': 'application/json'},
        body: payload.toJson(),
      ),
    );

    if (successfulCondition(response.statusCode, response.body)) {
      final preferences = fromJson(response.body);
      await emit(data: preferences);
      return preferences;
    }

    final shouldThrow = await onErrorStatusCode(response.statusCode);
    if (shouldThrow) {
      return null;
    }
    return fromJson(response.body);
  }
}
