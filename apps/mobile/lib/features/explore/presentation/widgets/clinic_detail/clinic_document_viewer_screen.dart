import 'dart:io';
import 'dart:ui' as ui;

import 'package:dismissible_page/dismissible_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:pdfrx/pdfrx.dart';
import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/immersive_photo_gallery_screen.dart';

/// Immersive Cadastro attachment viewer.
///
/// Images and multipage PDFs open as a sideways, one-page-at-a-time gallery
/// (pinch / double-tap zoom, swipe down to dismiss).
class ClinicDocumentViewerScreen extends StatefulWidget {
  const ClinicDocumentViewerScreen({super.key, required this.document});

  final EstablishmentDocument document;

  @override
  State<ClinicDocumentViewerScreen> createState() =>
      _ClinicDocumentViewerScreenState();
}

class _ClinicDocumentViewerScreenState
    extends State<ClinicDocumentViewerScreen> {
  late Future<_ResolvedAttachment> _resolved;

  @override
  void initState() {
    super.initState();
    _resolved = _resolveAttachment(widget.document);
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.document.fileName ?? widget.document.title;

    return FutureBuilder<_ResolvedAttachment>(
      future: _resolved,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const AnnotatedRegion<SystemUiOverlayStyle>(
            value: SystemUiOverlayStyle.light,
            child: Scaffold(
              backgroundColor: Colors.black,
              body: Center(
                child: CircularProgressIndicator(color: Colors.white54),
              ),
            ),
          );
        }
        if (snapshot.hasError || !snapshot.hasData) {
          return AnnotatedRegion<SystemUiOverlayStyle>(
            value: SystemUiOverlayStyle.light,
            child: Scaffold(
              backgroundColor: Colors.black,
              appBar: AppBar(
                backgroundColor: Colors.black,
                foregroundColor: Colors.white,
                leading: IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ),
              body: const _ViewerFallback(
                icon: Icons.broken_image_outlined,
                message: 'Não foi possível abrir o documento',
              ),
            ),
          );
        }

        final resolved = snapshot.data!;
        return switch (resolved) {
          _ResolvedGallery(:final providers) => ImmersivePhotoGalleryScreen(
            title: title,
            providers: providers,
          ),
          _ResolvedUnsupported() => _UnsupportedScaffold(
            document: widget.document,
          ),
        };
      },
    );
  }
}

/// Opens a local file path in the same immersive viewer (compose preview).
Future<void> openLocalAttachmentViewer(
  BuildContext context, {
  required String path,
  required String fileName,
  String? mimeType,
}) {
  return context.pushTransparentRoute(
    ClinicDocumentViewerScreen(
      document: EstablishmentDocument(
        id: 'local-preview',
        title: fileName,
        description: '',
        status: EstablishmentDocumentStatus.missing,
        fileName: fileName,
        localPath: path,
        mimeType: mimeType,
      ),
    ),
    backgroundColor: Colors.black,
    transitionDuration: const Duration(milliseconds: 220),
    reverseTransitionDuration: const Duration(milliseconds: 180),
  );
}

/// Opens several local images as a sideways gallery (compose multi-photo).
Future<void> openLocalImageGallery(
  BuildContext context, {
  required String title,
  required List<String> paths,
  int initialIndex = 0,
}) {
  final providers = paths
      .map<ImageProvider?>((p) => FileImage(File(p)))
      .toList(growable: false);
  return openImmersivePhotoGallery(
    context,
    title: title,
    providers: providers,
    initialIndex: initialIndex,
  );
}

/// Prefer this when opening from a card (fade + swipe-down dismiss).
Future<void> openDocumentViewer(
  BuildContext context, {
  required EstablishmentDocument document,
}) {
  return context.pushTransparentRoute(
    ClinicDocumentViewerScreen(document: document),
    backgroundColor: Colors.black,
    transitionDuration: const Duration(milliseconds: 220),
    reverseTransitionDuration: const Duration(milliseconds: 180),
  );
}

sealed class _ResolvedAttachment {
  const _ResolvedAttachment();
}

class _ResolvedGallery extends _ResolvedAttachment {
  const _ResolvedGallery(this.providers);
  final List<ImageProvider?> providers;
}

class _ResolvedUnsupported extends _ResolvedAttachment {
  const _ResolvedUnsupported();
}

Future<_ResolvedAttachment> _resolveAttachment(
  EstablishmentDocument document,
) async {
  final localPath = document.localPath?.trim();
  final remoteUrl = document.remoteUrl?.trim();
  final isPdf = document.isPdf;
  final isImage = _looksLikeImage(
    fileName: document.fileName,
    mimeType: document.mimeType,
  );

  if (localPath != null && localPath.isNotEmpty) {
    final file = File(localPath);
    if (await file.exists()) {
      if (isPdf) {
        final providers = await _pdfFileToProviders(localPath);
        if (providers.isNotEmpty) return _ResolvedGallery(providers);
      }
      if (isImage) {
        return _ResolvedGallery([FileImage(file)]);
      }
    }
  }

  if (remoteUrl != null && remoteUrl.isNotEmpty) {
    final bytes = await _downloadAuthenticated(remoteUrl);
    final looksPdf = isPdf || _bytesLookLikePdf(bytes);
    final looksImage = isImage || _bytesLookLikeImage(bytes);
    if (looksPdf) {
      final providers = await _pdfBytesToProviders(
        bytes,
        sourceName: document.fileName ?? 'documento.pdf',
      );
      if (providers.isNotEmpty) return _ResolvedGallery(providers);
    }
    if (looksImage) {
      return _ResolvedGallery([MemoryImage(bytes)]);
    }
  }

  return const _ResolvedUnsupported();
}

Future<List<ImageProvider?>> _pdfFileToProviders(String path) async {
  final doc = await PdfDocument.openFile(path);
  try {
    return await _renderPdfPages(doc);
  } finally {
    doc.dispose();
  }
}

Future<List<ImageProvider?>> _pdfBytesToProviders(
  Uint8List bytes, {
  required String sourceName,
}) async {
  final doc = await PdfDocument.openData(bytes, sourceName: sourceName);
  try {
    return await _renderPdfPages(doc);
  } finally {
    doc.dispose();
  }
}

Future<List<ImageProvider?>> _renderPdfPages(PdfDocument doc) async {
  final providers = <ImageProvider?>[];
  for (final page in doc.pages) {
    final fullW = page.width * 2;
    final fullH = page.height * 2;
    final rendered = await page.render(
      width: fullW.round(),
      height: fullH.round(),
      fullWidth: fullW,
      fullHeight: fullH,
    );
    if (rendered == null) continue;
    try {
      final uiImage = await rendered.createImage();
      try {
        final png = await uiImage.toByteData(format: ui.ImageByteFormat.png);
        if (png != null) {
          providers.add(MemoryImage(png.buffer.asUint8List()));
        }
      } finally {
        uiImage.dispose();
      }
    } finally {
      rendered.dispose();
    }
  }
  return providers;
}

Future<Uint8List> _downloadAuthenticated(String url) async {
  final absolute = url.startsWith('http') ? url : '${AppConfig.apiBaseUrl}$url';
  final uri = Uri.parse(absolute);
  // Presigned S3/MinIO URLs reject extra Authorization headers (signature mismatch).
  final isPresigned = uri.queryParameters.keys.any(
    (k) =>
        k.toLowerCase() == 'x-amz-signature' ||
        k.toLowerCase() == 'x-amz-credential' ||
        k.toLowerCase() == 'signature',
  );
  final token = SessionEnvironment.instance.currentValue?.token;
  final response = await http.get(
    uri,
    headers: {
      if (!isPresigned && token != null && token.isNotEmpty)
        'Authorization': 'Bearer $token',
    },
  );
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw HttpException('Download failed (${response.statusCode})', uri: uri);
  }
  return response.bodyBytes;
}

bool _bytesLookLikePdf(Uint8List bytes) {
  return bytes.length >= 5 &&
      bytes[0] == 0x25 &&
      bytes[1] == 0x50 &&
      bytes[2] == 0x44 &&
      bytes[3] == 0x46;
}

bool _bytesLookLikeImage(Uint8List bytes) {
  if (bytes.length >= 3 &&
      bytes[0] == 0xff &&
      bytes[1] == 0xd8 &&
      bytes[2] == 0xff) {
    return true; // JPEG
  }
  if (bytes.length >= 8 &&
      bytes[0] == 0x89 &&
      bytes[1] == 0x50 &&
      bytes[2] == 0x4e &&
      bytes[3] == 0x47) {
    return true; // PNG
  }
  if (bytes.length >= 12 &&
      bytes[0] == 0x52 &&
      bytes[1] == 0x49 &&
      bytes[2] == 0x46 &&
      bytes[3] == 0x46 &&
      bytes[8] == 0x57 &&
      bytes[9] == 0x45 &&
      bytes[10] == 0x42 &&
      bytes[11] == 0x50) {
    return true; // WEBP
  }
  return false;
}

bool _looksLikeImage({String? fileName, String? mimeType}) {
  final mime = mimeType?.toLowerCase() ?? '';
  if (mime.startsWith('image/')) return true;
  final name = (fileName ?? '').toLowerCase();
  return name.endsWith('.jpg') ||
      name.endsWith('.jpeg') ||
      name.endsWith('.png') ||
      name.endsWith('.webp') ||
      name.endsWith('.heic') ||
      name.endsWith('.gif');
}

class _UnsupportedScaffold extends StatelessWidget {
  const _UnsupportedScaffold({required this.document});

  final EstablishmentDocument document;

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(
          backgroundColor: Colors.black,
          foregroundColor: Colors.white,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.close_rounded),
            onPressed: () => Navigator.of(context).pop(),
          ),
          title: Text(
            document.fileName ?? document.title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
          ),
        ),
        body: _UnsupportedCanvas(document: document),
      ),
    );
  }
}

class _UnsupportedCanvas extends StatelessWidget {
  const _UnsupportedCanvas({required this.document});

  final EstablishmentDocument document;

  @override
  Widget build(BuildContext context) {
    final isPdf = document.isPdf;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Expanded(
              child: Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  color: const Color(0xFF1e293b),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFF334155)),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      isPdf
                          ? Icons.picture_as_pdf_rounded
                          : Icons.insert_drive_file_rounded,
                      size: 48,
                      color: isPdf
                          ? const Color(0xFFb84545)
                          : const Color(0xFF93c5fd),
                    ),
                    const SizedBox(height: 16),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: Text(
                        document.fileName ?? document.title,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Pré-visualização indisponível para este tipo de arquivo.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13,
                        color: Colors.white.withValues(alpha: 0.55),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.of(context).pop(),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF1e40af),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text('Fechar'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ViewerFallback extends StatelessWidget {
  const _ViewerFallback({required this.icon, required this.message});

  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 48, color: Colors.white54),
          const SizedBox(height: 12),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white70, fontSize: 13),
          ),
        ],
      ),
    );
  }
}
