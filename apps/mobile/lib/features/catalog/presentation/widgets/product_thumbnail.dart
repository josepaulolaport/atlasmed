import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_blurhash/flutter_blurhash.dart';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// A product's picture at any size, falling back to the catalogue icon.
///
/// Shared by the admin list row and the edit form so an uploaded picture shows
/// up in the place the admin uploaded it *from*, not only inside the form.
///
/// Two details it exists to hold in one place:
///
/// - **The URL is a path.** `products.picture_url` names an object this API
///   serves (`/api/v1/products/pictures/...`), and the host is whichever
///   environment the build points at.
/// - **The bytes need the session token.** The download route sits behind
///   `read CATALOG`, so a plain `Image.network` would render a broken image.
class ProductThumbnail extends StatelessWidget {
  const ProductThumbnail({
    super.key,
    required this.pictureUrl,
    this.blurhash,
    this.size = 40,
    this.borderRadius = 10,
    this.placeholderIconSize = 20,
  });

  final String? pictureUrl;
  final String? blurhash;
  final double size;
  final double borderRadius;
  final double placeholderIconSize;

  static String absoluteUrl(String url) =>
      url.startsWith('http') ? url : '${AppConfig.apiBaseUrl}$url';

  @override
  Widget build(BuildContext context) {
    final url = pictureUrl?.trim();
    final hasImage = url != null && url.isNotEmpty;
    final hash = blurhash?.trim();
    final token = SessionEnvironment.instance.currentValue?.token;

    return Container(
      width: size,
      height: size,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: AppColors.surfaceSecondary,
        borderRadius: BorderRadius.circular(borderRadius),
      ),
      child: hasImage
          ? CachedNetworkImage(
              imageUrl: absoluteUrl(url),
              httpHeaders: token == null
                  ? null
                  : {'Authorization': 'Bearer $token'},
              fit: BoxFit.cover,
              placeholder: (_, _) => hash == null || hash.isEmpty
                  ? const ColoredBox(color: AppColors.surfaceSecondary)
                  : BlurHash(hash: hash),
              errorWidget: (_, _, _) => Icon(
                Icons.broken_image_outlined,
                size: placeholderIconSize,
                color: AppColors.gray400,
              ),
            )
          : Icon(
              Icons.medical_services_outlined,
              size: placeholderIconSize,
              color: AppColors.navyDeep,
            ),
    );
  }
}
