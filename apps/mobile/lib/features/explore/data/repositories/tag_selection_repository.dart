import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/repository/external/platform_http_client.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';

class TagSelectionException implements Exception {
  const TagSelectionException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// One entry of a saved selection: which tag, and whether it is the primary.
class TagSelection {
  const TagSelection({required this.id, required this.isPrimary});

  final int id;
  final bool isPrimary;

  Map<String, Object?> toJson() => {'id': id, 'isPrimary': isPrimary};
}

/// Writes a clinic's clinical focuses and a doctor's specialties.
///
/// One class for both because they are the same request: the whole selection,
/// at most one entry marked primary, PUT at a resource. Splitting it in two
/// would have duplicated the error handling and the encoding to no end.
///
/// The request carries the entire selection rather than a diff — matching the
/// server, and for the same reason: the screen is a multiselect, so "these are
/// the focuses" is what the user meant, and a half-applied diff would leave the
/// record holding neither the old set nor the new one.
class TagSelectionRepository {
  TagSelectionRepository({String? baseUrl, RepositoryHttpClient? client})
    : _baseUrl = baseUrl ?? AppConfig.apiBaseUrl,
      _client =
          client ??
          createPlatformHttpClient(
            tokenBuilder: SessionEnvironment.instance.tokenBuilder,
          );

  final String _baseUrl;
  final RepositoryHttpClient _client;

  Future<void> saveClinicalFocuses({
    required int facilityId,
    required List<TagSelection> focuses,
  }) {
    return _put(
      url: Uri.parse(
        '$_baseUrl/api/v1/facilities/$facilityId/clinical-focuses',
      ),
      body: {
        'focuses': [for (final f in focuses) f.toJson()],
      },
      fallback: 'Não foi possível salvar os focos clínicos',
    );
  }

  Future<void> saveSpecialties({
    required int personId,
    required List<TagSelection> specialties,
  }) {
    return _put(
      url: Uri.parse('$_baseUrl/api/v1/persons/$personId/specialties'),
      body: {
        'specialties': [for (final s in specialties) s.toJson()],
      },
      fallback: 'Não foi possível salvar as especialidades',
    );
  }

  Future<void> _put({
    required Uri url,
    required Map<String, Object?> body,
    required String fallback,
  }) async {
    final response = await _client.call(
      request: RepositoryHttpRequest(
        url: url,
        method: RepositoryHttpMethod.put,
        headers: const {'Content-Type': 'application/json'},
        body: body,
      ),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      // The server's own message names the offending entry — an unknown id, two
      // primaries — and is more use than the status code.
      throw TagSelectionException(
        _messageFromBody(response.body) ?? '$fallback (${response.statusCode})',
      );
    }
  }

  String? _messageFromBody(String body) {
    if (body.isEmpty) return null;
    try {
      final decoded = jsonDecode(body);
      if (decoded is! Map<String, dynamic>) return null;
      final message = decoded['message'];
      if (message is String && message.trim().isNotEmpty) return message.trim();
      final errors = decoded['errors'];
      if (errors is List && errors.isNotEmpty) {
        final first = errors.first;
        if (first is Map && first['message'] is String) {
          return (first['message'] as String).trim();
        }
      }
    } catch (_) {
      // A body that is not JSON tells the user nothing; fall back to the code.
    }
    return null;
  }
}
