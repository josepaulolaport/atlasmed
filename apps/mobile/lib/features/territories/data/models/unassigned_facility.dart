class UnassignedFacility {
  final String id;
  final String displayName;
  final double? lat;
  final double? lng;
  final String managerZoneId;
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
      id: json['id'] as String,
      displayName:
          (json['displayName'] as String?) ??
          (json['name'] as String?) ??
          json['id'] as String,
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      managerZoneId:
          (json['managerZoneId'] as String?) ??
          (json['territoryId'] as String?) ??
          '',
      managerZoneName: json['managerZoneName'] as String?,
    );
  }
}
