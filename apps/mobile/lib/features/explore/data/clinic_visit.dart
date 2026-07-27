import 'package:atlasmed_mobile_app/features/explore/data/models/visit_type.dart';

class ClinicVisit {
  final String id;
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
      id: json['id'] as String,
      date: DateTime.parse(json['visitedAt'] as String),
      type: visitTypeFromJson(json['type'] as String? ?? 'visit'),
      summary: json['summary'] as String?,
    );
  }
}
