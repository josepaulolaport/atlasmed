import 'package:atlasmed_mobile_app/features/explore/data/professional_notes_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeClient extends RepositoryHttpClient {
  FakeClient(this.responses);

  final List<RepositoryHttpResponse> responses;
  final List<RepositoryHttpRequest> requests = [];

  @override
  Future<RepositoryHttpResponse> call({required RepositoryHttpRequest request}) async {
    requests.add(request);
    return responses.removeAt(0);
  }
}

void main() {
  test('maps note endpoint response and sends authenticated POST payload', () async {
    final client = FakeClient([
      const RepositoryHttpResponse(
        statusCode: 201,
        headers: {},
        body: '{"id":"note-1","note":"Retornar amanhã","createdAt":"2026-01-01T10:00:00.000Z","updatedAt":"2026-01-01T10:00:00.000Z"}',
      ),
      const RepositoryHttpResponse(statusCode: 200, headers: {}, body: '[]'),
    ]);
    final repository = ProfessionalNotesRepository('professional-1', client: client);

    final note = await repository.createNote('Retornar amanhã');

    expect(note.id, 'note-1');
    expect(client.requests.first.url.path, '/api/v1/professionals/professional-1/notes');
    expect(client.requests.first.method, RepositoryHttpMethod.post);
    expect(client.requests.first.body, {'note': 'Retornar amanhã'});
  });
}
