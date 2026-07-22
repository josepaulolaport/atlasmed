import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

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

Uri? emailUrl(String? email) {
  final normalizedEmail = email?.trim() ?? '';
  return normalizedEmail.isEmpty
      ? null
      : Uri(scheme: 'mailto', path: normalizedEmail);
}

enum _MapsApp { waze, googleMaps }

/// Candidate deep links for a maps app, native first then https fallback.
List<Uri> _mapsAppRouteUrls({
  required _MapsApp app,
  double? latitude,
  double? longitude,
  String? address,
}) {
  final hasCoords = latitude != null && longitude != null;
  final query = address?.trim() ?? '';
  if (!hasCoords && query.isEmpty) return const [];

  switch (app) {
    case _MapsApp.waze:
      if (hasCoords) {
        return [
          Uri(
            scheme: 'waze',
            queryParameters: {'ll': '$latitude,$longitude', 'navigate': 'yes'},
          ),
          Uri.https('waze.com', '/ul', {
            'll': '$latitude,$longitude',
            'navigate': 'yes',
          }),
        ];
      }
      return [
        Uri(scheme: 'waze', queryParameters: {'q': query, 'navigate': 'yes'}),
        Uri.https('waze.com', '/ul', {'q': query, 'navigate': 'yes'}),
      ];
    case _MapsApp.googleMaps:
      final destination = hasCoords ? '$latitude,$longitude' : query;
      return [
        Uri(
          scheme: 'comgooglemaps',
          queryParameters: {'daddr': destination, 'directionsmode': 'driving'},
        ),
        // Android Google Maps navigation scheme.
        if (hasCoords)
          Uri(scheme: 'google.navigation', queryParameters: {'q': destination}),
        Uri.https('www.google.com', '/maps/dir/', {
          'api': '1',
          'destination': destination,
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

  try {
    final wasLaunched = await launchUrl(url);
    if (!wasLaunched && context.mounted) {
      _showContactFeedback(context, 'Não foi possível abrir $contactLabel.');
    }
  } catch (_) {
    if (context.mounted) {
      _showContactFeedback(context, 'Não foi possível abrir $contactLabel.');
    }
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
                    color: const Color(0xFFd1d5db),
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
                  color: Color(0xFF0f1729),
                ),
              ),
              const SizedBox(height: 12),
              _MapsAppTile(
                label: 'Waze',
                icon: Icons.navigation_rounded,
                color: const Color(0xFF33CCFF),
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
          color: const Color(0xFFf8f9fb),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFe5e7eb)),
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
                  color: Color(0xFF0f1729),
                ),
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              size: 20,
              color: Color(0xFF9ca3af),
            ),
          ],
        ),
      ),
    );
  }
}
