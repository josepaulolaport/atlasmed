import 'package:atlasmed_mobile_app/core/json/crm_id.dart';
class UnassignedFacility {
  final int id;
  final String displayName;
  final double? lat;
  final double? lng;
  final int managerZoneId;
  final String? managerZoneName;

  const UnassignedFacility({
    required this.id,
    required this.displayName,
    this.lat,
    this.lng,
    required this.managerZoneId,
    this.managerZoneName,
  });

  factory UnassignedFacility.fromJson(Map<String, dynamic> json) {
    return UnassignedFacility(
      id: readCrmId(json['id'], 'id'),
      displayName:
          (json['displayName'] as String?) ??
          (json['name'] as String?) ??
          readCrmId(json['id'], 'id').toString(),
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      managerZoneId:
          (readCrmIdOrNull(json['managerZoneId'], 'managerZoneId')) ??
          (          readCrmIdOrNull(json['territoryId'], 'territoryId')) ??
          0,
      managerZoneName: json['managerZoneName'] as String?,
    );
  }
}
