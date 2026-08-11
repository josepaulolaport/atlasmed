import 'dart:typed_data';

import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_cadastro_upload_transport.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

Uint8List _payload(int length) =>
    Uint8List.fromList(List<int>.generate(length, (i) => i % 251));

void main() {
  test('reports progress up to the full body and sends every byte', () async {
    final body = _payload(200 * 1024);
    late Uint8List received;
    final transport = CadastroUploadTransport(
      clientFactory: () => MockClient((request) async {
        received = request.bodyBytes;
        return http.Response('', 200, headers: {'etag': '"abc"'});
      }),
    );

    final progress = <int>[];
    final response = await transport.put(
      url: Uri.parse('https://store.example/object'),
      body: body,
      contentType: 'image/jpeg',
      onSent: progress.add,
    );

    expect(response.statusCode, 200);
    expect(response.headers['etag'], '"abc"');
    expect(received, body);
    // Progress arrives in steps rather than one jump, and ends at the total.
    expect(progress.length, greaterThan(1));
    expect(progress.last, body.length);
    expect(progress, orderedEquals(List<int>.of(progress)..sort()));
  });

  test('retries a 5xx and rewinds progress before the next attempt', () async {
    final body = _payload(150 * 1024);
    var attempts = 0;
    final transport = CadastroUploadTransport(
      delay: (_) async {},
      clientFactory: () => MockClient((request) async {
        attempts++;
        if (attempts == 1) return http.Response('slow down', 503);
        return http.Response('', 200, headers: {'etag': 'ok'});
      }),
    );

    final progress = <int>[];
    await transport.put(
      url: Uri.parse('https://store.example/object'),
      body: body,
      onSent: progress.add,
    );

    expect(attempts, 2);
    // The failed attempt's bytes are not counted twice: the caller is told the
    // transfer went back to zero before it climbs again.
    expect(progress, contains(0));
    expect(progress.indexOf(0), greaterThan(0));
    expect(progress.last, body.length);
  });

  test('does not resend bytes when the store refuses the signature', () async {
    var attempts = 0;
    final transport = CadastroUploadTransport(
      delay: (_) async {},
      clientFactory: () => MockClient((request) async {
        attempts++;
        return http.Response('<Error>SignatureDoesNotMatch</Error>', 403);
      }),
    );

    await expectLater(
      transport.put(
        url: Uri.parse('https://store.example/object'),
        body: _payload(1024),
      ),
      throwsA(
        isA<CadastroUploadTransportException>()
            .having((e) => e.retryable, 'retryable', isFalse)
            .having((e) => e.statusCode, 'statusCode', 403),
      ),
    );
    expect(attempts, 1);
  });

  test('gives up after maxAttempts on a persistent failure', () async {
    var attempts = 0;
    final transport = CadastroUploadTransport(
      maxAttempts: 3,
      delay: (_) async {},
      clientFactory: () => MockClient((request) async {
        attempts++;
        return http.Response('', 500);
      }),
    );

    await expectLater(
      transport.put(
        url: Uri.parse('https://store.example/object'),
        body: _payload(1024),
      ),
      throwsA(isA<CadastroUploadTransportException>()),
    );
    expect(attempts, 3);
  });

  test('retries a dropped connection', () async {
    var attempts = 0;
    final transport = CadastroUploadTransport(
      delay: (_) async {},
      clientFactory: () => MockClient((request) async {
        attempts++;
        if (attempts < 3) {
          throw http.ClientException('Connection closed', request.url);
        }
        return http.Response('', 200, headers: {'etag': 'ok'});
      }),
    );

    final response = await transport.put(
      url: Uri.parse('https://store.example/object'),
      body: _payload(4096),
    );

    expect(attempts, 3);
    expect(response.statusCode, 200);
  });
}
