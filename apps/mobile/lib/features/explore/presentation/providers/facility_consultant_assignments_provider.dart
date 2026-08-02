import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_consultant_assignments_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final facilityConsultantAssignmentsRepositoryProvider = Provider.autoDispose
    .family<FacilityConsultantAssignmentsRepository, String>((ref, facilityId) {
      return FacilityConsultantAssignmentsRepository(facilityId);
    });
