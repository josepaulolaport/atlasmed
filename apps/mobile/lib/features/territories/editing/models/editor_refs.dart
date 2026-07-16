import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';

/// A territory's working geometry, kept as **open** rings (no duplicated
/// closing point) throughout editing — parts → rings → points, ring 0 is
/// the exterior, any further rings are holes. Rings are only closed (first
/// point duplicated at the end) at the boundary, when converting to/from a
/// [TerritoryGeometry] for rendering or persistence. This keeps every
/// mutation below free of "is this the duplicated closing vertex" special
/// casing.
typedef GeometryParts = List<List<List<MapCoordinate>>>;

/// Points at a single vertex within [GeometryParts].
class VertexRef {
  final int partIndex;
  final int ringIndex;
  final int pointIndex;

  const VertexRef({
    required this.partIndex,
    required this.ringIndex,
    required this.pointIndex,
  });

  @override
  bool operator ==(Object other) =>
      other is VertexRef &&
      other.partIndex == partIndex &&
      other.ringIndex == ringIndex &&
      other.pointIndex == pointIndex;

  @override
  int get hashCode => Object.hash(partIndex, ringIndex, pointIndex);

  @override
  String toString() => 'VertexRef($partIndex/$ringIndex/$pointIndex)';
}

/// Points at the edge between `startIndex` and `startIndex + 1` (wrapping)
/// within an open ring.
class EdgeRef {
  final int partIndex;
  final int ringIndex;
  final int startIndex;

  const EdgeRef({
    required this.partIndex,
    required this.ringIndex,
    required this.startIndex,
  });

  @override
  bool operator ==(Object other) =>
      other is EdgeRef &&
      other.partIndex == partIndex &&
      other.ringIndex == ringIndex &&
      other.startIndex == startIndex;

  @override
  int get hashCode => Object.hash(partIndex, ringIndex, startIndex);

  @override
  String toString() => 'EdgeRef($partIndex/$ringIndex/$startIndex)';
}
