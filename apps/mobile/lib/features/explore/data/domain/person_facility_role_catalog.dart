/// Catalog row from `GET /api/v1/person-facility-roles`.
///
/// Wire contract: `{ id, name, isActive }` — no `code`.
class PersonFacilityRoleCatalogEntry {
  const PersonFacilityRoleCatalogEntry({
    required this.id,
    required this.name,
    this.isActive = true,
  });

  final int id;
  final String name;
  final bool isActive;

  factory PersonFacilityRoleCatalogEntry.fromMap(Map<String, dynamic> map) {
    final id = map['id'];
    if (id is! num) {
      throw FormatException(
        'Expected person-facility-role id number, got ${id.runtimeType}',
      );
    }
    final name = (map['name'] as String?)?.trim() ?? '';
    final isActive = map['isActive'] as bool? ?? true;
    return PersonFacilityRoleCatalogEntry(
      id: id.toInt(),
      name: name,
      isActive: isActive,
    );
  }
}

/// Thin helpers for person-facility role ids + catalog labels.
abstract final class PersonFacilityRoleCatalog {
  static List<int> sortedIds(Iterable<int> ids) {
    final list = ids.toSet().toList()..sort();
    return list;
  }

  /// Catalog display names for [roleIds] (unknown ids omitted).
  static List<String> labelsFor(
    Iterable<int> roleIds,
    Iterable<PersonFacilityRoleCatalogEntry> catalog,
  ) {
    final byId = {for (final e in catalog) e.id: e};
    final labels = <String>[];
    for (final id in sortedIds(roleIds)) {
      final entry = byId[id];
      if (entry != null && entry.name.isNotEmpty) {
        labels.add(entry.name);
      }
    }
    return labels;
  }

  static List<PersonFacilityRoleCatalogEntry> activeEntries(
    Iterable<PersonFacilityRoleCatalogEntry> catalog,
  ) => catalog
      .where((e) => e.isActive && e.name.isNotEmpty)
      .toList(growable: false);

  static List<String> activeNames(
    Iterable<PersonFacilityRoleCatalogEntry> catalog,
  ) {
    final names = activeEntries(catalog).map((e) => e.name).toList();
    names.sort();
    return names;
  }

  /// Role ids whose catalog [name] is in [names].
  static Set<int> idsForNames(
    Iterable<String> names,
    Iterable<PersonFacilityRoleCatalogEntry> catalog,
  ) {
    final needles = names.toSet();
    return catalog
        .where((e) => needles.contains(e.name))
        .map((e) => e.id)
        .toSet();
  }
}

/// Session cache of `GET /person-facility-roles` for id→name helpers.
///
/// Starts empty; replaced when the catalog repository loads live rows.
/// Empty catalog is valid (no synthetic fallback roles).
abstract final class PersonFacilityRoleCatalogCache {
  static List<PersonFacilityRoleCatalogEntry> _entries =
      const <PersonFacilityRoleCatalogEntry>[];

  static List<PersonFacilityRoleCatalogEntry> get entries => _entries;

  static void replace(List<PersonFacilityRoleCatalogEntry> next) {
    _entries = List<PersonFacilityRoleCatalogEntry>.unmodifiable(next);
  }

  static void resetForTest() {
    _entries = const <PersonFacilityRoleCatalogEntry>[];
  }
}
