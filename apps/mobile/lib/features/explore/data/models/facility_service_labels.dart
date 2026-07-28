import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';

/// CNES service display helpers — title-case labels + ortho/derm priority.
class FacilityServiceLabels {
  FacilityServiceLabels._();

  /// Prefer CNES services; if empty, fall back to vertical profile names
  /// (many Orto/Derm clinics have no `facility_services` rows).
  static List<ClinicService> resolveDisplayServices({
    required List<ClinicService> services,
    List<FacilityVerticalProfileDTO> verticalProfiles = const [],
  }) {
    final named = services
        .where((s) => s.serviceName.trim().isNotEmpty)
        .toList(growable: false);
    if (named.isNotEmpty) return named;

    return verticalProfiles
        .where((v) => v.verticalName.trim().isNotEmpty)
        .map(
          (v) => ClinicService(
            serviceCode: (v.verticalCode ?? v.verticalId).trim(),
            classificationCode: '',
            serviceName: v.verticalName.trim(),
          ),
        )
        .toList(growable: false);
  }

  /// Strip leading "SERVICO DE ", collapse spaces, title-case (pt-BR-ish).
  static String formatName(String raw) {
    var text = raw.trim();
    if (text.isEmpty) return text;

    text = text.replaceFirst(
      RegExp(r'^servi[cç]o\s+de\s+', caseSensitive: false),
      '',
    );
    text = text.replaceAll(RegExp(r'\s+'), ' ').trim();
    if (text.isEmpty) return raw.trim();

    final lower = text.toLowerCase();
    final parts = lower.split(' ');
    const small = {
      'de',
      'da',
      'do',
      'das',
      'dos',
      'e',
      'em',
      'a',
      'o',
      'as',
      'os',
      'ao',
      'aos',
      'ou',
    };

    final out = <String>[];
    for (var i = 0; i < parts.length; i++) {
      final word = parts[i];
      if (word.isEmpty) continue;
      if (i > 0 && small.contains(word)) {
        out.add(word);
        continue;
      }
      out.add('${word[0].toUpperCase()}${word.substring(1)}');
    }
    return out.join(' ');
  }

  static int priorityRank({
    required String serviceCode,
    required String serviceName,
  }) {
    final code = serviceCode.trim();
    final name = _fold(serviceName);
    // AtlasMed vertical specialty codes (see API priority-facility-services).
    if (code == 'AM-ORTOPEDIA') return 0;
    if (code == 'AM-DERMATOLOGIA') return 1;
    if (code == '155' ||
        name.contains('ortopedia') ||
        name.contains('traumatologia')) {
      return 0;
    }
    if (name.contains('dermatolog')) return 1;
    return 50;
  }

  static List<ClinicService> prioritize(List<ClinicService> services) {
    final copy = List<ClinicService>.from(services);
    copy.sort((a, b) {
      final rank =
          priorityRank(
            serviceCode: a.serviceCode,
            serviceName: a.serviceName,
          ) -
          priorityRank(
            serviceCode: b.serviceCode,
            serviceName: b.serviceName,
          );
      if (rank != 0) return rank;
      return formatName(a.serviceName).compareTo(formatName(b.serviceName));
    });
    return copy;
  }

  /// Primary chip label + overflow count for explore cards.
  static ({String? label, int overflow}) chipSummary(
    List<ClinicService> services,
  ) {
    if (services.isEmpty) return (label: null, overflow: 0);
    final ordered = prioritize(services);
    return (
      label: formatName(ordered.first.serviceName),
      overflow: ordered.length - 1,
    );
  }

  static String _fold(String value) {
    const map = {
      'á': 'a',
      'à': 'a',
      'â': 'a',
      'ã': 'a',
      'ä': 'a',
      'é': 'e',
      'è': 'e',
      'ê': 'e',
      'ë': 'e',
      'í': 'i',
      'ì': 'i',
      'î': 'i',
      'ï': 'i',
      'ó': 'o',
      'ò': 'o',
      'ô': 'o',
      'õ': 'o',
      'ö': 'o',
      'ú': 'u',
      'ù': 'u',
      'û': 'u',
      'ü': 'u',
      'ç': 'c',
    };
    final lower = value.toLowerCase();
    final buffer = StringBuffer();
    for (final rune in lower.runes) {
      final ch = String.fromCharCode(rune);
      buffer.write(map[ch] ?? ch);
    }
    return buffer.toString();
  }
}
