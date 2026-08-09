/// CRM entity ids are JSON numbers (DB bigint → API number).
///
/// Decode at wire edges only; domain models keep [int].
/// - [readCrmId] — API JSON: [num] or digit-only [String] (pg bigint[] quirk).
/// - [parseRouteCrmId] — GoRouter path segments (always String).
/// - [readCrmIdLoose] — Mapbox/GeoJSON property edges (num or digit String).
int readCrmId(Object? value, [String field = 'id']) {
  if (value is int) return value;
  if (value is num) {
    if (value != value.roundToDouble()) {
      throw FormatException(
        'Expected CRM id number for $field, got non-integral $value',
      );
    }
    return value.toInt();
  }
  // postgres.js / drizzle sometimes emit bigint array members as strings.
  if (value is String) {
    final parsed = int.tryParse(value);
    if (parsed != null) return parsed;
  }
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
///
/// Platform bridges often stringify ints as `"3.0"`; accept whole-number
/// decimals there (not for GoRouter path segments — use [parseRouteCrmId]).
int? readCrmIdLoose(Object? value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) {
    if (!value.isFinite || value != value.roundToDouble()) return null;
    return value.toInt();
  }
  if (value is String) {
    final asInt = int.tryParse(value);
    if (asInt != null) return asInt;
    final asNum = num.tryParse(value);
    if (asNum != null && asNum == asNum.roundToDouble()) {
      return asNum.toInt();
    }
  }
  return null;
}

/// Negative ids are mock-only facilities (nearby stack / empty state).
bool isMockFacilityId(int facilityId) => facilityId < 0;

bool isMockNearbyFacilityId(int facilityId) => facilityId < 0;

bool isMockEmptyFacilityId(int facilityId) => facilityId < 0;
