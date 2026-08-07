import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';

/// Clinical focus display helpers — title-case labels + ortho/derm priority.
class ClinicalFocusLabels {
  ClinicalFocusLabels._();

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

  static int priorityRank(String name) {
    final folded = _fold(name);
    if (folded.contains('ortopedia') || folded.contains('traumatologia')) {
      return 0;
    }
    if (folded.contains('dermatolog')) return 1;
    return 50;
  }

  static List<ClinicalFocus> prioritize(List<ClinicalFocus> focuses) {
    final copy = List<ClinicalFocus>.from(focuses);
    copy.sort((a, b) {
      final rank = priorityRank(a.name) - priorityRank(b.name);
      if (rank != 0) return rank;
      return formatName(a.name).compareTo(formatName(b.name));
    });
    return copy;
  }

  /// Primary chip label + overflow count for explore cards.
  static ({String? label, int overflow}) chipSummary(
    List<ClinicalFocus> focuses,
  ) {
    if (focuses.isEmpty) return (label: null, overflow: 0);
    final ordered = prioritize(focuses);
    return (
      label: formatName(ordered.first.name),
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
