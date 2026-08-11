import 'dart:io';
import 'dart:ui' as ui;

import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_cadastro_repository.dart';
import 'package:flutter/foundation.dart';
import 'package:image/image.dart' as img;

/// Longest edge kept for an uploaded photo. A document photographed at this
/// resolution is legible full-screen, which is what removes the need for
/// server-side derivatives (spec 0011 §4.2).
const int kCadastroMaxImageEdge = 2048;

/// JPEG quality for re-encoded photos. High enough that small print in a
/// scanned document survives, low enough that a page lands in ~300–600 KB.
const int kCadastroJpegQuality = 82;

/// Normalizes a picked Cadastro file for API upload:
/// - images → downscaled JPEG with a safe ASCII filename (fixes HEIC / empty /
///   odd MIME)
/// - PDF → bytes as-is with sanitized filename
///
/// Re-encoding to PNG is what this replaces (D-11): a 2 MB camera JPEG became
/// a 6–20 MB PNG, crossing the 10 MB multipart threshold depending on how
/// noisy the photo was.
Future<FacilityCadastroFile> normalizeCadastroUpload({
  required String localPath,
  required String fileName,
  required String contentType,
}) async {
  final raw = await File(localPath).readAsBytes();
  if (raw.isEmpty) {
    throw const FacilityCadastroException('Arquivo vazio.');
  }

  final mime = contentType.trim().toLowerCase();
  final lowerName = fileName.toLowerCase();
  final isPdf = mime == 'application/pdf' || lowerName.endsWith('.pdf');
  final isImage =
      mime.startsWith('image/') ||
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.png') ||
      lowerName.endsWith('.webp') ||
      lowerName.endsWith('.heic') ||
      lowerName.endsWith('.heif');

  if (isPdf) {
    return FacilityCadastroFile(
      name: _safeFileName(fileName, fallback: 'documento.pdf'),
      bytes: raw,
      contentType: 'application/pdf',
    );
  }

  if (isImage) {
    return _normalizeImage(raw);
  }

  // Last resort: try image decode (covers odd MIME with image bytes).
  try {
    return await _normalizeImage(raw);
  } catch (error) {
    // The user-facing message stays the same, but the cause is not thrown
    // away: a decode failure and a genuinely unsupported container read
    // identically otherwise.
    throw FacilityCadastroException(
      'Formato não suportado. Use JPEG, PNG, WebP ou PDF. ($error)',
    );
  }
}

Future<FacilityCadastroFile> _normalizeImage(Uint8List raw) async {
  final decoded = await _decodeDownscaled(raw);

  // An already-small JPEG is passed through untouched: re-encoding it would
  // only add a generation of loss for no size win.
  if (decoded == null) {
    return FacilityCadastroFile(
      name: 'documento.jpg',
      bytes: raw,
      contentType: 'image/jpeg',
    );
  }

  final jpeg = await compute(_encodeJpegJob, decoded);

  // Re-encoding a PNG that needed no downscale (a screenshot, a flat scan) can
  // end up larger than the original; then the format change buys nothing and
  // the PNG is kept. This never applies to a resampled image — there the size
  // win comes from the pixels, not the container.
  if (!decoded.resampled && jpeg.length >= raw.length && _isPng(raw)) {
    return FacilityCadastroFile(
      name: 'documento.png',
      bytes: raw,
      contentType: 'image/png',
    );
  }

  return FacilityCadastroFile(
    name: 'documento.jpg',
    bytes: jpeg,
    contentType: 'image/jpeg',
  );
}

/// Decodes [raw] at (at most) [kCadastroMaxImageEdge] on the long edge.
///
/// Returns `null` when the input is already a JPEG within that bound — the
/// signal to skip re-encoding entirely.
Future<_RgbaFrame?> _decodeDownscaled(Uint8List raw) async {
  // The buffer backs the descriptor and the codec reads from it lazily, so
  // both must outlive `getNextFrame` — releasing them early makes a large
  // image fail with "Codec failed to produce an image" while a small one,
  // decoded synchronously, still works.
  final buffer = await ui.ImmutableBuffer.fromUint8List(raw);
  ui.ImageDescriptor? descriptor;
  ui.Codec? codec;
  ui.Image? image;
  try {
    descriptor = await ui.ImageDescriptor.encoded(buffer);
    final target = cadastroDecodeTarget(
      width: descriptor.width,
      height: descriptor.height,
    );
    if (target == null && _isJpeg(raw)) return null;

    codec = await descriptor.instantiateCodec(
      targetWidth: target?.width,
      targetHeight: target?.height,
    );
    image = (await codec.getNextFrame()).image;
    final data = await image.toByteData(format: ui.ImageByteFormat.rawRgba);
    if (data == null) {
      throw const FacilityCadastroException('Falha ao ler a imagem.');
    }
    return _RgbaFrame(
      // `rawRgba` is premultiplied; the encoder flattens it onto white.
      premultipliedRgba: data.buffer.asUint8List(
        data.offsetInBytes,
        data.lengthInBytes,
      ),
      width: image.width,
      height: image.height,
      resampled: target != null,
    );
  } finally {
    image?.dispose();
    codec?.dispose();
    descriptor?.dispose();
    buffer.dispose();
  }
}

/// One decoded frame on its way to the JPEG encoder in a background isolate —
/// encoding a 2048 px page is hundreds of milliseconds the UI isolate should
/// not spend (spec 0011 §4.2).
class _RgbaFrame {
  const _RgbaFrame({
    required this.premultipliedRgba,
    required this.width,
    required this.height,
    required this.resampled,
  });

  final Uint8List premultipliedRgba;
  final int width;
  final int height;

  /// Whether the decoder shrank the image, as opposed to decoding it natively.
  final bool resampled;
}

/// Decode dimensions that bring the long edge down to [maxLongEdge].
///
/// `null` means "decode at native size" — an image already within the bound is
/// never upscaled, and only one axis is constrained so the decoder keeps the
/// aspect ratio. Passing `targetWidth` unconditionally, as the PNG path did,
/// stretched portrait photos back up to 2048 wide.
@visibleForTesting
({int? width, int? height})? cadastroDecodeTarget({
  required int width,
  required int height,
  int maxLongEdge = kCadastroMaxImageEdge,
}) {
  if (width <= 0 || height <= 0) return null;
  if (width <= maxLongEdge && height <= maxLongEdge) return null;
  return width >= height
      ? (width: maxLongEdge, height: null)
      : (width: null, height: maxLongEdge);
}

Uint8List _encodeJpegJob(_RgbaFrame frame) => encodeCadastroJpeg(
  premultipliedRgba: frame.premultipliedRgba,
  width: frame.width,
  height: frame.height,
);

/// Encodes premultiplied RGBA as JPEG, flattening transparency onto white.
///
/// JPEG has no alpha channel, so a transparent region has to become *some*
/// colour. Left premultiplied it becomes black, which turns a logo's
/// background into a blot on an otherwise white document.
@visibleForTesting
Uint8List encodeCadastroJpeg({
  required Uint8List premultipliedRgba,
  required int width,
  required int height,
  int quality = kCadastroJpegQuality,
}) {
  final pixelCount = width * height;
  final rgb = Uint8List(pixelCount * 3);
  for (var i = 0; i < pixelCount; i++) {
    final src = i * 4;
    final alpha = premultipliedRgba[src + 3];
    // Premultiplied channel c = C*a/255; composited over white this is
    // c + (255 - a), which is exact and needs no division.
    final white = 255 - alpha;
    final dst = i * 3;
    rgb[dst] = premultipliedRgba[src] + white;
    rgb[dst + 1] = premultipliedRgba[src + 1] + white;
    rgb[dst + 2] = premultipliedRgba[src + 2] + white;
  }
  final image = img.Image.fromBytes(
    width: width,
    height: height,
    bytes: rgb.buffer,
    numChannels: 3,
    order: img.ChannelOrder.rgb,
  );
  return img.encodeJpg(image, quality: quality);
}

bool _isJpeg(Uint8List bytes) =>
    bytes.length > 3 &&
    bytes[0] == 0xFF &&
    bytes[1] == 0xD8 &&
    bytes[2] == 0xFF;

bool _isPng(Uint8List bytes) =>
    bytes.length > 8 &&
    bytes[0] == 0x89 &&
    bytes[1] == 0x50 &&
    bytes[2] == 0x4E &&
    bytes[3] == 0x47;

String _safeFileName(String name, {required String fallback}) {
  final trimmed = name.trim();
  if (trimmed.isEmpty) return fallback;
  final cleaned = trimmed
      .replaceAll(RegExp(r'[^A-Za-z0-9._-]+'), '_')
      .replaceAll(RegExp(r'_+'), '_');
  if (cleaned.isEmpty || cleaned == '.' || cleaned == '..') return fallback;
  return cleaned.length > 120
      ? cleaned.substring(cleaned.length - 120)
      : cleaned;
}
