class ProfessionalNote {
  const ProfessionalNote({
    required this.id,
    required this.note,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String note;
  final DateTime createdAt;
  final DateTime updatedAt;

  factory ProfessionalNote.fromJson(Map<String, dynamic> json) {
    return ProfessionalNote(
      id: json['id'] as String,
      note: json['note'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }
}
