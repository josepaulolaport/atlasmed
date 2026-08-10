import 'dart:convert';

import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_cadastro_repository.dart';
import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_cache_storage.dart';
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

/// Checklist row for a requirement that already has an APPROVED document and a
/// fresh DRAFT on top of it — the "Enviar novo" re-upload flow.
String _reuploadChecklistJson() => jsonEncode({
  'facilityId': 1,
  'documents': [
    {
      'requirementId': 1,
      'slug': 'identidade',
      'name': 'Identidade',
      'description': 'RG ou CNH',
      'kind': 'file',
      'required': true,
      'uiStatus': 'approved',
      // Working document = the draft the rep is composing right now.
      'documentId': 101,
      'documentStatus': 'DRAFT',
      'latestSubmittedStatus': 'APPROVED',
      'latestSubmittedAt': '2026-07-22T12:00:00.000Z',
      'currentApproved': {
        'documentId': 200,
        'submissionId': 9,
        'version': 1,
        'submittedAt': '2026-07-22T12:00:00.000Z',
        'fileCount': 1,
        'files': [
          {
            'fileAssetId': 900,
            'position': 1,
            'role': 'PAGE',
            'fileName': 'aprovado.pdf',
            'status': 'READY',
            'contentType': 'application/pdf',
          },
        ],
      },
      'files': [
        {
          'fileAssetId': 901,
          'position': 1,
          'role': 'PAGE',
          'fileName': 'renovacao.pdf',
          'status': 'READY',
          'contentType': 'application/pdf',
        },
      ],
    },
  ],
  'counts': {'pendingAction': 0},
});

void main() {
  BaseRepository.storage = const MemoryCacheStorage();

  group('FacilityCadastroChecklist parsing', () {
    test('keeps the working draft and the approved version apart', () {
      final checklist = FacilityCadastroRepository(
        1,
      ).fromJson(_reuploadChecklistJson());

      final doc = checklist.fileDocuments.single;

      // Top level = the working document. This is what the compose screen
      // polls, matching on `fileAssetId`; before the fix it carried the
      // approved document's file and the match never happened.
      expect(doc.recordId, 101);
      expect(doc.documentStatus, 'DRAFT');
      expect(doc.files.map((f) => f.fileAssetId), [901]);

      // `currentApproved` carries the approved document's own files, which is
      // what the detail screen's "Versão aprovada vN" card renders.
      final approved = doc.currentApproved;
      expect(approved, isNotNull);
      expect(approved!.documentId, 200);
      expect(approved.version, 1);
      expect(approved.fileCount, 1);
      expect(approved.files.map((f) => f.fileAssetId), [900]);
      expect(approved.files.single.fileName, 'aprovado.pdf');
    });

    test('the compose screen poll finds the file it just uploaded', () {
      final checklist = FacilityCadastroRepository(
        1,
      ).fromJson(_reuploadChecklistJson());

      EstablishmentDocument? doc;
      for (final d in checklist.documents) {
        if (d.requirementId == 1 || d.id == 1) {
          doc = d;
          break;
        }
      }
      expect(doc, isNotNull);

      CadastroDocumentFile? match;
      for (final f in doc!.files) {
        if (f.fileAssetId == 901) {
          match = f;
          break;
        }
      }
      expect(match, isNotNull, reason: 'poll must match the uploaded asset');
      expect(match!.isReady, isTrue);
    });

    test('an approved requirement with no draft still exposes its files', () {
      final json = jsonEncode({
        'facilityId': 1,
        'documents': [
          {
            'requirementId': 1,
            'slug': 'identidade',
            'name': 'Identidade',
            'kind': 'file',
            'uiStatus': 'approved',
            'documentId': 200,
            'documentStatus': 'APPROVED',
            'latestSubmittedStatus': 'APPROVED',
            'currentApproved': {
              'documentId': 200,
              'submissionId': 9,
              'version': 1,
              'fileCount': 1,
              'files': [
                {
                  'fileAssetId': 900,
                  'position': 1,
                  'role': 'PAGE',
                  'fileName': 'aprovado.pdf',
                  'status': 'READY',
                  'contentType': 'application/pdf',
                },
              ],
            },
            'files': [
              {
                'fileAssetId': 900,
                'position': 1,
                'role': 'PAGE',
                'fileName': 'aprovado.pdf',
                'status': 'READY',
                'contentType': 'application/pdf',
              },
            ],
          },
        ],
        'counts': {'pendingAction': 0},
      });

      final doc = FacilityCadastroRepository(1).fromJson(json).fileDocuments.single;
      expect(doc.files.map((f) => f.fileAssetId), [900]);
      expect(doc.currentApproved!.files.map((f) => f.fileAssetId), [900]);
    });

    test('an older payload without currentApproved.files degrades safely', () {
      final json = jsonEncode({
        'facilityId': 1,
        'documents': [
          {
            'requirementId': 1,
            'slug': 'identidade',
            'name': 'Identidade',
            'kind': 'file',
            'uiStatus': 'approved',
            'documentId': 200,
            'documentStatus': 'APPROVED',
            'currentApproved': {
              'documentId': 200,
              'submissionId': 9,
              'version': 3,
              'fileCount': 2,
            },
            'files': const [],
          },
        ],
        'counts': {'pendingAction': 0},
      });

      final approved = FacilityCadastroRepository(
        1,
      ).fromJson(json).fileDocuments.single.currentApproved!;
      expect(approved.version, 3);
      expect(approved.fileCount, 2);
      expect(approved.files, isEmpty);
    });
  });
}
