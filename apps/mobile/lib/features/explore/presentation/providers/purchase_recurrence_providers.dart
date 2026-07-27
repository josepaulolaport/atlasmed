import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinics_repository.dart';

final facilityPurchaseRecurrenceRepositoryProvider =
    Provider.autoDispose<FacilityPurchaseRecurrenceRepository>((ref) {
      ref.watch(sessionProvider);
      final repository = FacilityPurchaseRecurrenceRepository();
      ref.onDispose(repository.dispose);
      return repository;
    });
