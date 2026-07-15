// Shared helper types and functions for the explore feature.
// Used by both [ClinicsRepository] and [DoctorsRepository].

class Pagination {
  const Pagination({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  factory Pagination.fromMap(Map<String, dynamic> map) {
    return Pagination(
      page: readInt(map['page']),
      limit: readInt(map['limit']),
      total: readInt(map['total']),
      totalPages: readInt(map['totalPages']),
    );
  }

  final int page;
  final int limit;
  final int total;
  final int totalPages;
}

/// Endpoint/query builder helpers for the explore feature.

Uri buildEndpoint({
  required String baseUrl,
  required String path,
  required Map<String, String> queryParameters,
}) {
  final base = Uri.parse(baseUrl);
  final basePath = base.path.endsWith('/')
      ? base.path.substring(0, base.path.length - 1)
      : base.path;

  return base.replace(path: '$basePath$path', queryParameters: queryParameters);
}

// ── Shared JSON parsing helpers ───────────────────────────────

List<Map<String, dynamic>> readObjectList(Object? value) {
  if (value is! List) {
    return const [];
  }
  return value
      .whereType<Map>()
      .map((item) => item.cast<String, dynamic>())
      .toList(growable: false);
}

List<String> readStringList(Object? value) {
  if (value is! List) {
    return const [];
  }
  return value.whereType<String>().toList(growable: false);
}

String readString(Object? value) => value?.toString() ?? '';

String? readNullableString(Object? value) {
  final stringValue = value?.toString();
  if (stringValue == null || stringValue.isEmpty) {
    return null;
  }
  return stringValue;
}

int readInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

double? readNullableDouble(Object? value) {
  if (value is double) return value;
  if (value is num) return value.toDouble();
  return double.tryParse(value?.toString() ?? '');
}

DateTime? readNullableDateTime(Object? value) {
  final stringValue = readNullableString(value);
  if (stringValue == null) {
    return null;
  }
  return DateTime.tryParse(stringValue);
}
