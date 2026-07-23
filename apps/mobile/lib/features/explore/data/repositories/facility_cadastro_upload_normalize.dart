import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_cadastro_repository.dart';

/// Normalizes a picked Cadastro file for API upload:
/// - images → PNG with a safe ASCII filename (fixes HEIC / empty / odd MIME)
/// - PDF → bytes as-is with sanitized filename
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
  final isImage = mime.startsWith('image/') ||
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
    final pngBytes = await _encodePng(raw);
    return FacilityCadastroFile(
      name: 'documento.png',
      bytes: pngBytes,
      contentType: 'image/png',
    );
  }

  // Last resort: try image decode (covers odd MIME with image bytes).
  try {
    final pngBytes = await _encodePng(raw);
    return FacilityCadastroFile(
      name: 'documento.png',
      bytes: pngBytes,
      contentType: 'image/png',
    );
  } catch (_) {
    throw const FacilityCadastroException(
      'Formato não suportado. Use JPEG, PNG, WebP ou PDF.',
    );
  }
}

Future<Uint8List> _encodePng(Uint8List bytes) async {
  final codec = await ui.instantiateImageCodec(bytes, targetWidth: 2048);
  final frame = await codec.getNextFrame();
  final image = frame.image;
  try {
    final data = await image.toByteData(format: ui.ImageByteFormat.png);
    if (data == null) {
      throw StateError('png encode failed');
    }
    return data.buffer.asUint8List();
  } finally {
    image.dispose();
  }
}

String _safeFileName(String name, {required String fallback}) {
  final trimmed = name.trim();
  if (trimmed.isEmpty) return fallback;
  final cleaned = trimmed
      .replaceAll(RegExp(r'[^A-Za-z0-9._-]+'), '_')
      .replaceAll(RegExp(r'_+'), '_');
  if (cleaned.isEmpty || cleaned == '.' || cleaned == '..') return fallback;
  return cleaned.length > 120 ? cleaned.substring(cleaned.length - 120) : cleaned;
}
