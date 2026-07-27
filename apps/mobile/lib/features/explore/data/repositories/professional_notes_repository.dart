import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/professional_note.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class ProfessionalNotesException implements Exception {
  const ProfessionalNotesException();
}

class ProfessionalNotesRepository extends Repository<List<ProfessionalNote>>
    with SessionEnvironmentMixin<List<ProfessionalNote>> {
  ProfessionalNotesRepository(
    this.professionalId, {
    RepositoryHttpClient? client,
  }) : _client = client,
       super(
         endpoint: Uri.parse(
           '${AppConfig.apiBaseUrl}/api/v1/professionals/$professionalId/notes',
         ),
         resolveOnCreate: true,
         name: 'ProfessionalNotesRepository',
       );

  final String professionalId;
  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  @override
  List<ProfessionalNote> fromJson(String json) {
    final data = jsonDecode(json) as List<dynamic>;
    return data
        .map((item) => ProfessionalNote.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<ProfessionalNote> createNote(String note) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: endpoint,
        method: RepositoryHttpMethod.post,
        headers: const {'Content-Type': 'application/json'},
        body: {'note': note},
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw const ProfessionalNotesException();
      }
    }

    final created = ProfessionalNote.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
    await refresh();
    return created;
  }
}
