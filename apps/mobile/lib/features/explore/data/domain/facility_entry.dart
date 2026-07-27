import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';

/// Lightweight facility model for explore list/search results.
///
/// Substitue o antigo [Clinic] de [models/clinic.dart].
/// Mapeia de [FacilityDTO] — o DTO unificado da API.
class FacilityEntry {
  final String id;
  final String name;
  final String? neighborhood;
  final String city;
  final double? distanceKm;

  /// API `commercialStatus` (`REGISTERED` / `ACTIVE` / `SUSPENDED` / `INACTIVE`).
  final String? commercialStatus;
  final int doctorCount;
  final PurchaseRecurrenceSnapshot? purchaseRecurrence;

  const FacilityEntry({
    required this.id,
    required this.name,
    required this.city,
    this.neighborhood,
    this.distanceKm,
    this.commercialStatus,
    required this.doctorCount,
    this.purchaseRecurrence,
  });

  String? get locationLabel {
    final normalizedNeighborhood = neighborhood?.trim() ?? '';
    final normalizedCity = city.trim();

    if (normalizedNeighborhood.isEmpty) {
      return normalizedCity.isEmpty ? null : normalizedCity;
    }
    if (normalizedCity.isEmpty) return normalizedNeighborhood;

    return '$normalizedNeighborhood · $normalizedCity';
  }

  /// Maps a [FacilityDTO] from the paginated API response to a [FacilityEntry].
  /// MESMA lógica do antigo [Clinic.fromApi].
  factory FacilityEntry.fromDTO(FacilityDTO dto) {
    final cityParts = <String>[
      if (dto.city?.trim().isNotEmpty ?? false) dto.city!.trim(),
      if (dto.state?.trim().isNotEmpty ?? false) dto.state!.trim(),
    ];
    final status = dto.commercialStatus?.trim();
    return FacilityEntry(
      id: dto.id,
      name: dto.name,
      city: cityParts.isNotEmpty ? cityParts.join(', ') : '',
      neighborhood: dto.neighborhood ?? '',
      distanceKm: dto.distanceKm,
      commercialStatus: (status == null || status.isEmpty) ? null : status,
      doctorCount: dto.professionalCount,
      purchaseRecurrence: dto.purchaseRecurrence,
    );
  }
}
