import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/core/user/role_capability_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/data/clinic_detail.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/filter_data.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/contact_actions.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_photos_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_photo_viewer_screen.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Fixed (non-scrolling) blue header — identity block, inline sinais chips
/// and full address. Rendered above the scrollable section list, not inside
/// it, so it stays pinned on screen while the rest of the page scrolls.
class ClinicHeaderSection extends ConsumerWidget {
  const ClinicHeaderSection({
    super.key,
    required this.detail,
    required this.sections,
  });

  final ClinicDetail detail;

  /// Nullable while the mocked sections provider is still loading — the
  /// header degrades gracefully to identity + address only in that case.
  final EstablishmentDetailSections? sections;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final top = MediaQuery.of(context).padding.top;
    final photos =
        ref.watch(facilityPhotosProvider(detail.id)).valueOrNull ??
        sections?.photos;
    final uploading = ref
        .watch(facilityPhotoUploadProvider(detail.id))
        .isLoading;
    ref.listen<AsyncValue<void>>(facilityPhotoUploadProvider(detail.id), (
      previous,
      next,
    ) {
      if (next.hasError) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(next.error.toString()),
            behavior: SnackBarBehavior.floating,
          ),
        );
        return;
      }
      if (previous?.isLoading == true && next is AsyncData) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Foto adicionada'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    });
    // Prefer live commercial/conformity from facility DTO. Purchase is only
    // shown when the API (or an explicit section payload) provides it.
    final sectionSignals = sections?.statusSignals;
    final liveCommercial = parseFacilityCommercialStatus(
      detail.commercialStatus,
    );
    final liveConformity = parseFacilityConformityStatus(
      detail.conformityStatus,
    );
    final signals =
        sectionSignals == null &&
            liveCommercial == null &&
            liveConformity == null
        ? null
        : FacilityStatusSignals(
            commercialStatus:
                liveCommercial ??
                sectionSignals?.commercialStatus ??
                FacilityCommercialStatus.registered,
            purchaseStatus: sectionSignals?.purchaseStatus,
            conformityStatus:
                liveConformity ??
                sectionSignals?.conformityStatus ??
                FacilityConformityStatus.incomplete,
            lastPurchaseAt: sectionSignals?.lastPurchaseAt,
          );
    final specialties = sections?.specialtiesLabel;
    // Identity / contact / address / PF-PJ prefer the live facility DTO.
    final fullAddress = detail.formattedAddress;
    final taxIdType = parseFacilityTaxIdType(detail.taxIdType);
    final phone = _nonEmpty(detail.phone);
    final whatsapp = _nonEmpty(detail.whatsapp);
    final email = _nonEmpty(detail.email);
    final phoneLabel = formatBrazilianPhone(phone) ?? phone;
    final whatsappLabel = formatBrazilianPhone(whatsapp) ?? whatsapp;

    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(16, top + 4, 16, 18),
      decoration: const BoxDecoration(
        color: AppColors.navyBright,
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(24),
          bottomRight: Radius.circular(24),
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0x261e3a8a),
            blurRadius: 14,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _Avatar(
                      name: detail.name,
                      taxIdType: taxIdType,
                      imageUrl:
                          photos?.profileImageUrl ??
                          (photos?.imageUrls.isNotEmpty == true
                              ? photos!.imageUrls.first
                              : null),
                      uploading: uploading,
                      onTap: () => _showPhotoActions(context, ref, photos),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            detail.name,
                            style: const TextStyle(
                              fontSize: 19,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                              letterSpacing: -0.3,
                            ),
                          ),
                          if (specialties != null) ...[
                            const SizedBox(height: 3),
                            Text(
                              specialties,
                              style: const TextStyle(
                                fontSize: 12.5,
                                color: Color(0xCCFFFFFF),
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                          if (taxIdType != null) ...[
                            const SizedBox(height: 3),
                            Text(
                              'Estabelecimento ${taxIdType.label}',
                              style: const TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w500,
                                color: Color(0xB3FFFFFF),
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    if (signals != null) ...[
                      FacilityCommercialStatusChip(
                        status: signals.commercialStatus,
                      ),
                      if (signals.purchaseStatus != null)
                        _SignalChip(
                          category: 'Compra',
                          label: signals.purchaseStatus!.label,
                          dotColor: signals.purchaseStatus!.color,
                        ),
                    ] else
                      _SignalChip(
                        category: 'Status',
                        label: detail.status.label,
                        dotColor: detail.status.color,
                      ),
                  ],
                ),
                if (fullAddress != null) ...[
                  const SizedBox(height: 12),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(
                        Icons.location_on_rounded,
                        size: 14,
                        color: Color(0xB3FFFFFF),
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          fullAddress,
                          style: const TextStyle(
                            fontSize: 12.5,
                            color: Color(0xE6FFFFFF),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
                if (phone != null || whatsapp != null || email != null) ...[
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 14,
                    runSpacing: 6,
                    children: [
                      if (phoneLabel != null)
                        _HeaderContactAction(
                          icon: Icons.phone_rounded,
                          label: phoneLabel,
                          onTap: () => launchContactUrl(
                            context,
                            url: callUrl(phone),
                            contactLabel: 'telefone',
                          ),
                        ),
                      if (whatsappLabel != null)
                        _HeaderContactAction(
                          icon: Icons.chat_rounded,
                          label: whatsappLabel,
                          onTap: () => launchContactUrl(
                            context,
                            url: whatsappUrl(whatsapp),
                            contactLabel: 'WhatsApp',
                          ),
                        ),
                      if (email != null)
                        _HeaderContactAction(
                          icon: Icons.mail_rounded,
                          label: email,
                          onTap: () => launchContactUrl(
                            context,
                            url: emailUrl(email),
                            contactLabel: 'e-mail',
                          ),
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _showPhotoActions(
    BuildContext context,
    WidgetRef ref,
    PhotoGallerySummary? photos,
  ) async {
    final hasPhotos = photos != null && photos.count > 0;
    final isMock =
        detail.id.startsWith('near-') || detail.id.endsWith(':empty');
    final canUpload = !isMock && ref.read(canMutateFacilityProvider);

    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (hasPhotos)
              ListTile(
                leading: const Icon(Icons.photo_library_outlined),
                title: Text('Ver fotos (${photos.count})'),
                onTap: () {
                  Navigator.pop(sheetContext);
                  _openViewer(context, photos);
                },
              ),
            if (canUpload) ...[
              ListTile(
                leading: const Icon(Icons.photo_camera_outlined),
                title: const Text('Tirar foto'),
                onTap: () {
                  Navigator.pop(sheetContext);
                  ref
                      .read(facilityPhotoUploadProvider(detail.id).notifier)
                      .pickAndUpload(ImageSource.camera);
                },
              ),
              ListTile(
                leading: const Icon(Icons.image_outlined),
                title: const Text('Escolher da galeria'),
                onTap: () {
                  Navigator.pop(sheetContext);
                  ref
                      .read(facilityPhotoUploadProvider(detail.id).notifier)
                      .pickAndUpload(ImageSource.gallery);
                },
              ),
            ],
            if (!hasPhotos && !canUpload)
              const ListTile(
                leading: Icon(Icons.info_outline),
                title: Text('Nenhuma foto cadastrada'),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  void _openViewer(BuildContext context, PhotoGallerySummary photos) {
    openClinicPhotoViewer(context, facilityName: detail.name, photos: photos);
  }

  static String? _nonEmpty(String? value) {
    final trimmed = value?.trim();
    return trimmed == null || trimmed.isEmpty ? null : trimmed;
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({
    required this.name,
    this.taxIdType,
    this.imageUrl,
    this.uploading = false,
    this.onTap,
  });

  final String name;
  final FacilityTaxIdType? taxIdType;
  final String? imageUrl;
  final bool uploading;
  final VoidCallback? onTap;

  String _absoluteUrl(String url) =>
      url.startsWith('http') ? url : '${AppConfig.apiBaseUrl}$url';

  @override
  Widget build(BuildContext context) {
    final token = SessionEnvironment.instance.currentValue?.token;
    final url = imageUrl?.trim();
    final hasImage = url != null && url.isNotEmpty;

    return Semantics(
      button: true,
      label: 'Fotos da clínica',
      child: GestureDetector(
        onTap: uploading ? null : onTap,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: 56,
              height: 56,
              padding: const EdgeInsets.all(2),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0x4DFFFFFF), width: 2),
              ),
              child: Container(
                clipBehavior: Clip.antiAlias,
                decoration: const BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                ),
                child: hasImage
                    ? CachedNetworkImage(
                        imageUrl: _absoluteUrl(url),
                        httpHeaders: token == null
                            ? null
                            : {'Authorization': 'Bearer $token'},
                        fit: BoxFit.cover,
                        width: 52,
                        height: 52,
                        errorWidget: (_, _, _) => _Initials(name: name),
                      )
                    : _Initials(name: name),
              ),
            ),
            if (taxIdType != null)
              Positioned(
                bottom: -2,
                right: -2,
                child: Container(
                  width: 20,
                  height: 20,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: const AppColors.navyBright,
                      width: 2,
                    ),
                  ),
                  child: Center(
                    child: Icon(
                      taxIdType!.icon,
                      size: 11,
                      color: const AppColors.navyBright,
                    ),
                  ),
                ),
              ),
            Positioned(
              top: -2,
              right: -2,
              child: Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  color: const AppColors.navyBright,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 1.5),
                ),
                child: uploading
                    ? const Padding(
                        padding: EdgeInsets.all(4),
                        child: CircularProgressIndicator(
                          strokeWidth: 1.8,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(
                        Icons.camera_alt_outlined,
                        size: 12,
                        color: Colors.white,
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Initials extends StatelessWidget {
  const _Initials({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        _initials(name),
        style: const TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w700,
          color: AppColors.navyBright,
        ),
      ),
    );
  }

  String _initials(String value) {
    final parts = value.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return value.isNotEmpty ? value[0].toUpperCase() : '?';
  }
}

class _SignalChip extends StatelessWidget {
  const _SignalChip({
    required this.category,
    required this.label,
    required this.dotColor,
  });

  /// Short legend naming what this chip's dot/value represents, e.g.
  /// "Status", "Compra" — shown muted before the value so the pill reads
  /// as "categoria: valor" instead of a bare status word with no context.
  final String category;
  final String label;
  final Color dotColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0x26FFFFFF),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Flexible(
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: '$category: ',
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w500,
                      color: Color(0xB3FFFFFF),
                    ),
                  ),
                  TextSpan(
                    text: label,
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

class _HeaderContactAction extends StatelessWidget {
  const _HeaderContactAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: const Color(0xCCFFFFFF)),
          const SizedBox(width: 5),
          // `Wrap` still bounds each child to its own max width, so a long
          // e-mail without a shrink/ellipsis path can overflow this Row.
          Flexible(
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: Color(0xE6FFFFFF),
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}
