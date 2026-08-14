import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/professional_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/doctors_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/explore_page_cache.dart';

class DoctorsQuery {
  const DoctorsQuery({
    this.page = 1,
    this.limit = 20,
    this.searchQuery,
    this.facilityId,
    this.latitude,
    this.longitude,
    this.radiusKm,
    this.specialty,
    this.sort,
    this.order,
  });

  final int page;
  final int limit;
  final String? searchQuery;
  final int? facilityId;
  final double? latitude;
  final double? longitude;
  final double? radiusKm;
  final String? specialty;
  final FacilitySort? sort;
  final SortOrder? order;

  DoctorsQuery copyWith({int? page}) {
    return DoctorsQuery(
      page: page ?? this.page,
      limit: limit,
      searchQuery: searchQuery,
      facilityId: facilityId,
      latitude: latitude,
      longitude: longitude,
      radiusKm: radiusKm,
      specialty: specialty,
      sort: sort,
      order: order,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is DoctorsQuery &&
        other.page == page &&
        other.limit == limit &&
        other.searchQuery == searchQuery &&
        other.facilityId == facilityId &&
        other.latitude == latitude &&
        other.longitude == longitude &&
        other.radiusKm == radiusKm &&
        other.specialty == specialty &&
        other.sort == sort &&
        other.order == order;
  }

  @override
  int get hashCode => Object.hash(
    page,
    limit,
    searchQuery,
    facilityId,
    latitude,
    longitude,
    radiusKm,
    specialty,
    sort,
    order,
  );
}

final doctorsPageProvider = StreamProvider.autoDispose
    .family<PaginatedProfessionals, DoctorsQuery>((ref, query) async* {
      final lifetime = keepExplorePageAlive(ref);
      final sessionTag = await ref.watch(exploreSessionCacheTagProvider.future);
      if (sessionTag == null || lifetime.isDisposed) return;
      final repository = ref.watch(
        _doctorsPageRepositoryProvider((query: query, sessionTag: sessionTag)),
      );

      final currentValue = repository.currentValue;
      if (currentValue != null) yield currentValue;

      await for (final repositoryState in repository.stream) {
        final data = repositoryState.map(ready: (state) => state.data);
        if (data != null && !identical(data, currentValue)) yield data;
      }
    });

final doctorsRepositoryFlatProvider = Provider.autoDispose<DoctorsRepository>((
  ref,
) {
  final repository = DoctorsRepository();
  ref.onDispose(repository.dispose);
  return repository;
});

final doctorsRepositoryProvider = Provider.autoDispose
    .family<DoctorsRepository, DoctorsQuery>((ref, query) {
      final repository = DoctorsRepository(
        page: query.page,
        limit: query.limit,
        searchQuery: query.searchQuery,
        facilityId: query.facilityId,
        latitude: query.latitude,
        longitude: query.longitude,
        radiusKm: query.radiusKm,
        specialty: query.specialty,
        sort: query.sort,
        order: query.order,
      );
      ref.onDispose(repository.dispose);
      return repository;
    });

final _doctorsPageRepositoryProvider = Provider.autoDispose
    .family<DoctorsRepository, ({DoctorsQuery query, String sessionTag})>((
      ref,
      request,
    ) {
      final query = request.query;
      final repository = DoctorsRepository(
        cacheTag: request.sessionTag,
        page: query.page,
        limit: query.limit,
        searchQuery: query.searchQuery,
        facilityId: query.facilityId,
        latitude: query.latitude,
        longitude: query.longitude,
        radiusKm: query.radiusKm,
        specialty: query.specialty,
        sort: query.sort,
        order: query.order,
      );
      ref.onDispose(repository.dispose);
      return repository;
    });
