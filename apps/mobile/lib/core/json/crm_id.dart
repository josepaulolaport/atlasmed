/// CRM entity ids are JSON numbers (DB bigint → API number).
///
/// Decode at wire edges only; domain models keep [int].
/// - [readCrmId] — strict API JSON (number only).
/// - [parseRouteCrmId] — GoRouter path segments (always String).
/// - [readCrmIdLoose] — Mapbox/GeoJSON property edges (num or digit String).
int readCrmId(Object? value, [String field = 'id']) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  throw FormatException(
    'Expected CRM id number for $field, got ${value.runtimeType}',
  );
}

int? readCrmIdOrNull(Object? value, [String field = 'id']) {
  if (value == null) return null;
  return readCrmId(value, field);
}

List<int> readCrmIdList(Object? value, [String field = 'ids']) {
  if (value == null) return const [];
  if (value is! List) {
    throw FormatException('Expected list of CRM ids for $field');
  }
  return value.map((e) => readCrmId(e, field)).toList(growable: false);
}

/// Parse a CRM id from a URL path segment (GoRouter [pathParameters]).
int parseRouteCrmId(String value, [String field = 'id']) {
  final parsed = int.tryParse(value);
  if (parsed == null) {
    throw FormatException(
      'Expected CRM id number in route for $field, got $value',
    );
  }
  return parsed;
}

int? parseRouteCrmIdOrNull(String? value, [String field = 'id']) {
  if (value == null || value.isEmpty) return null;
  return parseRouteCrmId(value, field);
}

/// Mapbox / GeoJSON — id may arrive as [num] or digit [String].
int? readCrmIdLoose(Object? value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value);
  return null;
}
