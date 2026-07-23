import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';

/// Thin wrapper kept for call-sites; prefers the full [CreateDoctorPage] route.
@Deprecated('Use context.push(/workspace/explore/doctors/new) instead')
Future<FacilityCrmDoctor?> showCreateDoctorProfileSheet(
  BuildContext context, {
  String? facilityId,
}) {
  final uri = facilityId == null || facilityId.isEmpty
      ? '/workspace/explore/doctors/new'
      : Uri(
          path: '/workspace/explore/doctors/new',
          queryParameters: {'facilityId': facilityId},
        ).toString();
  return context.push<FacilityCrmDoctor>(uri);
}
