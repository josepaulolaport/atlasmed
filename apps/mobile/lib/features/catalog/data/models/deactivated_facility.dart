import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

/// A clinic that was deactivated, as listed in `Administração › Clínicas
/// desativadas` (spec 0016 §4.8).
///
/// Deactivation is a soft delete: `facilities.deactivated_at` is set, the search
/// document is removed, and every read in the app filters the row out. That
/// makes this list the only place a deactivated clinic can be seen at all —
/// `GET /facilities/:id` hides them too.
class DeactivatedFacility {
  const DeactivatedFacility({
    required this.id,
    required this.name,
    required this.deactivatedAt,
    this.city,
    this.state,
    this.legalDocument,
    this.legalDocumentType,
    this.cnesCode,
    this.blockedByFacilityId,
  });

  final int id;
  final String name;
  final DateTime? deactivatedAt;
  final String? city;
  final String? state;
  final String? legalDocument;
  final String? legalDocumentType;
  final String? cnesCode;

  /// The active clinic that took this one's CNPJ while it was away.
  ///
  /// A CNPJ is unique only among active clinics, so reactivating would trip
  /// that index. The list says so up front rather than letting the admin find
  /// out by pressing the button.
  final int? blockedByFacilityId;

  bool get isBlocked => blockedByFacilityId != null;

  /// "Santo André · SP", or whichever half is known.
  String get location =>
      [city, state].where((part) => (part ?? '').isNotEmpty).join(' · ');

  factory DeactivatedFacility.fromJson(Map<String, dynamic> json) {
    String? readOptional(Object? value) {
      final text = value is String ? value.trim() : null;
      return (text == null || text.isEmpty) ? null : text;
    }

    return DeactivatedFacility(
      id: readCrmId(json['id'], 'id'),
      name: (json['name'] as String?)?.trim() ?? 'Sem nome',
      deactivatedAt: DateTime.tryParse(json['deactivatedAt'] as String? ?? ''),
      city: readOptional(json['city']),
      state: readOptional(json['state']),
      legalDocument: readOptional(json['legalDocument']),
      legalDocumentType: readOptional(json['legalDocumentType']),
      cnesCode: readOptional(json['cnesCode']),
      blockedByFacilityId: json['blockedByFacilityId'] == null
          ? null
          : readCrmId(json['blockedByFacilityId'], 'blockedByFacilityId'),
    );
  }
}
