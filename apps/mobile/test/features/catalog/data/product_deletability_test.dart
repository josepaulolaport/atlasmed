import 'package:atlasmed_mobile_app/features/catalog/data/models/product_deletability.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/repositories/catalog_api_exception.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ProductDeletability', () {
    test('reads the detail payload', () {
      final answer = ProductDeletability.fromJson({
        'deletable': false,
        'blockingReferences': {'orderItems': 3, 'productEquivalences': 1},
      });

      expect(answer.deletable, isFalse);
      expect(answer.blockedBy, {'orderItems': 3, 'productEquivalences': 1});
    });

    test('defaults to not deletable when the API says nothing', () {
      // An API that stopped sending the field should hide the action, not offer
      // one whose answer nobody knows.
      expect(ProductDeletability.fromJson(const {}).deletable, isFalse);
      expect(ProductDeletability.unknown.deletable, isFalse);
    });

    test('names each blocker in Portuguese, singular and plural', () {
      // The counts are the whole point of the refusal (spec 0016 §6.2): an order
      // means "deactivate instead", a stray equivalence is something the admin
      // can remove and retry.
      expect(
        ProductDeletability.fromJson({
          'deletable': false,
          'blockingReferences': {'orderItems': 1},
        }).blockedByLabel,
        '1 item de pedido',
      );
      expect(
        ProductDeletability.fromJson({
          'deletable': false,
          'blockingReferences': {'orderItems': 3},
        }).blockedByLabel,
        '3 itens de pedido',
      );
      expect(
        ProductDeletability.fromJson({
          'deletable': false,
          'blockingReferences': {
            'orderItems': 3,
            'productEquivalences': 1,
            'facilityProductUsage': 2,
          },
        }).blockedByLabel,
        '3 itens de pedido, 2 quantidades registradas e 1 equivalência',
      );
    });

    test('names the cadastro relations too, not just the catalogue ones', () {
      // Found on the simulator: the requirement form rendered
      // "Há 1 conformityRecords no sistema" — the raw JSON key, because
      // `_labelFor` only knew the four product relations and fell through to
      // its passthrough branch.
      expect(
        ProductDeletability.fromJson({
          'deletable': false,
          'blockingReferences': {'conformityRecords': 1},
        }).blockedByLabel,
        '1 resposta de clínica',
      );
      expect(
        ProductDeletability.fromJson({
          'deletable': false,
          'blockingReferences': {
            'conformityRecords': 3,
            'submissionDocuments': 2,
          },
        }).blockedByLabel,
        '3 respostas de clínicas e 2 documentos enviados',
      );
    });

    test('says nothing when nothing blocks it', () {
      expect(
        ProductDeletability.fromJson({
          'deletable': true,
          'blockingReferences': const {},
        }).blockedByLabel,
        '',
      );
    });
  });

  group('CatalogApiException', () {
    test('carries blockedBy off a 409 so the refusal can be explained', () {
      // The API allow-lists this key onto the client payload deliberately —
      // without it the client can only say "cannot be deleted".
      final error = CatalogApiException.fromResponse(
        RepositoryHttpResponse(
          statusCode: 409,
          body:
              '{"error":{"code":"RESOURCE_IN_USE","message":"Product is '
              'referenced by existing records and cannot be deleted",'
              '"blockedBy":{"orderItems":2}}}',
          headers: const {},
        ),
      );

      expect(error.statusCode, 409);
      expect(error.code, 'RESOURCE_IN_USE');
      expect(error.blockedBy, {'orderItems': 2});
    });

    test('leaves blockedBy empty for every other error', () {
      final error = CatalogApiException.fromResponse(
        RepositoryHttpResponse(
          statusCode: 404,
          body: '{"error":{"code":"RESOURCE_NOT_FOUND","message":"não achou"}}',
          headers: const {},
        ),
      );

      expect(error.blockedBy, isEmpty);
    });
  });
}
