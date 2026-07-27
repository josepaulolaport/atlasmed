import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:pdfrx/pdfrx.dart';
import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/immersive_photo_gallery_screen.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Stable generated download/share name:
/// `{document_type}_v{version}_{submitted_user}_{yyyyMMdd_HHmm}[_pN].{ext}`
String buildCadastroDocumentFileName({
  required String documentType,
  required int version,
  required String submittedBy,
  required DateTime submittedAt,
  int pageIndex = 1,
  String extension = 'png',
}) {
  final type = _slugToken(documentType, fallback: 'documento');
  final user = _slugToken(submittedBy, fallback: 'usuario');
  final y = submittedAt.year.toString().padLeft(4, '0');
  final m = submittedAt.month.toString().padLeft(2, '0');
  final d = submittedAt.day.toString().padLeft(2, '0');
  final hh = submittedAt.hour.toString().padLeft(2, '0');
  final mm = submittedAt.minute.toString().padLeft(2, '0');
  final ext = extension.replaceAll('.', '').toLowerCase();
  final safeExt = ext.isEmpty ? 'bin' : ext;
  final stamp = '$y$m${d}_$hh$mm';
  final base = '${type}_v${version}_${user}_$stamp';
  if (pageIndex > 1) return '${base}_p$pageIndex.$safeExt';
  return '$base.$safeExt';
}

String _slugToken(String raw, {required String fallback}) {
  var s = raw.trim().toLowerCase();
  const from = 'àáâãäåæçèéêëìíîïñòóôõöùúûüýÿ';
  const to = 'aaaaaaaceeeeiiiinooooouuuuyy';
  for (var i = 0; i < from.length; i++) {
    s = s.replaceAll(from[i], to[i]);
  }
  s = s
      .replaceAll(RegExp(r'[^a-z0-9]+'), '_')
      .replaceAll(RegExp(r'_+'), '_')
      .replaceAll(RegExp(r'^_|_$'), '');
  return s.isEmpty ? fallback : s;
}

String extensionFromMimeOrName({String? mimeType, String? fileName}) {
  final mime = mimeType?.toLowerCase() ?? '';
  if (mime == 'application/pdf') return 'pdf';
  if (mime == 'image/jpeg' || mime == 'image/jpg') return 'jpg';
  if (mime == 'image/png') return 'png';
  if (mime == 'image/webp') return 'webp';
  final name = (fileName ?? '').toLowerCase();
  final dot = name.lastIndexOf('.');
  if (dot > 0 && dot < name.length - 1) {
    return name.substring(dot + 1);
  }
  return 'bin';
}

/// One page in a Cadastro document preview carousel (image or PDF file).
class CadastroPreviewPage {
  const CadastroPreviewPage({
    required this.id,
    required this.fileName,
    this.mimeType,
    this.localPath,
    this.remoteUrl,
  });

  final String id;

  /// Generated name for gallery chrome / share — not shown in the carousel UI.
  final String fileName;
  final String? mimeType;
  final String? localPath;
  final String? remoteUrl;

  bool get isPdf {
    final mime = mimeType?.toLowerCase() ?? '';
    if (mime == 'application/pdf') return true;
    return fileName.toLowerCase().endsWith('.pdf');
  }

  bool get isImage {
    final mime = mimeType?.toLowerCase() ?? '';
    if (mime.startsWith('image/')) return true;
    final name = fileName.toLowerCase();
    return name.endsWith('.jpg') ||
        name.endsWith('.jpeg') ||
        name.endsWith('.png') ||
        name.endsWith('.webp') ||
        name.endsWith('.heic') ||
        name.endsWith('.gif');
  }
}

/// Horizontal carousel of Cadastro pages (peek neighbors, expand on tap).
class CadastroDocumentPagesPreview extends StatefulWidget {
  const CadastroDocumentPagesPreview({
    super.key,
    required this.pages,
    this.resolveUrl,
    this.height = 220,
    this.emptyLabel = 'Nenhum arquivo para visualizar',
  });

  final List<CadastroPreviewPage> pages;
  final Future<String> Function(String fileId)? resolveUrl;
  final double height;
  final String emptyLabel;

  @override
  State<CadastroDocumentPagesPreview> createState() =>
      _CadastroDocumentPagesPreviewState();
}

class _CadastroDocumentPagesPreviewState
    extends State<CadastroDocumentPagesPreview> {
  late PageController _controller;
  int _index = 0;
  final Map<String, String> _urlCache = {};
  bool _expanding = false;

  @override
  void initState() {
    super.initState();
    _controller = PageController();
  }

  @override
  void didUpdateWidget(covariant CadastroDocumentPagesPreview oldWidget) {
    super.didUpdateWidget(oldWidget);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<String?> _urlFor(CadastroPreviewPage page) async {
    final existing = page.remoteUrl?.trim();
    if (existing != null && existing.isNotEmpty) return existing;
    final cached = _urlCache[page.id];
    if (cached != null) return cached;
    final resolve = widget.resolveUrl;
    if (resolve == null) return null;
    final url = await resolve(page.id);
    _urlCache[page.id] = url;
    return url;
  }

  /// Expand gallery:
  /// - image → all image files in this submission (swipe between them)
  /// - PDF → pages of every PDF in this submission (swipe across files/pages)
  Future<void> _expandAt(int index, {int initialPage = 0}) async {
    if (_expanding || widget.pages.isEmpty) return;
    setState(() => _expanding = true);
    try {
      final safeIndex = index.clamp(0, widget.pages.length - 1);
      final page = widget.pages[safeIndex];
      final List<ImageProvider?> providers;
      var galleryIndex = initialPage;

      if (page.isPdf) {
        final pdfFiles = widget.pages
            .where((p) => p.isPdf)
            .toList(growable: false);
        final loaded = <ImageProvider?>[];
        var startAt = 0;
        for (final pdf in pdfFiles) {
          final batch = await resolveCadastroFileProviders(
            pdf,
            resolveUrl: widget.resolveUrl,
            urlCache: _urlCache,
          );
          if (batch.isEmpty) continue;
          if (pdf.id == page.id) {
            startAt = loaded.length + initialPage.clamp(0, batch.length - 1);
          }
          loaded.addAll(batch);
        }
        providers = loaded;
        galleryIndex = startAt;
      } else {
        final imageFiles = widget.pages
            .where((p) => !p.isPdf)
            .toList(growable: false);
        final loaded = <ImageProvider?>[];
        var startAt = 0;
        for (final image in imageFiles) {
          final batch = await resolveCadastroFileProviders(
            image,
            resolveUrl: widget.resolveUrl,
            urlCache: _urlCache,
          );
          if (batch.isEmpty) continue;
          if (image.id == page.id) startAt = loaded.length;
          loaded.add(batch.first);
        }
        providers = loaded;
        galleryIndex = startAt;
      }

      if (!mounted) return;
      if (providers.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Não foi possível abrir a visualização'),
            behavior: SnackBarBehavior.floating,
          ),
        );
        return;
      }
      await openImmersivePhotoGallery(
        context,
        title: '',
        providers: providers,
        initialIndex: galleryIndex.clamp(0, providers.length - 1),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Não foi possível abrir a visualização'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _expanding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.pages.isEmpty) {
      return _PreviewStage(
        height: widget.height,
        child: Center(
          child: Text(
            widget.emptyLabel,
            style: const TextStyle(fontSize: 13, color: AppColors.gray400),
          ),
        ),
      );
    }

    final count = widget.pages.length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _PreviewStage(
          height: widget.height,
          child: PageView.builder(
            controller: _controller,
            itemCount: count,
            onPageChanged: (i) => setState(() => _index = i),
            itemBuilder: (context, i) {
              final page = widget.pages[i];
              return page.isPdf
                  ? _PdfFileCard(
                      page: page,
                      resolveUrl: () => _urlFor(page),
                      busy: _expanding,
                      onExpand: (pdfPage) => _expandAt(i, initialPage: pdfPage),
                    )
                  : _ImageFileCard(
                      page: page,
                      resolveUrl: () => _urlFor(page),
                      busy: _expanding,
                      onExpand: () => _expandAt(i),
                    );
            },
          ),
        ),
        if (count > 1) ...[
          const SizedBox(height: 10),
          Center(
            child: _CarouselPager(
              index: _index,
              count: count,
              label: _fileCounterLabel(widget.pages, _index),
            ),
          ),
        ],
      ],
    );
  }
}

/// Contained preview frame — inset with the surrounding content, not screen-bleed.
class _PreviewStage extends StatelessWidget {
  const _PreviewStage({required this.height, required this.child});

  final double height;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: const AppColors.gray900,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const AppColors.gray900),
        ),
        child: ClipRRect(borderRadius: BorderRadius.circular(14), child: child),
      ),
    );
  }
}

String _fileCounterLabel(List<CadastroPreviewPage> pages, int index) {
  final page = pages[index];
  final kind = page.isPdf ? 'PDF' : 'imagem';
  return '${index + 1} de ${pages.length} · $kind';
}

class _ImageFileCard extends StatelessWidget {
  const _ImageFileCard({
    required this.page,
    required this.resolveUrl,
    required this.onExpand,
    required this.busy,
  });

  final CadastroPreviewPage page;
  final Future<String?> Function() resolveUrl;
  final VoidCallback onExpand;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const AppColors.gray900,
      elevation: 0,
      shadowColor: Colors.transparent,
      child: Stack(
        fit: StackFit.expand,
        children: [
          InkWell(
            onTap: busy ? null : onExpand,
            child: _RemoteOrLocalImage(page: page, resolveUrl: resolveUrl),
          ),
          Positioned(
            top: 10,
            right: 10,
            child: _FullscreenButton(busy: busy, onTap: onExpand),
          ),
        ],
      ),
    );
  }
}

/// One uploaded PDF = one outer card; pages scroll inside that card.
class _PdfFileCard extends StatefulWidget {
  const _PdfFileCard({
    required this.page,
    required this.resolveUrl,
    required this.onExpand,
    required this.busy,
  });

  final CadastroPreviewPage page;
  final Future<String?> Function() resolveUrl;
  final void Function(int pageIndex) onExpand;
  final bool busy;

  @override
  State<_PdfFileCard> createState() => _PdfFileCardState();
}

class _PdfFileCardState extends State<_PdfFileCard> {
  late Future<List<ImageProvider?>> _pagesFuture;
  int _pageIndex = 0;

  @override
  void initState() {
    super.initState();
    _pagesFuture = _load();
  }

  @override
  void didUpdateWidget(covariant _PdfFileCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.page.id != widget.page.id ||
        oldWidget.page.remoteUrl != widget.page.remoteUrl ||
        oldWidget.page.localPath != widget.page.localPath) {
      _pagesFuture = _load();
      _pageIndex = 0;
    }
  }

  Future<List<ImageProvider?>> _load() {
    return resolveCadastroFileProviders(
      widget.page,
      resolveUrl: (_) async {
        final url = await widget.resolveUrl();
        if (url == null || url.isEmpty) {
          throw StateError('URL do PDF indisponível');
        }
        return url;
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const AppColors.gray900,
      elevation: 0,
      shadowColor: Colors.transparent,
      child: FutureBuilder<List<ImageProvider?>>(
        future: _pagesFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return Stack(
              fit: StackFit.expand,
              children: [
                const Center(
                  child: SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white70,
                    ),
                  ),
                ),
                Positioned(
                  top: 10,
                  right: 10,
                  child: _FullscreenButton(busy: true, onTap: () {}),
                ),
              ],
            );
          }
          final pages = snapshot.data ?? const <ImageProvider?>[];
          if (pages.isEmpty) {
            return Stack(
              fit: StackFit.expand,
              children: [
                InkWell(
                  onTap: widget.busy ? null : () => widget.onExpand(0),
                  child: const Center(
                    child: Icon(
                      Icons.picture_as_pdf_rounded,
                      size: 52,
                      color: Color(0xFFf87171),
                    ),
                  ),
                ),
                Positioned(
                  top: 10,
                  right: 10,
                  child: _FullscreenButton(
                    busy: widget.busy,
                    onTap: () => widget.onExpand(0),
                  ),
                ),
              ],
            );
          }

          return Stack(
            fit: StackFit.expand,
            children: [
              // Vertical page scroll so horizontal swipes reach sibling files
              // in the outer carousel (nested horizontal PageViews fight).
              PageView.builder(
                scrollDirection: Axis.vertical,
                itemCount: pages.length,
                onPageChanged: (i) => setState(() => _pageIndex = i),
                itemBuilder: (context, i) {
                  final provider = pages[i];
                  return InkWell(
                    onTap: widget.busy ? null : () => widget.onExpand(i),
                    child: provider == null
                        ? const ColoredBox(
                            color: AppColors.gray800,
                            child: Center(
                              child: Icon(
                                Icons.broken_image_outlined,
                                color: AppColors.gray400,
                              ),
                            ),
                          )
                        : Image(
                            image: provider,
                            fit: BoxFit.contain,
                            width: double.infinity,
                            height: double.infinity,
                          ),
                  );
                },
              ),
              if (pages.length > 1)
                Positioned(
                  top: 10,
                  left: 10,
                  child: _GlassChip(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.swap_vert_rounded,
                          size: 14,
                          color: Colors.white,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          'PDF  ${_pageIndex + 1}/${pages.length}',
                          style: const TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.2,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              Positioned(
                top: 10,
                right: 10,
                child: _FullscreenButton(
                  busy: widget.busy,
                  onTap: () => widget.onExpand(_pageIndex),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _FullscreenButton extends StatelessWidget {
  const _FullscreenButton({required this.onTap, required this.busy});

  final VoidCallback onTap;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: busy ? null : onTap,
        borderRadius: BorderRadius.circular(12),
        child: Ink(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: const AppColors.gray900,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0x33FFFFFF)),
          ),
          child: Center(
            child: busy
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(
                    Icons.open_in_full_rounded,
                    size: 18,
                    color: Colors.white,
                  ),
          ),
        ),
      ),
    );
  }
}

class _GlassChip extends StatelessWidget {
  const _GlassChip({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const AppColors.gray900,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x33FFFFFF)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        child: child,
      ),
    );
  }
}

class _CarouselPager extends StatelessWidget {
  const _CarouselPager({
    required this.index,
    required this.count,
    required this.label,
  });

  final int index;
  final int count;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < count; i++) ...[
          if (i > 0) const SizedBox(width: 5),
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOutCubic,
            width: i == index ? 14 : 5,
            height: 5,
            decoration: BoxDecoration(
              color: i == index
                  ? const AppColors.navyBright
                  : const AppColors.gray300,
              borderRadius: BorderRadius.circular(99),
            ),
          ),
        ],
        const SizedBox(width: 10),
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: AppColors.gray400,
          ),
        ),
      ],
    );
  }
}

class _RemoteOrLocalImage extends StatefulWidget {
  const _RemoteOrLocalImage({required this.page, required this.resolveUrl});

  final CadastroPreviewPage page;
  final Future<String?> Function() resolveUrl;

  @override
  State<_RemoteOrLocalImage> createState() => _RemoteOrLocalImageState();
}

class _RemoteOrLocalImageState extends State<_RemoteOrLocalImage> {
  late Future<ImageProvider?> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  @override
  void didUpdateWidget(covariant _RemoteOrLocalImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.page.id != widget.page.id ||
        oldWidget.page.localPath != widget.page.localPath ||
        oldWidget.page.remoteUrl != widget.page.remoteUrl) {
      _future = _load();
    }
  }

  Future<ImageProvider?> _load() async {
    final local = widget.page.localPath?.trim();
    if (local != null && local.isNotEmpty) {
      final file = File(local);
      if (await file.exists()) return FileImage(file);
    }
    final url = await widget.resolveUrl();
    if (url == null || url.isEmpty) return null;
    final bytes = await _downloadBytes(url);
    return MemoryImage(bytes);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<ImageProvider?>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const ColoredBox(
            color: AppColors.gray100,
            child: Center(
              child: SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          );
        }
        final provider = snapshot.data;
        if (provider == null) {
          return const ColoredBox(
            color: AppColors.gray100,
            child: Center(
              child: Icon(
                Icons.broken_image_outlined,
                color: AppColors.gray400,
              ),
            ),
          );
        }
        return Image(
          image: provider,
          fit: BoxFit.cover,
          width: double.infinity,
          height: double.infinity,
          errorBuilder: (_, _, _) => const ColoredBox(
            color: AppColors.gray100,
            child: Center(
              child: Icon(
                Icons.broken_image_outlined,
                color: AppColors.gray400,
              ),
            ),
          ),
        );
      },
    );
  }
}

/// Resolve one uploaded file into gallery providers (1 image, or N PDF pages).
Future<List<ImageProvider?>> resolveCadastroFileProviders(
  CadastroPreviewPage page, {
  Future<String> Function(String fileId)? resolveUrl,
  Map<String, String>? urlCache,
}) async {
  try {
    String? url = page.remoteUrl?.trim();
    if (url == null || url.isEmpty) {
      url = urlCache?[page.id];
    }
    if ((url == null || url.isEmpty) && resolveUrl != null) {
      url = await resolveUrl(page.id);
      urlCache?[page.id] = url;
    }

    final local = page.localPath?.trim();
    if (local != null && local.isNotEmpty) {
      final file = File(local);
      if (await file.exists()) {
        if (page.isPdf) return await _pdfFileToProviders(local);
        return [FileImage(file)];
      }
    }

    if (url == null || url.isEmpty) return const [];
    final bytes = await _downloadBytes(url);
    if (page.isPdf || _bytesLookLikePdf(bytes)) {
      return await _pdfBytesToProviders(bytes, sourceName: page.fileName);
    }
    return [MemoryImage(bytes)];
  } catch (_) {
    return const [];
  }
}

Future<Uint8List> _downloadBytes(String url) async {
  final absolute = url.startsWith('http') ? url : '${AppConfig.apiBaseUrl}$url';
  final uri = Uri.parse(absolute);
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
  return bytes.length >= 4 &&
      bytes[0] == 0x25 &&
      bytes[1] == 0x50 &&
      bytes[2] == 0x44 &&
      bytes[3] == 0x46;
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
