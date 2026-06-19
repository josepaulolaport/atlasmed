import 'clinic_detail.dart';
import 'doctor_detail.dart';
import 'explore_list_filters.dart';
import 'explore_page.dart';
import 'models.dart';

/// Abstract repository for explore (clinic/doctor list + detail) data.
///
/// Implementations can be swapped: MockExploreRepository for dev,
/// ApiExploreRepository when backend is ready (Open/Closed principle).
abstract class ExploreRepository {
  Future<ExplorePage<Clinic>> getClinics({
    String? search,
    ExploreListFilters filters = const ExploreListFilters(),
    int page = 1,
    int limit = explorePageSize,
  });

  Future<ExplorePage<Doctor>> getDoctors({
    String? search,
    int page = 1,
    int limit = explorePageSize,
  });

  Future<ClinicDetail> getClinicDetail(String id);

  Future<DoctorDetail> getDoctorDetail(String id);

  Future<ExploreFilterOptions> getFacilityFilterOptions();

  Future<List<ExploreCityOption>> searchCities({
    String? search,
    List<String> stateCodes = const [],
    int limit = 40,
  });
}
