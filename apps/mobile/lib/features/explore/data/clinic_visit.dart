import 'package:atlasmed_mobile_app/features/explore/data/models/visit_type.dart';
import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

class ClinicVisit {
  final int id;
  final DateTime date;
  final VisitType type;
  final String? summary;

  const ClinicVisit({
    required this.id,
    required this.date,
    required this.type,
    this.summary,
  });

  factory ClinicVisit.fromJson(Map<String, dynamic> json) {
    return ClinicVisit(
      id: readCrmId(json['id'], 'id'),
      date: DateTime.parse(json['visitedAt'] as String),
      type: visitTypeFromJson(json['type'] as String? ?? 'visit'),
      summary: json['summary'] as String?,
    );
  }
}
