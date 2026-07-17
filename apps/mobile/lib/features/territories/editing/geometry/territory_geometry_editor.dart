import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/models/editor_refs.dart';

/// Pure mutations over [GeometryParts] (open rings — see `editor_refs.dart`
/// for why). Every function returns a *new* structure; nothing is mutated
/// in place, so a previous snapshot kept on the undo/redo stack is never
/// invalidated by a later edit.
class TerritoryGeometryEditor {
  TerritoryGeometryEditor._();

  static GeometryParts fromGeometry(TerritoryGeometry geometry) {
    return geometry.coordinates
        .map((part) => part.map(_openRing).toList())
        .toList();
  }

  static TerritoryGeometry toGeometry(GeometryParts parts) {
    final closed = parts.map((part) => part.map(closeRing).toList()).toList();
    if (closed.isEmpty) return TerritoryGeometry.polygon(const []);
    return closed.length == 1
        ? TerritoryGeometry.polygon(closed.first)
        : TerritoryGeometry.multiPolygon(closed);
  }

  static GeometryParts copy(GeometryParts parts) => parts
      .map((part) => part.map((ring) => List<MapCoordinate>.of(ring)).toList())
      .toList();

  static List<MapCoordinate> _openRing(List<MapCoordinate> ring) =>
      ring.length > 1 && ring.first == ring.last
      ? ring.sublist(0, ring.length - 1)
      : List<MapCoordinate>.of(ring);

  /// Appends a duplicate of the first point, if not already closed — the
  /// shape rendering/export boundary expects closed rings even though the
  /// editor works with open ones internally.
  static List<MapCoordinate> closeRing(List<MapCoordinate> ring) =>
      ring.isEmpty ? ring : [...ring, ring.first];

  static GeometryParts moveVertex(
    GeometryParts parts,
    VertexRef ref,
    MapCoordinate position,
  ) {
    final next = copy(parts);
    next[ref.partIndex][ref.ringIndex][ref.pointIndex] = position;
    return next;
  }

  /// Inserts [position] right after [edge]'s start vertex. Returns the ref
  /// of the newly-inserted vertex so the caller (the screen, tracking which
  /// annotation is being dragged) can keep treating the same live gesture
  /// as "now dragging vertex X" without interrupting it.
  static ({GeometryParts parts, VertexRef ref}) insertVertex(
    GeometryParts parts,
    EdgeRef edge,
    MapCoordinate position,
  ) {
    final next = copy(parts);
    final ring = next[edge.partIndex][edge.ringIndex];
    final insertAt = edge.startIndex + 1;
    ring.insert(insertAt, position);
    return (
      parts: next,
      ref: VertexRef(
        partIndex: edge.partIndex,
        ringIndex: edge.ringIndex,
        pointIndex: insertAt,
      ),
    );
  }

  /// Returns `null` if deleting would drop the ring below a valid triangle.
  static GeometryParts? deleteVertex(GeometryParts parts, VertexRef ref) {
    final ring = parts[ref.partIndex][ref.ringIndex];
    if (ring.length <= 3) return null;
    final next = copy(parts);
    next[ref.partIndex][ref.ringIndex].removeAt(ref.pointIndex);
    return next;
  }

  static GeometryParts moveEdge(
    GeometryParts parts,
    EdgeRef edge,
    double deltaLng,
    double deltaLat,
  ) {
    final next = copy(parts);
    final ring = next[edge.partIndex][edge.ringIndex];
    final endIndex = (edge.startIndex + 1) % ring.length;
    ring[edge.startIndex] = _translate(
      ring[edge.startIndex],
      deltaLng,
      deltaLat,
    );
    ring[endIndex] = _translate(ring[endIndex], deltaLng, deltaLat);
    return next;
  }

  static GeometryParts movePolygon(
    GeometryParts parts,
    int partIndex,
    double deltaLng,
    double deltaLat,
  ) {
    final next = copy(parts);
    next[partIndex] = next[partIndex]
        .map(
          (ring) => ring.map((p) => _translate(p, deltaLng, deltaLat)).toList(),
        )
        .toList();
    return next;
  }

  static GeometryParts deletePart(GeometryParts parts, int partIndex) {
    final next = copy(parts)..removeAt(partIndex);
    return next;
  }

  static GeometryParts appendPart(
    GeometryParts parts,
    List<MapCoordinate> exteriorRing,
  ) {
    final next = copy(parts)..add([List<MapCoordinate>.of(exteriorRing)]);
    return next;
  }

  static MapCoordinate _translate(MapCoordinate p, double dLng, double dLat) {
    return MapCoordinate(
      longitude: p.longitude + dLng,
      latitude: p.latitude + dLat,
    );
  }
}
