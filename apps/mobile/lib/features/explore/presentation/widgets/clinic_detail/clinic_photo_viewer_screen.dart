import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/immersive_photo_gallery_screen.dart';

/// Full-screen, sideways-swipeable photo gallery for the establishment header.
Future<void> openClinicPhotoViewer(
  BuildContext context, {
  required String facilityName,
  required PhotoGallerySummary photos,
  int initialIndex = 0,
}) {
  final count = photos.count;
  if (count <= 0) return Future.value();

  final urls = photos.imageUrls;
  final token = SessionEnvironment.instance.currentValue?.token;
  final authHeaders = token == null
      ? null
      : {'Authorization': 'Bearer $token'};

  final providers = List<ImageProvider?>.generate(count, (i) {
    final url = i < urls.length ? urls[i] : null;
    if (url == null || url.isEmpty) return null;
    final absolute = url.startsWith('http')
        ? url
        : '${AppConfig.apiBaseUrl}$url';
    return NetworkImage(absolute, headers: authHeaders);
  });

  return openImmersivePhotoGallery(
    context,
    title: facilityName,
    providers: providers,
    initialIndex: initialIndex,
    placeholderBuilder: (context, i) {
      final colors = photos.thumbnailColors;
      final color = colors.isEmpty
          ? const Color(0xFF1f2937)
          : colors[i % colors.length];
      return ColoredBox(
        color: color,
        child: const Center(
          child: Icon(
            Icons.photo_rounded,
            size: 72,
            color: Color(0x4DFFFFFF),
          ),
        ),
      );
    },
  );
}
