import 'package:atlasmed_mobile_app/features/explore/data/cadastro_upload_limits.dart';
import 'package:flutter_test/flutter_test.dart';

const _limits = CadastroUploadLimits(
  allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  maxFiles: 3,
  maxFileSizeBytes: 50 * 1024 * 1024,
  maxCombinedSizeBytes: 80 * 1024 * 1024,
);

CadastroUploadCandidate _pdf(String name, int sizeBytes) =>
    CadastroUploadCandidate(
      fileName: name,
      mimeType: 'application/pdf',
      sizeBytes: sizeBytes,
      isImage: false,
    );

CadastroUploadCandidate _image(String name, int sizeBytes) =>
    CadastroUploadCandidate(
      fileName: name,
      mimeType: 'image/heic',
      sizeBytes: sizeBytes,
      isImage: true,
    );

void main() {
  group('preflightCadastroUpload', () {
    test('accepts a PDF inside every limit', () {
      final rejections = preflightCadastroUpload(
        limits: _limits,
        candidates: [_pdf('alvara.pdf', 4 * 1024 * 1024)],
      );
      expect(rejections, isEmpty);
    });

    test('refuses an oversized PDF naming both sizes', () {
      final rejections = preflightCadastroUpload(
        limits: _limits,
        candidates: [_pdf('alvara.pdf', 62 * 1024 * 1024)],
      );
      expect(rejections.single.fileName, 'alvara.pdf');
      expect(rejections.single.message, 'PDF de até 50 MB — este tem 62 MB.');
    });

    test('refuses a type the requirement does not allow', () {
      final rejections = preflightCadastroUpload(
        limits: const CadastroUploadLimits(
          allowedMimeTypes: ['application/pdf'],
          maxFiles: 3,
          maxFileSizeBytes: 1000,
          maxCombinedSizeBytes: 3000,
        ),
        candidates: [
          const CadastroUploadCandidate(
            fileName: 'planilha.xlsx',
            mimeType:
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            sizeBytes: 10,
            isImage: false,
          ),
        ],
      );
      expect(rejections.single.message, 'Tipo não aceito. Envie PDF.');
    });

    test('lets an image through on size: normalisation replaces its bytes '
        'before upload, so the picked size is not what the server sees', () {
      final rejections = preflightCadastroUpload(
        limits: _limits,
        candidates: [_image('foto.heic', 90 * 1024 * 1024)],
      );
      expect(rejections, isEmpty);
    });

    test('refuses an image when the requirement accepts no image type', () {
      final rejections = preflightCadastroUpload(
        limits: const CadastroUploadLimits(
          allowedMimeTypes: ['application/pdf'],
          maxFiles: 3,
          maxFileSizeBytes: 1000,
          maxCombinedSizeBytes: 3000,
        ),
        candidates: [_image('foto.heic', 10)],
      );
      expect(rejections.single.message, 'Este documento aceita apenas PDF.');
    });

    test('counts files already attached against maxFiles', () {
      final rejections = preflightCadastroUpload(
        limits: _limits,
        candidates: [_pdf('quarto.pdf', 10)],
        existingFileCount: 3,
      );
      expect(
        rejections.single.message,
        'Máximo de 3 arquivos neste documento.',
      );
    });

    test('a batch consumes the file budget as it goes', () {
      final rejections = preflightCadastroUpload(
        limits: _limits,
        candidates: [
          _pdf('a.pdf', 10),
          _pdf('b.pdf', 10),
          _pdf('c.pdf', 10),
          _pdf('d.pdf', 10),
        ],
      );
      // Only the fourth breaches maxFiles: 3 — the first three must pass.
      expect(rejections.map((r) => r.fileName), ['d.pdf']);
      expect(rejections.single.index, 3);
    });

    test('a batch consumes the combined-size budget as it goes', () {
      final rejections = preflightCadastroUpload(
        limits: _limits,
        candidates: [
          _pdf('a.pdf', 45 * 1024 * 1024),
          _pdf('b.pdf', 45 * 1024 * 1024),
        ],
      );
      expect(rejections.map((r) => r.fileName), ['b.pdf']);
      expect(
        rejections.single.message,
        'Somando os arquivos deste documento o limite é 80 MB.',
      );
    });

    test('bytes already attached count toward the combined limit', () {
      final rejections = preflightCadastroUpload(
        limits: _limits,
        candidates: [_pdf('b.pdf', 45 * 1024 * 1024)],
        existingFileCount: 1,
        existingKnownBytes: 45 * 1024 * 1024,
      );
      expect(rejections, hasLength(1));
    });
  });

  group('CadastroUploadLimits.fromRequirementJson', () {
    test('reads the limits the document response publishes', () {
      final limits = CadastroUploadLimits.fromRequirementJson({
        'id': 5,
        'slug': 'licenca_sanitaria',
        'allowedMimeTypes': ['application/pdf', 'image/jpeg'],
        'maxFiles': 4,
        'maxFileSizeBytes': 52428800,
        'maxCombinedSizeBytes': 209715200,
      });
      expect(limits, isNotNull);
      expect(limits!.maxFiles, 4);
      expect(limits.maxFileSizeBytes, 52428800);
      expect(limits.maxCombinedSizeBytes, 209715200);
      expect(limits.allows('APPLICATION/PDF'), isTrue);
      expect(limits.allowsImages, isTrue);
    });

    test('a payload missing a limit yields null, never a guessed limit', () {
      final limits = CadastroUploadLimits.fromRequirementJson({
        'allowedMimeTypes': ['application/pdf'],
        'maxFiles': 4,
      });
      expect(limits, isNull);
    });
  });

  group('formatByteSize', () {
    test('reads in the units a rep sees on their phone', () {
      expect(formatByteSize(62 * 1024 * 1024), '62 MB');
      expect(formatByteSize(50 * 1024 * 1024), '50 MB');
      expect(formatByteSize((1.5 * 1024 * 1024).round()), '1,5 MB');
      expect(formatByteSize(2048), '2 KB');
      expect(formatByteSize(512), '512 B');
    });
  });
}
