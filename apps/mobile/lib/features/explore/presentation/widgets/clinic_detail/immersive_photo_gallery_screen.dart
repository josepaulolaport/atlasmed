import 'package:dismissible_page/dismissible_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:photo_view/photo_view.dart';
import 'package:photo_view/photo_view_gallery.dart';

/// iOS Photos–style gallery: one image per page, swipe sideways, pinch zoom,
/// swipe down to dismiss.
class ImmersivePhotoGalleryScreen extends StatefulWidget {
  const ImmersivePhotoGalleryScreen({
    super.key,
    required this.title,
    required this.providers,
    this.initialIndex = 0,
    this.placeholderBuilder,
  });

  final String title;
  final List<ImageProvider?> providers;
  final int initialIndex;

  /// Built when [providers][i] is null (e.g. mock clinic slots).
  final Widget Function(BuildContext context, int index)? placeholderBuilder;

  @override
  State<ImmersivePhotoGalleryScreen> createState() =>
      _ImmersivePhotoGalleryScreenState();
}

class _ImmersivePhotoGalleryScreenState
    extends State<ImmersivePhotoGalleryScreen> {
  late final PageController _pageController;
  late int _index;
  bool _chromeVisible = true;
  bool _isZoomed = false;

  @override
  void initState() {
    super.initState();
    _index = widget.initialIndex.clamp(0, widget.providers.length - 1);
    _pageController = PageController(initialPage: _index);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _setZoomed(bool zoomed) {
    if (zoomed == _isZoomed || !mounted) return;
    setState(() {
      _isZoomed = zoomed;
      if (zoomed) _chromeVisible = false;
    });
  }

  void _toggleChrome() {
    setState(() => _chromeVisible = !_chromeVisible);
  }

  PhotoViewScaleState _iosScaleStateCycle(PhotoViewScaleState actual) {
    switch (actual) {
      case PhotoViewScaleState.initial:
      case PhotoViewScaleState.zoomedOut:
        return PhotoViewScaleState.zoomedIn;
      case PhotoViewScaleState.zoomedIn:
      case PhotoViewScaleState.covering:
      case PhotoViewScaleState.originalSize:
        return PhotoViewScaleState.initial;
    }
  }

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.paddingOf(context).top;
    final count = widget.providers.length;
    final showCounter = count > 1;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: DismissiblePage(
        onDismissed: () => Navigator.of(context).pop(),
        direction: DismissiblePageDismissDirection.vertical,
        isFullScreen: true,
        backgroundColor: Colors.black,
        startingOpacity: 1,
        minScale: 0.85,
        maxRadius: 0,
        minRadius: 0,
        dragSensitivity: 1,
        disabled: _isZoomed,
        dismissThresholds: const {
          DismissiblePageDismissDirection.vertical: 0.18,
          DismissiblePageDismissDirection.down: 0.18,
          DismissiblePageDismissDirection.up: 0.18,
        },
        onDragStart: () {
          if (_chromeVisible) setState(() => _chromeVisible = false);
        },
        child: Stack(
          fit: StackFit.expand,
          children: [
            PhotoViewGallery.builder(
              pageController: _pageController,
              itemCount: count,
              backgroundDecoration: const BoxDecoration(
                color: Colors.transparent,
              ),
              scrollPhysics: const BouncingScrollPhysics(),
              onPageChanged: (i) {
                setState(() {
                  _index = i;
                  _isZoomed = false;
                });
              },
              scaleStateChangedCallback: (state) {
                final zoomed =
                    state != PhotoViewScaleState.initial &&
                    state != PhotoViewScaleState.zoomedOut;
                _setZoomed(zoomed);
              },
              loadingBuilder: (context, event) => const Center(
                child: CircularProgressIndicator(color: Colors.white54),
              ),
              builder: (context, index) {
                final provider = widget.providers[index];
                if (provider == null) {
                  return PhotoViewGalleryPageOptions.customChild(
                    child:
                        widget.placeholderBuilder?.call(context, index) ??
                        const Center(
                          child: Icon(
                            Icons.photo_rounded,
                            size: 72,
                            color: Color(0x4DFFFFFF),
                          ),
                        ),
                    minScale: PhotoViewComputedScale.contained,
                    maxScale: PhotoViewComputedScale.contained,
                    disableGestures: true,
                    onTapUp: (_, _, _) => _toggleChrome(),
                  );
                }
                return PhotoViewGalleryPageOptions(
                  imageProvider: provider,
                  minScale: PhotoViewComputedScale.contained,
                  maxScale: PhotoViewComputedScale.covered * 4,
                  initialScale: PhotoViewComputedScale.contained,
                  basePosition: Alignment.center,
                  filterQuality: FilterQuality.high,
                  scaleStateCycle: _iosScaleStateCycle,
                  onTapUp: (_, _, _) => _toggleChrome(),
                  errorBuilder: (_, _, _) => const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.broken_image_outlined,
                          size: 48,
                          color: Colors.white54,
                        ),
                        SizedBox(height: 12),
                        Text(
                          'Não foi possível carregar a imagem',
                          style: TextStyle(color: Colors.white70, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
            IgnorePointer(
              ignoring: !_chromeVisible,
              child: AnimatedOpacity(
                opacity: _chromeVisible ? 1 : 0,
                duration: const Duration(milliseconds: 180),
                child: Stack(
                  children: [
                    Align(
                      alignment: Alignment.topCenter,
                      child: Container(
                        width: double.infinity,
                        padding: EdgeInsets.fromLTRB(4, topInset + 2, 8, 14),
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [Color(0x99000000), Color(0x00000000)],
                          ),
                        ),
                        child: Row(
                          children: [
                            IconButton(
                              onPressed: () => Navigator.of(context).pop(),
                              icon: const Icon(
                                Icons.close_rounded,
                                color: Colors.white,
                                size: 28,
                              ),
                            ),
                            Expanded(
                              child: widget.title.trim().isEmpty
                                  ? const SizedBox.shrink()
                                  : Text(
                                      widget.title,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      textAlign: TextAlign.center,
                                      style: const TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w600,
                                        color: Colors.white,
                                      ),
                                    ),
                            ),
                            const SizedBox(width: 48),
                          ],
                        ),
                      ),
                    ),
                    if (showCounter)
                      Positioned(
                        left: 0,
                        right: 0,
                        bottom: MediaQuery.paddingOf(context).bottom + 20,
                        child: Column(
                          children: [
                            Text(
                              '${_index + 1} / $count',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(height: 10),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: List.generate(count, (i) {
                                final active = i == _index;
                                return AnimatedContainer(
                                  duration: const Duration(milliseconds: 200),
                                  margin: const EdgeInsets.symmetric(
                                    horizontal: 3,
                                  ),
                                  width: active ? 18 : 6,
                                  height: 6,
                                  decoration: BoxDecoration(
                                    color: active
                                        ? Colors.white
                                        : const Color(0x66FFFFFF),
                                    borderRadius: BorderRadius.circular(3),
                                  ),
                                );
                              }),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Future<void> openImmersivePhotoGallery(
  BuildContext context, {
  required String title,
  required List<ImageProvider?> providers,
  int initialIndex = 0,
  Widget Function(BuildContext context, int index)? placeholderBuilder,
}) {
  if (providers.isEmpty) return Future.value();
  return context.pushTransparentRoute(
    ImmersivePhotoGalleryScreen(
      title: title,
      providers: providers,
      initialIndex: initialIndex,
      placeholderBuilder: placeholderBuilder,
    ),
    backgroundColor: Colors.black,
    transitionDuration: const Duration(milliseconds: 220),
    reverseTransitionDuration: const Duration(milliseconds: 180),
  );
}
