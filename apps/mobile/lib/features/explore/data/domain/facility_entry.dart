import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';

/// Lightweight facility model for explore list/search results.
///
/// Substitue o antigo [Clinic] de [models/clinic.dart].
/// Mapeia de [FacilityDTO] — o DTO unificado da API.
class FacilityEntry {
  final int id;
  final String name;
  final String? neighborhood;
  final String city;
  final double? distanceKm;

  /// API `commercialStatus` (`UNREGISTERED` / `REGISTERED` / `SUSPENDED` / `CLOSED`).
  final String? commercialStatus;
  final int? lastVisitDays;
  final int doctorCount;
  final PurchaseRecurrenceSnapshot? purchaseRecurrence;
  final List<ClinicalFocus> clinicalFocuses;
  final List<FacilityVerticalProfileDTO> verticalProfiles;

  /// Already in the list response — `serializeFacility` emits both. Carrying
  /// them means the shell seeded at tap time has coordinates, so the nearby
  /// preview does not have to wait for the detail and fetch a second time.
  final double? lat;
  final double? lng;

  const FacilityEntry({
    required this.id,
    required this.name,
    required this.city,
    this.neighborhood,
    this.distanceKm,
    this.commercialStatus,
    this.lastVisitDays,
    required this.doctorCount,
    this.purchaseRecurrence,
    this.clinicalFocuses = const [],
    this.verticalProfiles = const [],
    this.lat,
    this.lng,
  });

  List<ClinicalFocus> get displayServices => clinicalFocuses;

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
  factory FacilityEntry.fromDTO(FacilityDTO dto, {DateTime? now}) {
    final cityParts = <String>[
      if (dto.city?.trim().isNotEmpty ?? false) dto.city!.trim(),
      if (dto.state?.trim().isNotEmpty ?? false) dto.state!.trim(),
    ];
    final profile = pickVerticalProfile(dto.verticalProfiles);
    final status = profile?.commercialStatus?.trim();
    final lastVisitAt = DateTime.tryParse(dto.lastVisitAt ?? '');
    final reference = now ?? DateTime.now();
    final lastVisitDays = lastVisitAt == null
        ? null
        : calendarDaysBetweenBr(lastVisitAt, reference);
    return FacilityEntry(
      id: dto.id,
      name: dto.name,
      city: cityParts.isNotEmpty ? cityParts.join(', ') : '',
      neighborhood: dto.neighborhood ?? '',
      distanceKm: dto.distanceKm,
      commercialStatus: (status == null || status.isEmpty) ? null : status,
      lastVisitDays: lastVisitDays,
      doctorCount: dto.professionalCount,
      purchaseRecurrence: profile?.purchaseRecurrence,
      clinicalFocuses: dto.clinicalFocuses
          .where((focus) => focus.name.trim().isNotEmpty)
          .toList(growable: false),
      verticalProfiles: dto.verticalProfiles,
      lat: dto.lat,
      lng: dto.lng,
    );
  }
}

/// Calendar-day delta in Brazil (UTC−3, no DST since 2019).
///
/// Host `.toLocal()` shifts midnight-adjacent visits on UTC CI runners and
/// changes "Há N dias". Always measure business calendar days in BRT.
int calendarDaysBetweenBr(DateTime from, DateTime to) {
  final start = _brazilianCalendarDate(from);
  final end = _brazilianCalendarDate(to);
  return end.difference(start).inDays.clamp(0, 1 << 31).toInt();
}

DateTime _brazilianCalendarDate(DateTime instant) {
  // Shift absolute instant into BRT wall time, then take Y/M/D.
  final brt = instant.toUtc().subtract(const Duration(hours: 3));
  return DateTime.utc(brt.year, brt.month, brt.day);
}
