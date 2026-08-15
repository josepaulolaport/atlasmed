import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_vertical_rep_assignments_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/repositories/clinic_assignment_repository.dart';
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

  test(
    'unassign DELETEs vertical-scoped rep path, carrying the motivo',
    () async {
      // The reason used to be absent here, and the server defaults a missing one
      // to `manual_unassign` — "somebody unassigned this, reason unrecorded".
      // The same action reached from Desempenho asked and recorded; this one did
      // not, so half the assignment history said nothing (spec 0015 R7).
      final client = FakeClient([
        const RepositoryHttpResponse(statusCode: 200, headers: {}, body: '{}'),
      ]);
      final repo = FacilityVerticalRepAssignmentsRepository(
        42,
        baseUrl: 'http://test',
        client: client,
      );

      await repo.unassign(verticalId: 3, reason: UnassignReason.clinicClosed);

      expect(client.requests, hasLength(1));
      final request = client.requests.single;
      expect(request.method, RepositoryHttpMethod.delete);
      expect(
        request.url.toString(),
        'http://test/api/v1/facilities/42/verticals/3/rep?reason=clinic_closed',
      );
    },
  );

  test('each motivo travels under its own wire value', () async {
    // The labels are Portuguese and the wire values are not; a mapping that
    // drifted would file every removal under whichever value came first.
    for (final reason in UnassignReason.values) {
      final client = FakeClient([
        const RepositoryHttpResponse(statusCode: 200, headers: {}, body: '{}'),
      ]);
      final repo = FacilityVerticalRepAssignmentsRepository(
        42,
        baseUrl: 'http://test',
        client: client,
      );

      await repo.unassign(verticalId: 3, reason: reason);

      expect(
        client.requests.single.url.queryParameters['reason'],
        reason.wireValue,
      );
    }
  });
}
