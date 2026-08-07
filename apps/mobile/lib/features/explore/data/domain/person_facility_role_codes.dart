/// Facility-scoped person role codes (ADR 0004 §5.12 seed).
///
/// Prefer catalog names from `GET /person-facility-roles` in UI.
/// [fallbackName] matches seed pt-BR when catalog is unavailable.
abstract final class PersonFacilityRoleCodes {
  static const partner = 'PARTNER';
  static const prescriber = 'PRESCRIBER';
  static const buyer = 'BUYER';
  static const decisionMaker = 'DECISION_MAKER';
  static const administrator = 'ADMINISTRATOR';
  static const biller = 'BILLER';
  static const secretary = 'SECRETARY';

  static const fallbackNames = <String, String>{
    partner: 'Parceiro',
    prescriber: 'Prescritor',
    buyer: 'Comprador',
    decisionMaker: 'Decisor',
    administrator: 'Administrador',
    biller: 'Faturamento',
    secretary: 'Secretário(a)',
  };

  static String fallbackName(String code) =>
      fallbackNames[code.toUpperCase()] ?? code;

  static Set<String> normalize(Iterable<String> codes) =>
      codes.map((c) => c.toUpperCase()).toSet();

  static List<String> sortedList(Iterable<String> codes) {
    final list = normalize(codes).toList()..sort();
    return list;
  }
}

/// Catalog row from `GET /api/v1/person-facility-roles`.
class PersonFacilityRoleCatalogEntry {
  const PersonFacilityRoleCatalogEntry({
    required this.code,
    required this.name,
  });

  final String code;
  final String name;

  factory PersonFacilityRoleCatalogEntry.fromMap(Map<String, dynamic> map) {
    return PersonFacilityRoleCatalogEntry(
      code: (map['code'] as String).toUpperCase(),
      name: (map['name'] as String).trim(),
    );
  }
}
