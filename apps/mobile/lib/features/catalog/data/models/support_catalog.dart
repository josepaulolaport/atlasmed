import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

/// One row of a support catalogue — the small reference lists the rest of the
/// app offers as pickers (spec 0016 §4.6).
///
/// The three share a shape: an id, a name, an active flag, and at most one extra
/// text field. One model rather than three, for the same reason the API has one
/// repository: they differ only in what that extra field is called.
class SupportCatalogEntry {
  const SupportCatalogEntry({
    required this.id,
    required this.name,
    required this.isActive,
    this.extra,
  });

  final int id;
  final String name;
  final bool isActive;

  /// The second column, when the table has one — a CNES code, an abbreviation.
  final String? extra;

  factory SupportCatalogEntry.fromJson(Map<String, dynamic> json) {
    // The API normalises `extra` to a string even where the column is a bigint
    // (`healthcare_specialties.cnes_id`). Reading a number here anyway costs one
    // line and turns a contract slip into a display quirk instead of a crash.
    final raw = json['extra'];
    final extra = switch (raw) {
      final String value => value.trim(),
      final num value => value.toString(),
      _ => null,
    };
    return SupportCatalogEntry(
      id: readCrmId(json['id'], 'id'),
      name: json['name'] as String,
      isActive: json['isActive'] as bool? ?? true,
      extra: (extra == null || extra.isEmpty) ? null : extra,
    );
  }
}

/// Which catalogue a screen is showing, and everything that differs between
/// them: the endpoint, the labels, and whether the extra field is required.
enum SupportCatalog {
  healthcareSpecialties(
    path: 'healthcare-specialties',
    title: 'Especialidades',
    singular: 'especialidade',
    feminine: true,
    // Optional since migration `0117`: the 66 imported rows carry a real CBO id
    // and a locally-created specialty simply has none. It was NOT NULL, which
    // made adding one mean inventing an official id.
    extraLabel: 'ID CNES',
    extraRequired: false,
  ),
  clinicalFocuses(
    path: 'facilities/clinical-focuses',
    title: 'Focos clínicos',
    singular: 'foco clínico',
    extraLabel: 'Código CNES',
    extraRequired: false,
  ),
  personFacilityRoles(
    path: 'person-facility-roles',
    title: 'Papéis na clínica',
    singular: 'papel',
  ),
  professionalCouncils(
    path: 'person-professional-registration-councils',
    title: 'Conselhos',
    singular: 'conselho',
    extraLabel: 'Sigla',
    extraRequired: true,
  );

  const SupportCatalog({
    required this.path,
    required this.title,
    required this.singular,
    this.feminine = false,
    this.extraLabel,
    this.extraRequired = false,
  });

  /// Whether [singular] is a feminine noun, so buttons read "Nova
  /// especialidade" rather than "Novo especialidade".
  final bool feminine;

  /// "Novo" or "Nova", agreeing with [singular].
  String get newLabel => feminine ? 'Nova $singular' : 'Novo $singular';

  /// The API segment, appended to `/api/v1/`.
  final String path;
  final String title;

  /// Used in the form title and the confirmation, e.g. "Novo foco clínico".
  final String singular;
  final String? extraLabel;
  final bool extraRequired;
}
