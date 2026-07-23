/// Soft identity check mirrored from `@atlasmed/access` person-name-match.
library;

const _particles = {
  'de',
  'da',
  'do',
  'dos',
  'das',
  'e',
  'di',
  'du',
  'del',
  'della',
  'van',
  'von',
};

String _stripAccents(String input) {
  const from = 'àáâãäåèéêëìíîïòóôõöùúûüçñÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÇÑ';
  const to = 'aaaaaaeeeeiiiiooooouuuucnAAAAAAEEEEIIIIOOOOOUUUUCN';
  final buffer = StringBuffer();
  for (final rune in input.runes) {
    final ch = String.fromCharCode(rune);
    final idx = from.indexOf(ch);
    buffer.write(idx >= 0 ? to[idx] : ch);
  }
  return buffer.toString();
}

List<String> tokenizePersonName(String name) {
  final normalized = _stripAccents(name)
      .toLowerCase()
      .replaceAll(RegExp(r'[^a-z0-9\s]'), ' ')
      .trim();
  if (normalized.isEmpty) return const [];
  return normalized
      .split(RegExp(r'\s+'))
      .where((t) => t.length >= 2 && !_particles.contains(t))
      .toList();
}

bool _tokenMatches(String expected, String provided) {
  return expected == provided ||
      (expected.length >= 3 && provided.contains(expected)) ||
      (provided.length >= 3 && expected.contains(provided));
}

/// At least half of expected tokens (min 1) must appear in provided name.
bool namesFuzzyMatch(String expectedFullName, String providedFullName) {
  final expected = tokenizePersonName(expectedFullName);
  final provided = tokenizePersonName(providedFullName);
  if (expected.isEmpty) return true;
  if (provided.isEmpty) return false;

  final matched = expected
      .where((exp) => provided.any((prov) => _tokenMatches(exp, prov)))
      .length;
  final required = expected.length <= 1 ? 1 : (expected.length / 2).ceil();
  return matched >= required;
}

String formatBirthDateIso(DateTime date) {
  final y = date.year.toString().padLeft(4, '0');
  final m = date.month.toString().padLeft(2, '0');
  final d = date.day.toString().padLeft(2, '0');
  return '$y-$m-$d';
}
