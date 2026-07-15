import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinics_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/doctors_repository.dart';

class ClinicsQuery {
  const ClinicsQuery({this.page = 1, this.limit = 20, this.searchQuery});

  final int page;
  final int limit;
  final String? searchQuery;

  @override
  bool operator ==(Object other) {
    return other is ClinicsQuery &&
        other.page == page &&
        other.limit == limit &&
        other.searchQuery == searchQuery;
  }

  @override
  int get hashCode => Object.hash(page, limit, searchQuery);
}

class DoctorsQuery {
  const DoctorsQuery({
    this.page = 1,
    this.limit = 20,
    this.searchQuery,
    this.facilityId,
  });

  final int page;
  final int limit;
  final String? searchQuery;
  final String? facilityId;

  @override
  bool operator ==(Object other) {
    return other is DoctorsQuery &&
        other.page == page &&
        other.limit == limit &&
        other.searchQuery == searchQuery &&
        other.facilityId == facilityId;
  }

  @override
  int get hashCode => Object.hash(page, limit, searchQuery, facilityId);
}

final clinicsRepositoryProvider = Provider.autoDispose
    .family<ClinicsRepository, ClinicsQuery>((ref, query) {
      ref.watch(sessionProvider);
      final repository = ClinicsRepository(
        page: query.page,
        limit: query.limit,
        searchQuery: query.searchQuery,
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
