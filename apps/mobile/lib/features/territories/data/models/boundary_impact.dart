import 'package:atlasmed_mobile_app/core/json/crm_id.dart';
/// Clinic that must be deassigned before a boundary save (Spec 0006).
class BoundaryImpactClinic {
  final int facilityId;
  final String facilityName;
  final int consultantUserId;
  final String consultantName;

  const BoundaryImpactClinic({
    required this.facilityId,
    required this.facilityName,
    required this.consultantUserId,
    required this.consultantName,
  });

  factory BoundaryImpactClinic.fromJson(Map<String, dynamic> json) {
    return BoundaryImpactClinic(
      facilityId: readCrmId(json['facilityId'], 'facilityId'),
      facilityName: json['facilityName'] as String? ?? '',
      consultantUserId: readCrmId(json['consultantUserId'], 'consultantUserId'),
      consultantName: json['consultantName'] as String? ?? '',
    );
  }
}

class BoundaryImpactPreview {
  final String mode;
  final List<BoundaryImpactClinic> clinics;

  const BoundaryImpactPreview({required this.mode, required this.clinics});

  factory BoundaryImpactPreview.fromJson(Map<String, dynamic> json) {
    final clinics = (json['clinics'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>()
        .map(BoundaryImpactClinic.fromJson)
        .toList();
    return BoundaryImpactPreview(
      mode: json['mode'] as String? ?? 'other',
      clinics: clinics,
    );
  }
}
