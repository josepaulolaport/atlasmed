import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';

/// Full-screen, swipeable photo viewer opened by tapping the establishment
/// avatar in the header. Uses live [PhotoGallerySummary.imageUrls] when
/// present; otherwise falls back to colored placeholders (mock).
class ClinicPhotoViewerScreen extends StatefulWidget {
  const ClinicPhotoViewerScreen({
    super.key,
    required this.facilityName,
    required this.photos,
    this.initialIndex = 0,
  });

  final String facilityName;
  final PhotoGallerySummary photos;
  final int initialIndex;

  @override
  State<ClinicPhotoViewerScreen> createState() =>
      _ClinicPhotoViewerScreenState();
}

class _ClinicPhotoViewerScreenState extends State<ClinicPhotoViewerScreen> {
  late final PageController _controller;
  late int _index;

  @override
  void initState() {
    super.initState();
    _index = widget.initialIndex;
    _controller = PageController(initialPage: _index);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Color _colorAt(int i) {
    final colors = widget.photos.thumbnailColors;
    if (colors.isEmpty) return const Color(0xFF1f2937);
    return colors[i % colors.length];
  }

  String _absoluteUrl(String url) =>
      url.startsWith('http') ? url : '${AppConfig.apiBaseUrl}$url';

  @override
  Widget build(BuildContext context) {
    final count = widget.photos.count;
    final urls = widget.photos.imageUrls;
    final token = SessionEnvironment.instance.currentValue?.token;
    final authHeaders = token == null
        ? null
        : {'Authorization': 'Bearer $token'};

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          children: [
            PageView.builder(
              controller: _controller,
              itemCount: count,
              onPageChanged: (i) => setState(() => _index = i),
              itemBuilder: (_, i) {
                final url = i < urls.length ? urls[i] : null;
                if (url != null && url.isNotEmpty) {
                  return Padding(
                    padding: const EdgeInsets.all(16),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(20),
                      child: Image.network(
                        _absoluteUrl(url),
                        headers: authHeaders,
                        fit: BoxFit.contain,
                        errorBuilder: (_, _, _) =>
                            _PlaceholderCard(color: _colorAt(i)),
                        loadingBuilder: (context, child, progress) {
                          if (progress == null) return child;
                          return const Center(
                            child: CircularProgressIndicator(
                              color: Colors.white54,
                            ),
                          );
                        },
                      ),
                    ),
                  );
                }
                return _PlaceholderCard(color: _colorAt(i));
              },
            ),
            Positioned(
              top: 4,
              left: 4,
              child: IconButton(
                icon: const Icon(Icons.close_rounded, color: Colors.white),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ),
            Positioned(
              top: 12,
              left: 0,
              right: 0,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0x66000000),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    widget.facilityName,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ),
            Positioned(
              bottom: 24,
              left: 0,
              right: 0,
              child: Column(
                children: [
                  Text(
                    '${_index + 1} / $count',
                    style: const TextStyle(
                      fontSize: 12.5,
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
                        margin: const EdgeInsets.symmetric(horizontal: 3),
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
    );
  }
}

class _PlaceholderCard extends StatelessWidget {
  const _PlaceholderCard({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(20),
      ),
      child: const Center(
        child: Icon(Icons.photo_rounded, size: 72, color: Color(0x4DFFFFFF)),
      ),
    );
  }
}
