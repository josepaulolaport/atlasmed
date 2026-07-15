import '../api_types.dart';

// ── Doctor model ─────────────────────────────────────────────
class Doctor {
  final String id;
  final String name;
  final String initials;
  final double hue;
  final String specialty;
  final String primaryClinic;
  final String crm;
  final double distanceKm;
  final bool isPriority;

  const Doctor({
    required this.id,
    required this.name,
    required this.initials,
    required this.hue,
    required this.specialty,
    required this.primaryClinic,
    required this.crm,
    required this.distanceKm,
    required this.isPriority,
  });

  /// Maps an [ApiDoctor] from the paginated API response to a [Doctor] model.
  /// Fields not present in the API response use sensible defaults.
  factory Doctor.fromApi(ApiDoctor api) {
    final name = api.displayName;
    final nameParts = name.split(' ');
    final initials = nameParts.length >= 2
        ? '${nameParts.first[0]}${nameParts.last[0]}'
        : name.isNotEmpty
            ? name[0]
            : '?';
    return Doctor(
      id: api.id,
      name: name,
      initials: initials.toUpperCase(),
      hue: 0,
      specialty: api.specialty ?? '',
      primaryClinic: '',
      crm: api.crm,
      distanceKm: api.distanceKm ?? 0,
      isPriority: false,
    );
  }
}
