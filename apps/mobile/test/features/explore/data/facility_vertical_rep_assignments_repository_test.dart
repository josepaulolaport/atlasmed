import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_vertical_rep_assignments_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeClient extends RepositoryHttpClient {
  FakeClient(this.responses);

  final List<RepositoryHttpResponse> responses;
  final List<RepositoryHttpRequest> requests = [];

  @override
  Future<RepositoryHttpResponse> call({
    required RepositoryHttpRequest request,
  }) async {
    requests.add(request);
    return responses.removeAt(0);
  }
}

void main() {
  test('assign PUTs vertical-scoped rep path with userId body', () async {
    final client = FakeClient([
      const RepositoryHttpResponse(statusCode: 200, headers: {}, body: '{}'),
    ]);
    final repo = FacilityVerticalRepAssignmentsRepository(
      42,
      baseUrl: 'http://test',
      client: client,
    );

    await repo.assign(userId: 7, verticalId: 3);

    expect(client.requests, hasLength(1));
    final request = client.requests.single;
    expect(request.method, RepositoryHttpMethod.put);
    expect(
      request.url.toString(),
      'http://test/api/v1/facilities/42/verticals/3/rep',
    );
    expect(request.body, {'userId': 7});
  });

  test('unassign DELETEs vertical-scoped rep path', () async {
    final client = FakeClient([
      const RepositoryHttpResponse(statusCode: 200, headers: {}, body: '{}'),
    ]);
    final repo = FacilityVerticalRepAssignmentsRepository(
      42,
      baseUrl: 'http://test',
      client: client,
    );

    await repo.unassign(verticalId: 3);

    expect(client.requests, hasLength(1));
    final request = client.requests.single;
    expect(request.method, RepositoryHttpMethod.delete);
    expect(
      request.url.toString(),
      'http://test/api/v1/facilities/42/verticals/3/rep',
    );
  });
}
