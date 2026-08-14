import 'dart:convert';

import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_cadastro_repository.dart';
import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_cache_storage.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:flutter_test/flutter_test.dart';

class MemoryCacheStorage extends RepositoryCacheStorage {
  const MemoryCacheStorage();

  @override
  Future<void> clear() async {}

  @override
  Future<void> delete({required String key}) async {}

  @override
  Future<String?> read({required String key}) async => null;

  @override
  Future<void> write({required String key, required String value}) async {}
}

/// Records what the repository put on the wire. It answers 200 with an empty
/// object and decides nothing — the assertions are about the request the
/// repository built, not about anything this fake computed.
class RecordingHttpClient extends RepositoryHttpClient {
  RecordingHttpClient();

  final requests = <RepositoryHttpRequest>[];

  @override
  Future<RepositoryHttpResponse> call({
    required RepositoryHttpRequest request,
  }) async {
    requests.add(request);
    return const RepositoryHttpResponse(
      statusCode: 200,
      headers: {},
      body: '{}',
    );
  }
}

String _checklistJson({
  required bool requiresValidityDate,
  String? validUntil,
  Map<String, dynamic>? expiry,
}) => jsonEncode({
  'facilityId': 1,
  'documents': [
    {
      'requirementId': 5,
      'slug': 'licenca_sanitaria',
      'name': 'Licença Sanitária',
      'kind': 'file',
      'uiStatus': 'approved',
      'documentId': 300,
      'documentStatus': 'APPROVED',
      'latestSubmittedStatus': 'APPROVED',
      'requiresValidityDate': requiresValidityDate,
      'validUntil': ?validUntil,
      'expiry': ?expiry,
      'files': const [],
    },
  ],
  'counts': {'pendingAction': 0},
});

void main() {
  BaseRepository.storage = const MemoryCacheStorage();

  group('checklist parsing — validity', () {
    test('carries the requirement flag, the date and the derived expiry', () {
      final doc = FacilityCadastroRepository(1)
          .fromJson(
            _checklistJson(
              requiresValidityDate: true,
              validUntil: '2026-09-01',
              expiry: {
                'validUntil': '2026-09-01',
                'daysRemaining': 21,
                'status': 'EXPIRING_SOON',
              },
            ),
          )
          .fileDocuments
          .single;

      expect(doc.requiresValidityDate, isTrue);
      expect(doc.validUntil, '2026-09-01');
      expect(doc.expiry!.status, 'EXPIRING_SOON');
      expect(doc.expiry!.daysRemaining, 21);
      expect(doc.expiry!.label, 'Vence em 21 dias');
    });

    test('a requirement without a validity has no flag and no expiry', () {
      final doc = FacilityCadastroRepository(1)
          .fromJson(_checklistJson(requiresValidityDate: false))
          .fileDocuments
          .single;

      expect(doc.requiresValidityDate, isFalse);
      expect(doc.validUntil, isNull);
      expect(doc.expiry, isNull);
    });

    test('an incomplete expiry block is dropped rather than half-read', () {
      final doc = FacilityCadastroRepository(1)
          .fromJson(
            _checklistJson(
              requiresValidityDate: true,
              validUntil: '2026-09-01',
              expiry: {'validUntil': '2026-09-01'},
            ),
          )
          .fileDocuments
          .single;

      expect(doc.expiry, isNull);
    });
  });

  group('CadastroExpiry.label', () {
    test('uses the server days and never recomputes them', () {
      expect(
        const CadastroExpiry(
          validUntil: '2026-08-11',
          daysRemaining: 0,
          status: 'EXPIRING_SOON',
        ).label,
        'Vence hoje',
      );
      expect(
        const CadastroExpiry(
          validUntil: '2026-08-10',
          daysRemaining: -1,
          status: 'EXPIRED',
        ).label,
        'Vencido há 1 dia',
      );
      expect(
        const CadastroExpiry(
          validUntil: '2027-01-01',
          daysRemaining: 143,
          status: 'VALID',
        ).label,
        'Vence em 143 dias',
      );
    });
  });

  group('date formatting', () {
    test('cadastroIsoDate emits the YYYY-MM-DD the API requires', () {
      expect(cadastroIsoDate(DateTime(2026, 9, 1)), '2026-09-01');
      expect(cadastroIsoDate(DateTime(2026, 12, 31)), '2026-12-31');
      // Late local time must not roll the calendar date forward or back.
      expect(cadastroIsoDate(DateTime(2026, 3, 5, 23, 59)), '2026-03-05');
    });

    test('formatCadastroDate shows dd/MM/yyyy, or nothing it cannot read', () {
      expect(formatCadastroDate('2026-09-01'), '01/09/2026');
      expect(formatCadastroDate(null), isNull);
      expect(formatCadastroDate('nao-e-data'), isNull);
    });
  });

  group('submitRequirement', () {
    test('sends validUntil when the requirement declares one', () async {
      final client = RecordingHttpClient();
      await FacilityCadastroRepository(7, client: client).submitRequirement(
        requirementId: 5,
        documentId: 300,
        validUntil: '2026-09-01',
      );

      final body = client.requests.single.body!;
      expect(body['validUntil'], '2026-09-01');
      expect(body['documentId'], 300);
      expect(
        client.requests.single.url.path,
        endsWith('/facilities/7/cadastro/requirements/5/submit'),
      );
    });

    test('omits validUntil entirely when there is none', () async {
      final client = RecordingHttpClient();
      await FacilityCadastroRepository(
        7,
        client: client,
      ).submitRequirement(requirementId: 5, documentId: 300);

      // The API rejects a `validUntil` on a requirement that declares none, so
      // the key must be absent — not present and null.
      expect(client.requests.single.body!.containsKey('validUntil'), isFalse);
    });
  });
}
