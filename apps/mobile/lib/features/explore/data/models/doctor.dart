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
}
