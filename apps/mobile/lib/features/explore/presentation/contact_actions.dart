import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

String? normalizeBrazilianPhone(String? phone) {
  final digits = phone?.replaceAll(RegExp(r'\D'), '') ?? '';
  if (digits.isEmpty) {
    return null;
  }

  return digits.startsWith('55') ? digits : '55$digits';
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
