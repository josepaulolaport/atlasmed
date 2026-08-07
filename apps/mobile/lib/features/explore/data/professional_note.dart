import 'package:atlasmed_mobile_app/core/json/crm_id.dart';
class ProfessionalNote {
  const ProfessionalNote({
    required this.id,
    required this.note,
    required this.createdAt,
    required this.updatedAt,
  });

  final int id;
  final String note;
  final DateTime createdAt;
  final DateTime updatedAt;

  factory ProfessionalNote.fromJson(Map<String, dynamic> json) {
    return ProfessionalNote(
      id: readCrmId(json['id'], 'id'),
      note: json['note'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }
}
