import '../../../../core/network/api_client.dart';
import 'clinic_detail.dart';
import 'doctor_detail.dart';
import 'explore_enrichment.dart';
import 'explore_list_filters.dart';
import 'explore_page.dart';
import 'explore_repository.dart';
import 'mappers/explore_mapper.dart';
import 'models.dart';

class ApiExploreRepository implements ExploreRepository {
  ApiExploreRepository(this._api);

  final ApiClient _api;

  Map<String, String> _listQuery({
    String? search,
    ExploreListFilters filters = const ExploreListFilters(),
    int page = 1,
    int limit = explorePageSize,
  }) {
    return {
      'page': page.toString(),
      'limit': limit.toString(),
      if (search != null && search.trim().length >= 2) 'search': search.trim(),
      if (filters.stateCodes.isNotEmpty) 'stateCode': filters.stateCodes.join(','),
      if (filters.cities.isNotEmpty) 'city': filters.cities.join(','),
      if (filters.facilityTypes.isNotEmpty) 'facilityType': filters.facilityTypes.join(','),
    };
  }

  bool _hasMore(Map<String, dynamic> data, int pageSize) {
    final pagination = data['pagination'] as Map<String, dynamic>?;
    if (pagination != null) {
      final currentPage = (pagination['page'] as num?)?.toInt() ?? 1;
      final totalPages = (pagination['totalPages'] as num?)?.toInt() ?? 1;
      return currentPage < totalPages;
    }

    final items = data['data'] as List<dynamic>? ?? [];
    return items.length >= pageSize;
  }

  @override
  Future<ExplorePage<Clinic>> getClinics({
    String? search,
    ExploreListFilters filters = const ExploreListFilters(),
    int page = 1,
    int limit = explorePageSize,
  }) async {
    final data = await _api.get(
      '/explore/facilities',
      query: _listQuery(search: search, filters: filters, page: page, limit: limit),
    );

    final items = (data['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
    return ExplorePage(
      items: items
          .map((item) => enrichClinic(mapFacilityToClinic(item)))
          .toList(growable: false),
      hasMore: _hasMore(data, limit),
      page: page,
    );
  }

  @override
  Future<ExplorePage<Doctor>> getDoctors({
    String? search,
    int page = 1,
    int limit = explorePageSize,
  }) async {
    final data = await _api.get(
      '/explore/professionals',
      query: _listQuery(search: search, page: page, limit: limit),
    );

    final items = (data['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
    return ExplorePage(
      items: items
          .map((item) => enrichDoctor(mapProfessionalToDoctor(item)))
          .toList(growable: false),
      hasMore: _hasMore(data, limit),
      page: page,
    );
  }

  @override
  Future<ClinicDetail> getClinicDetail(String id) async {
    final data = await _api.get('/explore/facilities/$id');
    return enrichClinicDetail(mapFacilityToClinicDetail(data));
  }

  @override
  Future<DoctorDetail> getDoctorDetail(String id) async {
    final data = await _api.get('/explore/professionals/$id');
    return enrichDoctorDetail(mapProfessionalToDoctorDetail(data));
  }

  @override
  Future<ExploreFilterOptions> getFacilityFilterOptions() async {
    final data = await _api.get('/explore/facilities/filter-options');
    final states = (data['states'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>()
        .map(
          (row) => ExploreStateOption(
            code: row['code'].toString(),
            name: formatDisplayName(row['name'].toString()),
          ),
        )
        .toList();
    final facilityTypes = (data['facilityTypes'] as List<dynamic>? ?? [])
        .map((value) => value.toString())
        .toList();

    return ExploreFilterOptions(states: states, facilityTypes: facilityTypes);
  }

  @override
  Future<List<ExploreCityOption>> searchCities({
    String? search,
    List<String> stateCodes = const [],
    int limit = 40,
  }) async {
    final data = await _api.get(
      '/explore/facilities/filter-options/cities',
      query: {
        'limit': limit.toString(),
        if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
        if (stateCodes.isNotEmpty) 'stateCode': stateCodes.join(','),
      },
    );

    return (data['cities'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>()
        .map(
          (row) => ExploreCityOption(
            name: row['name'].toString(),
            stateCode: row['stateCode'].toString(),
          ),
        )
        .toList();
  }
}
