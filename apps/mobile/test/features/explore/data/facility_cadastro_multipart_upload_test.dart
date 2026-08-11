import 'dart:convert';
import 'dart:typed_data';

import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_cadastro_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_cadastro_upload_transport.dart';
import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_cache_storage.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

class _MemoryCacheStorage extends RepositoryCacheStorage {
  const _MemoryCacheStorage();

  @override
  Future<void> clear() async {}

  @override
  Future<void> delete({required String key}) async {}

  @override
  Future<String?> read({required String key}) async => null;

  @override
  Future<void> write({required String key, required String value}) async {}
}

/// Answers the API calls of one upload in order, recording what was asked.
class _ScriptedApiClient extends RepositoryHttpClient {
  _ScriptedApiClient(this._responses);

  final List<Object> _responses;
  final List<RepositoryHttpRequest> requests = [];

  @override
  Future<RepositoryHttpResponse> call({
    required RepositoryHttpRequest request,
  }) async {
    requests.add(request);
    return RepositoryHttpResponse(
      statusCode: 200,
      headers: const {},
      body: jsonEncode(_responses.removeAt(0)),
    );
  }

  List<RepositoryHttpRequest> get signRequests =>
      requests.where((r) => r.url.path.endsWith('/parts/sign')).toList();

  RepositoryHttpRequest get completeRequest =>
      requests.lastWhere((r) => r.url.path.endsWith('/uploads/complete'));
}

void main() {
  setUp(() {
    BaseRepository.storage = const _MemoryCacheStorage();
  });

  test(
    'a part that fails is re-signed and resumed; stored parts are not re-sent',
    () async {
      final bytes = Uint8List.fromList(
        List<int>.generate(3000, (i) => i % 251),
      );
      final api = _ScriptedApiClient([
        // initiate
        {
          'method': 'MULTIPART',
          'fileId': 7,
          'uploadSessionId': 55,
          'partSizeBytes': 1024,
          'totalParts': 3,
        },
        // sign, round 1
        {
          'parts': [
            {'partNumber': 1, 'uploadUrl': 'https://store.example/p1'},
            {'partNumber': 2, 'uploadUrl': 'https://store.example/p2'},
            {'partNumber': 3, 'uploadUrl': 'https://store.example/p3'},
          ],
        },
        // sign, round 2 — only what is missing
        {
          'parts': [
            {'partNumber': 2, 'uploadUrl': 'https://store.example/p2-retry'},
            {'partNumber': 3, 'uploadUrl': 'https://store.example/p3-retry'},
          ],
        },
        // complete
        {'status': 'READY'},
      ]);

      final puts = <String>[];
      final transport = CadastroUploadTransport(
        // One shot per round: the resume behaviour, not the socket-level
        // retry, is what this test is about.
        maxAttempts: 1,
        delay: (_) async {},
        clientFactory: () => MockClient((request) async {
          final path = request.url.path;
          puts.add(path);
          if (path == '/p2') {
            // Connection dies mid-file, after part 1 is already stored.
            return http.Response('', 500);
          }
          final part = path.replaceAll(RegExp(r'[^0-9]'), '');
          return http.Response('', 200, headers: {'etag': '"etag-$part"'});
        }),
      );

      final repository = FacilityCadastroRepository(
        1,
        client: api,
        uploadTransport: transport,
      );

      final progress = <double>[];
      final result = await repository.uploadFileToDocument(
        documentId: 101,
        file: FacilityCadastroFile(
          name: 'documento.jpg',
          bytes: bytes,
          contentType: 'image/jpeg',
        ),
        onProgress: progress.add,
      );

      expect(result.fileId, 7);
      expect(result.status, 'READY');

      // Round 2 asked only for the parts that never landed.
      expect(api.signRequests.length, 2);
      expect(api.signRequests.first.body?['partNumbers'], [1, 2, 3]);
      expect(api.signRequests.last.body?['partNumbers'], [2, 3]);

      // Part 1 moved once. Resume, not restart.
      expect(puts.where((p) => p == '/p1').length, 1);
      expect(puts, ['/p1', '/p2', '/p2-retry', '/p3-retry']);

      // Every part is present, in order, with its own byte count.
      expect(api.completeRequest.body?['parts'], [
        {'partNumber': 1, 'etag': 'etag-1', 'sizeBytes': 1024},
        {'partNumber': 2, 'etag': 'etag-2', 'sizeBytes': 1024},
        {'partNumber': 3, 'etag': 'etag-3', 'sizeBytes': 952},
      ]);
      expect(api.completeRequest.body?['uploadSessionId'], 55);

      // The bar never runs backwards across the resume, and finishes full.
      for (var i = 1; i < progress.length; i++) {
        expect(
          progress[i],
          greaterThanOrEqualTo(progress[i - 1]),
          reason: 'progress went backwards at index $i: $progress',
        );
      }
      expect(progress.last, 1.0);
    },
  );

  test('a part the store never stores fails the file, not silently', () async {
    final bytes = Uint8List.fromList(List<int>.generate(2000, (i) => i % 251));
    final api = _ScriptedApiClient([
      {
        'method': 'MULTIPART',
        'fileId': 7,
        'uploadSessionId': 55,
        'partSizeBytes': 1024,
        'totalParts': 2,
      },
      {
        'parts': [
          {'partNumber': 1, 'uploadUrl': 'https://store.example/p1'},
          {'partNumber': 2, 'uploadUrl': 'https://store.example/p2'},
        ],
      },
      {
        'parts': [
          {'partNumber': 2, 'uploadUrl': 'https://store.example/p2'},
        ],
      },
      {
        'parts': [
          {'partNumber': 2, 'uploadUrl': 'https://store.example/p2'},
        ],
      },
    ]);

    final transport = CadastroUploadTransport(
      maxAttempts: 1,
      delay: (_) async {},
      clientFactory: () => MockClient((request) async {
        if (request.url.path == '/p2') return http.Response('', 500);
        return http.Response('', 200, headers: {'etag': 'etag-1'});
      }),
    );

    final repository = FacilityCadastroRepository(
      1,
      client: api,
      uploadTransport: transport,
    );

    await expectLater(
      repository.uploadFileToDocument(
        documentId: 101,
        file: FacilityCadastroFile(
          name: 'documento.jpg',
          bytes: bytes,
          contentType: 'image/jpeg',
        ),
      ),
      throwsA(isA<FacilityCadastroException>()),
    );

    // `/uploads/complete` is never reached with a half-uploaded object.
    expect(
      api.requests.any((r) => r.url.path.endsWith('/uploads/complete')),
      isFalse,
    );
  });

  test(
    'quoted lowercase ETag headers reach complete unquoted (D-13)',
    () async {
      final bytes = Uint8List.fromList(
        List<int>.generate(1500, (i) => i % 251),
      );
      final api = _ScriptedApiClient([
        {
          'method': 'MULTIPART',
          'fileId': 7,
          'uploadSessionId': 55,
          'partSizeBytes': 1024,
          'totalParts': 2,
        },
        {
          'parts': [
            {'partNumber': 1, 'uploadUrl': 'https://store.example/p1'},
            {'partNumber': 2, 'uploadUrl': 'https://store.example/p2'},
          ],
        },
        {'status': 'READY'},
      ]);

      final transport = CadastroUploadTransport(
        delay: (_) async {},
        // S3 sends `ETag: "..."`; every Dart client lowercases response header
        // keys, so this is the shape the client actually sees.
        clientFactory: () => MockClient(
          (request) async =>
              http.Response('', 200, headers: {'etag': '"9a8b7c6d"'}),
        ),
      );

      final repository = FacilityCadastroRepository(
        1,
        client: api,
        uploadTransport: transport,
      );

      await repository.uploadFileToDocument(
        documentId: 101,
        file: FacilityCadastroFile(
          name: 'documento.jpg',
          bytes: bytes,
          contentType: 'image/jpeg',
        ),
      );

      final parts = (api.completeRequest.body?['parts'] as List)
          .cast<Map<String, dynamic>>();
      expect(parts.map((p) => p['etag']), everyElement('9a8b7c6d'));
    },
  );

  test('single PUT uploads report transfer progress and complete', () async {
    final bytes = Uint8List.fromList(
      List<int>.generate(300 * 1024, (i) => i % 251),
    );
    final api = _ScriptedApiClient([
      {
        'method': 'PUT',
        'fileId': 12,
        'uploadUrl': 'https://store.example/object',
      },
      {'status': 'READY'},
    ]);

    Uint8List? received;
    String? sentContentType;
    final transport = CadastroUploadTransport(
      delay: (_) async {},
      clientFactory: () => MockClient((request) async {
        received = request.bodyBytes;
        sentContentType = request.headers['content-type'];
        return http.Response('', 200);
      }),
    );

    final repository = FacilityCadastroRepository(
      1,
      client: api,
      uploadTransport: transport,
    );

    final progress = <double>[];
    final result = await repository.uploadFileToDocument(
      documentId: 101,
      file: FacilityCadastroFile(
        name: 'documento.jpg',
        bytes: bytes,
        contentType: 'image/jpeg',
      ),
      onProgress: progress.add,
    );

    expect(result.fileId, 12);
    expect(received, bytes);
    expect(sentContentType, 'image/jpeg');
    // Intermediate values, not just 0 and 1 — the bar moves during transfer.
    expect(progress.where((p) => p > 0.05 && p < 0.95).length, greaterThan(1));
    expect(progress.last, 1.0);
  });
}
