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

void _showContactFeedback(BuildContext context, String message) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
  );
}
