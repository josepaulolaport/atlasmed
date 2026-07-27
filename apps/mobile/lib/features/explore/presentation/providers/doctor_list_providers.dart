import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/doctors_repository.dart';

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
  final String? facilityId;
  final double? latitude;
  final double? longitude;
  final double? radiusKm;
  final String? specialty;
  final FacilitySort? sort;
  final SortOrder? order;

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

final doctorsRepositoryFlatProvider = Provider.autoDispose<DoctorsRepository>((
  ref,
) {
  final repository = DoctorsRepository();
  ref.onDispose(repository.dispose);
  return repository;
});

final doctorsRepositoryProvider = Provider.autoDispose
    .family<DoctorsRepository, DoctorsQuery>((ref, query) {
      ref.watch(sessionProvider);
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
