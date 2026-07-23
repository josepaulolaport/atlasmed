import 'dart:io';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

/// Builds a multipage PDF — one photo per page — so the viewer can swipe
/// sideways like a normal gallery (instead of a tall stacked PNG).
Future<File> mergeRegistrationImagesToPdf(
  List<String> imagePaths, {
  double maxEdge = 2000,
}) async {
  if (imagePaths.isEmpty) {
    throw ArgumentError('imagePaths must not be empty');
  }
  if (imagePaths.length == 1) {
    return File(imagePaths.single);
  }

  final doc = pw.Document();

  for (final path in imagePaths) {
    final bytes = await File(path).readAsBytes();
    final codec = await ui.instantiateImageCodec(bytes);
    final frame = await codec.getNextFrame();
    final image = frame.image;
    try {
      final srcW = image.width.toDouble();
      final srcH = image.height.toDouble();
      final scale = math.min(1.0, maxEdge / math.max(srcW, srcH));
      final pageW = srcW * scale;
      final pageH = srcH * scale;

      // Re-encode to PNG so `pdf` can embed reliably (incl. HEIC→decoded).
      final pngBytes = await image.toByteData(format: ui.ImageByteFormat.png);
      if (pngBytes == null) {
        throw StateError('Failed to encode page image');
      }
      final memory = pw.MemoryImage(pngBytes.buffer.asUint8List());

      doc.addPage(
        pw.Page(
          pageFormat: PdfPageFormat(pageW, pageH),
          margin: pw.EdgeInsets.zero,
          build: (_) => pw.Image(memory, fit: pw.BoxFit.contain),
        ),
      );
    } finally {
      image.dispose();
    }
  }

  final out = File(
    '${Directory.systemTemp.path}/cadastro_doc_${DateTime.now().millisecondsSinceEpoch}.pdf',
  );
  await out.writeAsBytes(await doc.save(), flush: true);
  return out;
}

/// True when [path] looks like a raster image we can merge/preview.
bool isMergeableImagePath(String path) {
  final lower = path.toLowerCase();
  return lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.png') ||
      lower.endsWith('.webp') ||
      lower.endsWith('.heic') ||
      lower.endsWith('.heif');
}
