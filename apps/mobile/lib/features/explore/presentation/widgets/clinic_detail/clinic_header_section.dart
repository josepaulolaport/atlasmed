import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/features/explore/data/clinic_detail.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/filter_data.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/contact_actions.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_photo_viewer_screen.dart';

/// Fixed (non-scrolling) blue header — identity block, inline sinais chips
/// and full address. Rendered above the scrollable section list, not inside
/// it, so it stays pinned on screen while the rest of the page scrolls.
class ClinicHeaderSection extends StatelessWidget {
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
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    final signals = sections?.statusSignals;
    final specialties = sections?.specialtiesLabel;
    final fullAddress =
        sections?.location?.formattedAddress ??
        (detail.streetAddress != null
            ? '${detail.streetAddress} — ${detail.neighborhood}'
            : null);
    final taxIdType = sections?.taxIdType;
    final phone = sections?.phone ?? detail.phone;
    final whatsapp = sections?.whatsapp ?? detail.whatsapp;
    final email = sections?.email ?? detail.email;
    final phoneLabel = formatBrazilianPhone(phone) ?? phone;
    final whatsappLabel = formatBrazilianPhone(whatsapp) ?? whatsapp;

    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(8, top + 4, 8, 18),
      decoration: const BoxDecoration(
        color: Color(0xFF1e40af),
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
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                onPressed: () => context.pop(),
              ),
              IconButton(
                icon: const Icon(
                  Icons.bookmark_border_rounded,
                  color: Colors.white,
                ),
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Favoritos — em breve'),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                },
              ),
            ],
          ),
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
                      onTap: () => _openPhotos(context),
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
                      _SignalChip(
                        category: 'Status',
                        label: signals.commercialStatus.label,
                        dotColor: signals.commercialStatus.color,
                      ),
                      _SignalChip(
                        category: 'Compra',
                        label: signals.purchaseStatus.label,
                        dotColor: signals.purchaseStatus.color,
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

  void _openPhotos(BuildContext context) {
    final photos = sections?.photos;
    if (photos == null || photos.count == 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Nenhuma foto cadastrada'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) =>
            ClinicPhotoViewerScreen(facilityName: detail.name, photos: photos),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.name, this.taxIdType, this.onTap});

  final String name;
  final FacilityTaxIdType? taxIdType;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
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
              decoration: const BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(
                  _initials(name),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1e40af),
                  ),
                ),
              ),
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
                  border: Border.all(color: const Color(0xFF1e40af), width: 2),
                ),
                child: Center(
                  child: Icon(
                    taxIdType!.icon,
                    size: 11,
                    color: const Color(0xFF1e40af),
                  ),
                ),
              ),
            ),
        ],
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
