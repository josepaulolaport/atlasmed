import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/app_user.dart';
import 'package:atlasmed_mobile_app/features/territories/data/repositories/territory_api_exception.dart';
import 'package:atlasmed_mobile_app/features/territories/data/repositories/user_repository.dart';
import 'package:atlasmed_mobile_app/repository/external/platform_http_client.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';

/// Real API-backed [UserRepository] — `GET /access/users` (search) and
/// `GET /access/users/:id` (single lookup), both admin-only on the API side.
class HttpUserRepository implements UserRepository {
  HttpUserRepository({String? baseUrl})
    : _baseUrl = baseUrl ?? AppConfig.apiBaseUrl;

  final String _baseUrl;
  final RepositoryHttpClient _client = createPlatformHttpClient(
    tokenBuilder: SessionEnvironment.instance.tokenBuilder,
  );

  Uri _accessUri(String path, [Map<String, String>? query]) =>
      Uri.parse('$_baseUrl/api/v1/access$path').replace(queryParameters: query);

  @override
  Future<AppUser?> getUserById(int id) async {
    final response = await _client.call(
      request: RepositoryHttpRequest(url: _accessUri('/users/$id')),
    );
    if (response.statusCode == 404) return null;
    if (response.statusCode != 200) {
      throw TerritoryApiException.fromResponse(response);
    }
    return AppUser.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  @override
  Future<List<AppUser>> searchUsers({
    required UserRole role,
    String query = '',
    int? verticalId,
  }) async {
    final response = await _client.call(
      request: RepositoryHttpRequest(
        url: _accessUri('/users', {
          'role': role == UserRole.manager ? 'MANAGER' : 'REP',
          'limit': '50',
          if (query.trim().isNotEmpty) 'search': query.trim(),
          if (verticalId != null) 'verticalId': verticalId.toString(),
        }),
      ),
    );
    if (response.statusCode != 200) {
      throw TerritoryApiException.fromResponse(response);
    }
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final rows = (decoded['data'] as List<dynamic>)
        .cast<Map<String, dynamic>>();
    return rows.map(AppUser.fromJson).toList();
  }
}
