import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

String? normalizeBrazilianPhone(String? phone) {
  final digits = phone?.replaceAll(RegExp(r'\D'), '') ?? '';
  if (digits.isEmpty) {
    return null;
  }

  return digits.startsWith('55') ? digits : '55$digits';
}

/// Display mask for Brazilian numbers: `(11) 98765-4321` / `(11) 3040-5060`.
/// Returns the original trimmed string when the digit length is unexpected.
String? formatBrazilianPhone(String? phone) {
  final raw = phone?.trim();
  if (raw == null || raw.isEmpty) return null;

  var digits = raw.replaceAll(RegExp(r'\D'), '');
  if (digits.isEmpty) return raw;
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.substring(2);
  }

  if (digits.length == 11) {
    return '(${digits.substring(0, 2)}) ${digits.substring(2, 7)}-${digits.substring(7)}';
  }
  if (digits.length == 10) {
    return '(${digits.substring(0, 2)}) ${digits.substring(2, 6)}-${digits.substring(6)}';
  }
  return raw;
}

Uri? callUrl(String? phone) {
  final normalizedPhone = normalizeBrazilianPhone(phone);
  return normalizedPhone == null
      ? null
      : Uri(scheme: 'tel', path: normalizedPhone);
}

Uri? whatsappUrl(String? phone) {
  final normalizedPhone = normalizeBrazilianPhone(phone);
  return normalizedPhone == null
      ? null
      : Uri.https('wa.me', '/$normalizedPhone');
}

/// Ways to reach a conversation with [phone], the app itself first.
///
/// `https://wa.me/<number>` is the documented click-to-chat link, but it is a
/// *web* URL: `launchUrl` opens web URLs in an in-app browser by default, and a
/// universal link cannot hand off to WhatsApp from there. The rep landed on the
/// wa.me page with a "Continue to Chat" button — the app, one more tap away,
/// when they had already pressed WhatsApp. The custom scheme opens the
/// conversation directly, and the https link stays as the fallback for a phone
/// without WhatsApp installed.
@visibleForTesting
List<Uri> whatsappUrls(String? phone) {
  final normalizedPhone = normalizeBrazilianPhone(phone);
  if (normalizedPhone == null) return const [];
  return [
    // `whatsapp://send?...`. Built with an authority rather than a path: an
    // empty host puts a third slash in — `whatsapp:///send` — which iOS does
    // not match against the app's registered scheme.
    Uri(
      scheme: 'whatsapp',
      host: 'send',
      queryParameters: {'phone': normalizedPhone},
    ),
    Uri.https('wa.me', '/$normalizedPhone'),
  ];
}

Uri? emailUrl(String? email) {
  final normalizedEmail = email?.trim() ?? '';
  return normalizedEmail.isEmpty
      ? null
      : Uri(scheme: 'mailto', path: normalizedEmail);
}

enum _MapsApp { waze, googleMaps }

/// Candidate deep links for a maps app, native first then https fallback.
///
/// Coordinates win whenever we have them, and the address is what we fall back
/// to. It used to be the other way round — the address went in as `q` on Waze
/// and as `daddr` on Google even when coordinates were known — and that is not
/// a destination, it is a search term. Waze treats `q` as a search (`ll` only
/// biases where it looks), so the rep arrived at a result screen instead of a
/// route they could accept; and the strings we hold are CNES-shaped —
/// "AV MARACANA, 987 — RIO DE JANEIRO — RJ" — which is exactly the sort of
/// thing geocoding fumbles. A latitude and longitude cannot be misread.
@visibleForTesting
List<Uri> mapsAppRouteUrls({
  required String app,
  double? latitude,
  double? longitude,
  String? address,
}) {
  final mapsApp = switch (app) {
    'waze' => _MapsApp.waze,
    'googleMaps' => _MapsApp.googleMaps,
    _ => null,
  };
  if (mapsApp == null) return const [];
  return _mapsAppRouteUrls(
    app: mapsApp,
    latitude: latitude,
    longitude: longitude,
    address: address,
  );
}

List<Uri> _mapsAppRouteUrls({
  required _MapsApp app,
  double? latitude,
  double? longitude,
  String? address,
}) {
  final hasCoords = latitude != null && longitude != null;
  final query = address?.trim() ?? '';
  if (!hasCoords && query.isEmpty) return const [];

  final coordDestination = hasCoords ? '$latitude,$longitude' : null;
  final addressDestination = query.isNotEmpty ? query : null;
  // Coordinates first; the address only when there are none.
  final primary = coordDestination ?? addressDestination!;

  switch (app) {
    case _MapsApp.waze:
      // `ll` + navigate=yes routes straight to the point. `q` is only sent when
      // there is nothing to route to, because supplying both makes Waze search
      // for the text and ignore the pin.
      final params = <String, String>{'navigate': 'yes'};
      if (coordDestination != null) {
        params['ll'] = coordDestination;
      } else {
        params['q'] = addressDestination!;
      }
      return [
        // `waze://?...` — with an empty authority, not `waze:?...`. Both are
        // legal URIs; the documented one is the form the app registers.
        Uri(scheme: 'waze', host: '', queryParameters: params),
        Uri.https('waze.com', '/ul', params),
      ];
    case _MapsApp.googleMaps:
      final fallback = coordDestination != null ? addressDestination : null;
      return [
        Uri(
          scheme: 'comgooglemaps',
          host: '',
          queryParameters: {'daddr': primary, 'directionsmode': 'driving'},
        ),
        if (fallback != null)
          Uri(
            scheme: 'comgooglemaps',
            host: '',
            queryParameters: {'daddr': fallback, 'directionsmode': 'driving'},
          ),
        // Android Google Maps navigation scheme.
        Uri(
          scheme: 'google.navigation',
          host: '',
          queryParameters: {'q': primary},
        ),
        Uri.https('www.google.com', '/maps/dir/', {
          'api': '1',
          'destination': primary,
        }),
        if (fallback != null)
          Uri.https('www.google.com', '/maps/dir/', {
            'api': '1',
            'destination': fallback,
          }),
      ];
  }
}

Future<void> launchContactUrl(
  BuildContext context, {
  required Uri? url,
  required String contactLabel,
}) async {
  if (url == null) {
    _showContactFeedback(context, 'Não há $contactLabel cadastrado.');
    return;
  }

  // WhatsApp is reached through the app itself when it is installed; see
  // `whatsappUrls`. Everything else — tel:, mailto: — is a non-web scheme that
  // always leaves the app anyway.
  final candidates = url.host == 'wa.me'
      ? whatsappUrls(url.pathSegments.isEmpty ? null : url.pathSegments.first)
      : [url];

  for (final candidate in candidates) {
    try {
      final wasLaunched = await launchUrl(
        candidate,
        mode: LaunchMode.externalApplication,
      );
      if (wasLaunched) return;
    } catch (_) {
      // Not installed, or the scheme is unhandled: try the next one.
    }
  }

  if (context.mounted) {
    _showContactFeedback(context, 'Não foi possível abrir $contactLabel.');
  }
}

/// Lets the user pick Waze or Google Maps, then opens that app for directions.
Future<void> launchMapsRoute(
  BuildContext context, {
  double? latitude,
  double? longitude,
  String? address,
}) async {
  final hasCoords = latitude != null && longitude != null;
  final query = address?.trim() ?? '';
  if (!hasCoords && query.isEmpty) {
    _showContactFeedback(context, 'Localização não disponível para rota.');
    return;
  }

  final app = await showModalBottomSheet<_MapsApp>(
    context: context,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (sheetContext) {
      final bottom = MediaQuery.of(sheetContext).padding.bottom;
      return SafeArea(
        child: Padding(
          padding: EdgeInsets.fromLTRB(16, 10, 16, 12 + bottom),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.gray300,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              const Text(
                'Abrir rota com',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.gray900,
                ),
              ),
              const SizedBox(height: 12),
              _MapsAppTile(
                label: 'Waze',
                icon: Icons.navigation_rounded,
                color: AppColors.blueAccent,
                onTap: () => Navigator.of(sheetContext).pop(_MapsApp.waze),
              ),
              const SizedBox(height: 8),
              _MapsAppTile(
                label: 'Google Maps',
                icon: Icons.map_rounded,
                color: const Color(0xFF34A853),
                onTap: () =>
                    Navigator.of(sheetContext).pop(_MapsApp.googleMaps),
              ),
            ],
          ),
        ),
      );
    },
  );

  if (app == null || !context.mounted) return;

  final candidates = _mapsAppRouteUrls(
    app: app,
    latitude: latitude,
    longitude: longitude,
    address: address,
  );

  for (final url in candidates) {
    try {
      if (await canLaunchUrl(url)) {
        final launched = await launchUrl(
          url,
          mode: LaunchMode.externalApplication,
        );
        if (launched) return;
      }
    } catch (_) {
      // Try the next candidate.
    }
  }

  // Last resort: try launching without canLaunchUrl (some OEMs lie).
  for (final url in candidates) {
    try {
      final launched = await launchUrl(
        url,
        mode: LaunchMode.externalApplication,
      );
      if (launched) return;
    } catch (_) {
      // Try the next candidate.
    }
  }

  if (context.mounted) {
    _showContactFeedback(
      context,
      app == _MapsApp.waze
          ? 'Não foi possível abrir o Waze.'
          : 'Não foi possível abrir o Google Maps.',
    );
  }
}

void _showContactFeedback(BuildContext context, String message) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
  );
}

class _MapsAppTile extends StatelessWidget {
  const _MapsAppTile({
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.surfaceTertiary,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.gray200),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.gray900,
                ),
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              size: 20,
              color: AppColors.gray400,
            ),
          ],
        ),
      ),
    );
  }
}
