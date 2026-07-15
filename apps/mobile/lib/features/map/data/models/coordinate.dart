class MapCoordinate {
  final double longitude;
  final double latitude;

  const MapCoordinate({required this.longitude, required this.latitude});

  @override
  bool operator ==(Object other) =>
      other is MapCoordinate &&
      other.longitude == longitude &&
      other.latitude == latitude;

  @override
  int get hashCode => Object.hash(longitude, latitude);
}
