import 'dart:io';
import 'dart:typed_data';

import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_cadastro_upload_normalize.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;

/// Premultiplied RGBA, the format `dart:ui` hands back for `rawRgba`.
Uint8List _rgba(List<List<int>> pixels) {
  final out = Uint8List(pixels.length * 4);
  for (var i = 0; i < pixels.length; i++) {
    out[i * 4] = pixels[i][0];
    out[i * 4 + 1] = pixels[i][1];
    out[i * 4 + 2] = pixels[i][2];
    out[i * 4 + 3] = pixels[i][3];
  }
  return out;
}

/// A smooth gradient — continuous tone, like a photographed page, rather than
/// the high-frequency noise that makes JPEG look bad and PNG look good.
img.Image _photoLike(int width, int height) {
  final image = img.Image(width: width, height: height);
  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      image.setPixelRgb(
        x,
        y,
        (x * 255) ~/ width,
        (y * 255) ~/ height,
        ((x + y) * 255) ~/ (width + height),
      );
    }
  }
  return image;
}

/// A flat two-tone page: PNG's best case, JPEG's worst.
img.Image _flatPage(int width, int height) {
  final image = img.Image(width: width, height: height);
  img.fill(image, color: img.ColorRgb8(255, 255, 255));
  img.fillRect(
    image,
    x1: 10,
    y1: 10,
    x2: width - 10,
    y2: height ~/ 2,
    color: img.ColorRgb8(0, 0, 0),
  );
  return image;
}

Future<File> _write(Directory dir, String name, List<int> bytes) async {
  final file = File('${dir.path}/$name');
  await file.writeAsBytes(bytes);
  return file;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory tempDir;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('cadastro_normalize');
  });

  tearDown(() async {
    await tempDir.delete(recursive: true);
  });

  group('decode target', () {
    test('never upscales an image already within the bound', () {
      expect(cadastroDecodeTarget(width: 800, height: 600), isNull);
      expect(cadastroDecodeTarget(width: 2048, height: 2048), isNull);
    });

    test('constrains only the long edge, so aspect ratio is preserved', () {
      expect(cadastroDecodeTarget(width: 4000, height: 3000), (
        width: 2048,
        height: null,
      ));
      // The PNG path passed targetWidth unconditionally, which stretched a
      // portrait photo back up to 2048 wide.
      expect(cadastroDecodeTarget(width: 3000, height: 4000), (
        width: null,
        height: 2048,
      ));
    });
  });

  group('jpeg encoding', () {
    test('emits a JPEG of the given size', () {
      final jpeg = encodeCadastroJpeg(
        premultipliedRgba: _rgba(List.filled(64 * 32, [10, 20, 30, 255])),
        width: 64,
        height: 32,
      );

      expect(jpeg[0], 0xFF);
      expect(jpeg[1], 0xD8);
      final decoded = img.decodeJpg(jpeg)!;
      expect(decoded.width, 64);
      expect(decoded.height, 32);
    });

    test('flattens transparency onto white, not black', () {
      // Fully transparent in premultiplied RGBA is (0,0,0,0). Left as-is, JPEG
      // renders it black and a scanned document grows a blot.
      final jpeg = encodeCadastroJpeg(
        premultipliedRgba: _rgba(List.filled(16 * 16, [0, 0, 0, 0])),
        width: 16,
        height: 16,
        quality: 100,
      );

      final decoded = img.decodeJpg(jpeg)!;
      final pixel = decoded.getPixel(8, 8);
      expect(pixel.r, greaterThan(240));
      expect(pixel.g, greaterThan(240));
      expect(pixel.b, greaterThan(240));
    });
  });

  group('normalizeCadastroUpload', () {
    test('a large camera photo stays JPEG and is downscaled', () async {
      final source = img.encodeJpg(_photoLike(2500, 1200), quality: 92);
      final file = await _write(tempDir, 'IMG_0042.HEIC', source);

      final normalized = await normalizeCadastroUpload(
        localPath: file.path,
        fileName: 'IMG_0042.HEIC',
        contentType: '',
      );

      // D-11: this used to come back as `documento.png`, several times larger.
      expect(normalized.contentType, 'image/jpeg');
      expect(normalized.name, 'documento.jpg');
      expect(normalized.bytes.length, lessThan(source.length));

      final decoded = img.decodeJpg(Uint8List.fromList(normalized.bytes))!;
      expect(decoded.width, 2048);
      // Aspect ratio survives: 2500x1200 → 2048x983.
      expect(decoded.height, closeTo(1200 * 2048 / 2500, 2));
    });

    test('a large PNG scan is converted to JPEG at the bound', () async {
      final source = img.encodePng(_photoLike(1200, 2600));
      final file = await _write(tempDir, 'scan.png', source);

      final normalized = await normalizeCadastroUpload(
        localPath: file.path,
        fileName: 'scan.png',
        contentType: 'image/png',
      );

      expect(normalized.contentType, 'image/jpeg');
      final decoded = img.decodeJpg(Uint8List.fromList(normalized.bytes))!;
      // Portrait: the *height* is the long edge that gets constrained.
      expect(decoded.height, 2048);
      expect(decoded.width, closeTo(1200 * 2048 / 2600, 2));
    });

    test('keeps a small PNG when JPEG would be no smaller', () async {
      final source = img.encodePng(_flatPage(600, 400));
      final file = await _write(tempDir, 'flat.png', source);

      final normalized = await normalizeCadastroUpload(
        localPath: file.path,
        fileName: 'flat.png',
        contentType: 'image/png',
      );

      expect(normalized.contentType, 'image/png');
      expect(normalized.bytes, source);
    });

    test('passes a small JPEG through untouched', () async {
      final source = img.encodeJpg(_photoLike(800, 600), quality: 90);
      final file = await _write(tempDir, 'photo.jpg', source);

      final normalized = await normalizeCadastroUpload(
        localPath: file.path,
        fileName: 'photo.jpg',
        contentType: 'image/jpeg',
      );

      expect(normalized.contentType, 'image/jpeg');
      // Re-encoding would cost a generation of quality for no size win.
      expect(normalized.bytes, source);
    });

    test('keeps a PDF as-is with a sanitized name', () async {
      final pdf = Uint8List.fromList('%PDF-1.4 fake'.codeUnits);
      final file = await _write(tempDir, 'contrato.pdf', pdf);

      final normalized = await normalizeCadastroUpload(
        localPath: file.path,
        fileName: 'Contrato Social (2026).pdf',
        contentType: 'application/pdf',
      );

      expect(normalized.contentType, 'application/pdf');
      expect(normalized.bytes, pdf);
      expect(normalized.name, 'Contrato_Social_2026_.pdf');
    });

    test('rejects an empty file', () async {
      final file = await _write(tempDir, 'empty.jpg', const <int>[]);

      await expectLater(
        normalizeCadastroUpload(
          localPath: file.path,
          fileName: 'empty.jpg',
          contentType: 'image/jpeg',
        ),
        throwsA(isA<Exception>()),
      );
    });
  });
}
