import 'package:atlasmed_mobile_app/repository/domain/exceptions/unexpected_status_code_exception.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('a request never prints its credentials', () {
    final request = RepositoryHttpRequest(
      url: Uri.parse('https://example.test/api/v1/session/'),
      method: RepositoryHttpMethod.delete,
      headers: const {
        'Authorization': 'Bearer header.payload.signature',
        'Content-Type': 'application/json',
      },
    );

    final printed = request.toString();

    expect(printed, contains('DELETE'));
    expect(printed, contains('application/json'));
    expect(printed, contains('<redacted>'));
    expect(printed, isNot(contains('header.payload.signature')));
  });

  test(
    'an unexpected status reports whether the request was authenticated',
    () {
      final unauthenticated = UnexpectedStatusCodeException(
        sent: RepositoryHttpRequest(
          url: Uri.parse('https://example.test/api/v1/facilities'),
        ),
        received: const RepositoryHttpResponse(
          statusCode: 401,
          headers: {},
          body: '{"error":{"code":"UNAUTHORIZED"}}',
        ),
      );

      final authenticated = UnexpectedStatusCodeException(
        sent: RepositoryHttpRequest(
          url: Uri.parse('https://example.test/api/v1/facilities'),
        ),
        received: const RepositoryHttpResponse(
          statusCode: 401,
          headers: {},
          body: '{"error":{"code":"UNAUTHORIZED"}}',
          requestHeaders: {'Authorization': 'Bearer header.payload.signature'},
        ),
      );

      expect(unauthenticated.toString(), contains('sentHeaders: {}'));
      expect(
        authenticated.toString(),
        contains('sentHeaders: {Authorization: <redacted>}'),
      );
      expect(
        authenticated.toString(),
        isNot(contains('header.payload.signature')),
      );
    },
  );
}
