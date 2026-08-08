import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_vertical_rep_assignments_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final facilityVerticalRepAssignmentsRepositoryProvider = Provider.autoDispose
    .family<FacilityVerticalRepAssignmentsRepository, int>((ref, facilityId) {
      return FacilityVerticalRepAssignmentsRepository(facilityId);
    });
