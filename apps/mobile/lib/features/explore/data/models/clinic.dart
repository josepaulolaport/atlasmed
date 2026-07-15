import 'package:atlasmed_mobile_app/features/explore/data/api_types.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/filter_data.dart';

// ── Clinic model ─────────────────────────────────────────────
class Clinic {
  final String id;
  final String name;
  final String city;
  final String neighborhood;
  final double distanceKm;
  final ClinicStatus status;
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
    required this.status,
    required this.lastVisitDays,
    required this.doctorCount,
    required this.isPriority,
    required this.products,
  });

  /// Maps an [ApiClinic] from the paginated API response to a [Clinic] model.
  /// Fields not present in the API response use sensible defaults.
  factory Clinic.fromApi(ApiClinic api) {
    final cityParts = <String>[
      if (api.city != null && api.city!.isNotEmpty) api.city!,
      if (api.state != null && api.state!.isNotEmpty) api.state!,
    ];
    return Clinic(
      id: api.id,
      name: api.name,
      city: cityParts.isNotEmpty ? cityParts.join(', ') : '',
      neighborhood: '',
      distanceKm: api.distanceKm ?? 0,
      status: ClinicStatus.ativa,
      lastVisitDays: null,
      doctorCount: api.professionalCount,
      isPriority: false,
      products: [],
    );
  }
}
