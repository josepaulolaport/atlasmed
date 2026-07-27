import 'package:atlasmed_mobile_app/features/explore/data/api/professional_api.dart';

/// Lightweight professional model used in explore doctor lists and rows.
///
/// Maps from [ProfessionalDTO] — the unified API response type.
class ProfessionalEntry {
  final String id;
  final String name;
  final String initials;
  final double hue;
  final String? specialty;
  final String? crm;
  final double? distanceKm;

  const ProfessionalEntry({
    required this.id,
    required this.name,
    required this.initials,
    required this.hue,
    this.specialty,
    this.crm,
    this.distanceKm,
  });

  factory ProfessionalEntry.fromDTO(ProfessionalDTO dto) {
    final name = dto.displayName;
    final nameParts = name.split(' ');
    final initials = nameParts.length >= 2
        ? '${nameParts.first[0]}${nameParts.last[0]}'
        : name.isNotEmpty
        ? name[0]
        : '?';
    return ProfessionalEntry(
      id: dto.id,
      name: name,
      initials: initials.toUpperCase(),
      hue: 0,
      specialty: dto.specialty,
      crm: dto.crm,
      distanceKm: dto.distanceKm,
    );
  }
}
