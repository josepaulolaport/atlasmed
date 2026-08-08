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
    this.personId, {
    RepositoryHttpClient? client,
  }) : _client = client,
       super(
         endpoint: Uri.parse(
           '${AppConfig.apiBaseUrl}/api/v1/persons/$personId/notes',
         ),
         resolveOnCreate: true,
         name: 'ProfessionalNotesRepository',
       );

  final int personId;
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

  /// `PATCH /persons/:id/notes/:noteId`
  Future<ProfessionalNote> updateNote(int noteId, String note) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('${endpoint.toString()}/$noteId'),
        method: RepositoryHttpMethod.patch,
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

    final updated = ProfessionalNote.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
    await refresh();
    return updated;
  }

  /// `DELETE /persons/:id/notes/:noteId`
  Future<void> deleteNote(int noteId) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('${endpoint.toString()}/$noteId'),
        method: RepositoryHttpMethod.delete,
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw const ProfessionalNotesException();
      }
    }

    await refresh();
  }
}
