import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/doctor_detail_repository.dart';

/// Provides a [DoctorDetailRepository] for a given professional [id].
final doctorDetailRepositoryProvider = Provider.autoDispose
    .family<DoctorDetailRepository, String>((ref, id) {
      final repository = DoctorDetailRepository(id: id);
      ref.onDispose(repository.dispose);
      return repository;
    });
