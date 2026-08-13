/// Catalog row from `GET /api/v1/healthcare-specialties`.
///
/// Distinct from the specialty *names* the filter drawer uses: that list is
/// narrowed to what the doctors we hold actually practise, which is the wrong
/// list to choose from for a doctor who does not exist yet.
class HealthcareSpecialty {
  const HealthcareSpecialty({required this.id, required this.name});

  final int id;
  final String name;

  /// Returns null for a row it cannot make sense of, rather than throwing — one
  /// bad row must not cost the picker its other 65.
  static HealthcareSpecialty? tryFromMap(Object? raw) {
    if (raw is! Map) return null;
    final id = raw['id'];
    final name = raw['name'];
    if (id is! num || name is! String || name.trim().isEmpty) return null;
    return HealthcareSpecialty(id: id.toInt(), name: name.trim());
  }
}
