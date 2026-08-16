import 'package:atlasmed_mobile_app/core/json/crm_id.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/product_deletability.dart';

/// Which clinics a requirement applies to by legal document type.
///
/// Null on the wire means *all* of them — a requirement with no restriction.
enum RequirementLegalDocumentType {
  cnpj('CNPJ', 'Só CNPJ'),
  cpf('CPF', 'Só CPF');

  const RequirementLegalDocumentType(this.wire, this.label);

  final String wire;
  final String label;

  static RequirementLegalDocumentType? fromWire(String? value) {
    for (final type in RequirementLegalDocumentType.values) {
      if (type.wire == value) return type;
    }
    return null;
  }
}

/// One document the cadastro asks a clinic for (`conformity_requirements`).
///
/// This is the catalogue the whole cadastro pipeline reads: spec 0011 owns the
/// pipeline, spec 0016 §4.7 gives an admin the way to fill it. It was empty in
/// production, which is why no clinic had anything to submit.
///
/// **Creating an active requirement immediately makes every clinic in scope
/// non-conformant.** That is what [verticalId] and [appliesToLegalDocumentType]
/// are for, and why the form warns before saving one.
class ConformityRequirement {
  const ConformityRequirement({
    required this.id,
    required this.slug,
    required this.name,
    required this.isActive,
    this.description,
    this.verticalId,
    this.appliesToLegalDocumentType,
    this.allowedMimeTypes = const ['image/jpeg', 'image/png', 'application/pdf'],
    this.maxFiles = 10,
    this.maxFileSizeBytes = 52428800,
    this.maxCombinedSizeBytes = 209715200,
    this.requiresFrontAndBack = false,
    this.requiresValidityDate = false,
    this.deletability,
  });

  final int id;

  /// The stable key every cadastro DTO travels under. Chosen once, at creation
  /// — the API's `PATCH` does not accept it.
  final String slug;
  final String name;
  final bool isActive;
  final String? description;

  /// Null means every Linha.
  final int? verticalId;

  /// Null means every clinic, CNPJ or CPF.
  final RequirementLegalDocumentType? appliesToLegalDocumentType;

  final List<String> allowedMimeTypes;
  final int maxFiles;
  final int maxFileSizeBytes;
  final int maxCombinedSizeBytes;

  /// Whether the rep must send both sides (an ID card, not a certificate).
  final bool requiresFrontAndBack;

  /// Whether the rep is asked for a validity date, and the reviewer confirms it
  /// (spec 0011 §3.3). A property of the requirement: a Cartão CNPJ never
  /// expires, a Licença Sanitária always does.
  final bool requiresValidityDate;

  /// Whether this can be hard-deleted, and what stops it — present only on the
  /// admin list read, which is the one that computes the counts. Null means the
  /// question was not asked, so the form must not offer the action.
  final ProductDeletability? deletability;

  factory ConformityRequirement.fromJson(Map<String, dynamic> json) {
    int readInt(Object? value, int fallback) => switch (value) {
      final num v => v.toInt(),
      final String v => int.tryParse(v) ?? fallback,
      _ => fallback,
    };
    String? optional(Object? value) {
      final text = (value as String?)?.trim();
      return (text == null || text.isEmpty) ? null : text;
    }

    final mimeTypes = json['allowedMimeTypes'];

    return ConformityRequirement(
      id: readCrmId(json['id'], 'id'),
      slug: json['slug'] as String? ?? '',
      name: json['name'] as String,
      isActive: json['isActive'] as bool? ?? true,
      description: optional(json['description']),
      verticalId: json['verticalId'] == null
          ? null
          : readCrmId(json['verticalId'], 'verticalId'),
      appliesToLegalDocumentType: RequirementLegalDocumentType.fromWire(
        json['appliesToLegalDocumentType'] as String?,
      ),
      allowedMimeTypes: mimeTypes is List
          ? mimeTypes.whereType<String>().toList(growable: false)
          : const ['image/jpeg', 'image/png', 'application/pdf'],
      maxFiles: readInt(json['maxFiles'], 10),
      maxFileSizeBytes: readInt(json['maxFileSizeBytes'], 52428800),
      maxCombinedSizeBytes: readInt(json['maxCombinedSizeBytes'], 209715200),
      requiresFrontAndBack: json['requiresFrontAndBack'] as bool? ?? false,
      requiresValidityDate: json['requiresValidityDate'] as bool? ?? false,
      deletability: json.containsKey('deletable')
          ? ProductDeletability.fromJson(json)
          : null,
    );
  }

  /// Who this requirement reaches, in one line.
  String get scopeLabel {
    final parts = <String>[
      verticalId == null ? 'Todas as linhas' : 'Uma linha',
      appliesToLegalDocumentType?.label ?? 'CNPJ e CPF',
    ];
    return parts.join(' · ');
  }
}
