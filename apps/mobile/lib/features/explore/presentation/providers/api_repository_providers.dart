import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinics_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/doctors_repository.dart';

class ClinicsQuery {
  const ClinicsQuery({
    this.page = 1,
    this.limit = 20,
    this.searchQuery,
    this.latitude,
    this.longitude,
    this.radiusKm,
    this.commercialStatus,
    this.productIds,
  });

  final int page;
  final int limit;
  final String? searchQuery;
  final double? latitude;
  final double? longitude;
  final double? radiusKm;
  final String? commercialStatus;
  final String? productIds;

  @override
  bool operator ==(Object other) {
    return other is ClinicsQuery &&
        other.page == page &&
        other.limit == limit &&
        other.searchQuery == searchQuery &&
        other.latitude == latitude &&
        other.longitude == longitude &&
        other.radiusKm == radiusKm &&
        other.commercialStatus == commercialStatus &&
        other.productIds == productIds;
  }

  @override
  int get hashCode => Object.hash(
    page,
    limit,
    searchQuery,
    latitude,
    longitude,
    radiusKm,
    commercialStatus,
    productIds,
  );

  /// Whether this query would return distinct results from [other].
  bool differsFrom(ClinicsQuery other) => this != other;
}

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
  });

  final int page;
  final int limit;
  final String? searchQuery;
  final String? facilityId;
  final double? latitude;
  final double? longitude;
  final double? radiusKm;
  final String? specialty;

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
        other.specialty == specialty;
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
  );
}

final clinicsRepositoryProvider = Provider.autoDispose
    .family<ClinicsRepository, ClinicsQuery>((ref, query) {
      ref.watch(sessionProvider);
      final repository = ClinicsRepository(
        page: query.page,
        limit: query.limit,
        searchQuery: query.searchQuery,
        latitude: query.latitude,
        longitude: query.longitude,
        radiusKm: query.radiusKm,
        commercialStatus: query.commercialStatus,
        productIds: query.productIds,
      );
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
      );
      ref.onDispose(repository.dispose);
      return repository;
    });

final clinicsPageProvider = FutureProvider.autoDispose
    .family<PaginatedClinics?, ClinicsQuery>((ref, query) {
      final repository = ref.watch(clinicsRepositoryProvider(query));
      return repository.currentValueOrResolve();
    });

final doctorsPageProvider = FutureProvider.autoDispose
    .family<PaginatedDoctors?, DoctorsQuery>((ref, query) {
      final repository = ref.watch(doctorsRepositoryProvider(query));
      return repository.currentValueOrResolve();
    });
