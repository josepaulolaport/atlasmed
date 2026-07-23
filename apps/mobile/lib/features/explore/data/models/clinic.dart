import 'package:atlasmed_mobile_app/features/explore/data/api_types/clinic_api_type.dart'
    as api;

// ── Clinic model ─────────────────────────────────────────────
class Clinic {
  final String id;
  final String name;
  final String city;
  final String neighborhood;
  final double? distanceKm;

  /// API `commercialStatus` (`REGISTERED` / `ACTIVE` / `SUSPENDED` / `INACTIVE`).
  final String? commercialStatus;
  final int? lastVisitDays;
  final int doctorCount;
  final bool isPriority;
  final List<String> products;

  const Clinic({
    required this.id,
    required this.name,
    required this.city,
    required this.neighborhood,
    required this.distanceKm,
    required this.commercialStatus,
    required this.lastVisitDays,
    required this.doctorCount,
    required this.isPriority,
    required this.products,
  });

  String? get locationLabel {
    final normalizedNeighborhood = neighborhood.trim();
    final normalizedCity = city.trim();

    if (normalizedNeighborhood.isEmpty) {
      return normalizedCity.isEmpty ? null : normalizedCity;
    }
    if (normalizedCity.isEmpty) return normalizedNeighborhood;

    return '$normalizedNeighborhood · $normalizedCity';
  }

  /// Maps a [Clinic] from the paginated API response to a [Clinic] model.
  /// Fields not present in the API response use sensible defaults.
  factory Clinic.fromApi(api.Clinic clinicDto) {
    final cityParts = <String>[
      if (clinicDto.city?.trim().isNotEmpty ?? false) clinicDto.city!.trim(),
      if (clinicDto.state?.trim().isNotEmpty ?? false) clinicDto.state!.trim(),
    ];
    final status = clinicDto.commercialStatus?.trim();
    return Clinic(
      id: clinicDto.id,
      name: clinicDto.name,
      city: cityParts.isNotEmpty ? cityParts.join(', ') : '',
      neighborhood: clinicDto.neighborhood ?? '',
      distanceKm: clinicDto.distanceKm,
      commercialStatus: (status == null || status.isEmpty) ? null : status,
      lastVisitDays: null,
      doctorCount: clinicDto.professionalCount,
      isPriority: false,
      products: [],
    );
  }
}
