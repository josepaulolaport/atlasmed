import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/geometry/geometry_math.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/models/editor_refs.dart';
import 'package:clipper2/clipper2.dart';

/// Adapter between this editor's lng/lat [MapCoordinate] rings and
/// `package:clipper2`'s integer-coordinate [Path64]/[Paths64], plus the
/// `union`/`difference` boolean ops built on top of it (used by the Add
/// area / Remove area tools). Clipper2 only speaks fixed-point integers,
/// so every coordinate is scaled by [_scale] (~1cm of precision at the
/// equator) on the way in and divided back out on the way out — a
/// standard, well-understood pattern for this kind of library.
class GeometryOps {
  GeometryOps._();

  static const double _scale = 1e7;

  /// `evenOdd` is used everywhere in this adapter on purpose: it decides
  /// inside/outside purely by a ray-crossing count, so which way an
  /// *input* ring winds never changes how the boolean op itself resolves.
  /// clipper2's *output* winding is another matter — see
  /// [_normalizeExteriorWinding] / [_normalizeHoleWinding] below.
  static const FillRule _fillRule = FillRule.evenOdd;

  static Path64 toClipperPath(List<MapCoordinate> ring) {
    final open = ring.length > 1 && ring.first == ring.last
        ? ring.sublist(0, ring.length - 1)
        : ring;
    return open
        .map((p) => Point64.fromDouble(p.longitude, p.latitude, scale: _scale))
        .toList();
  }

  static List<MapCoordinate> fromClipperPath(Path64 path) {
    return path
        .map(
          (p) => MapCoordinate(longitude: p.x / _scale, latitude: p.y / _scale),
        )
        .toList();
  }

  /// True if the two (simple, single-ring) shapes overlap at all.
  static bool intersects(List<MapCoordinate> a, List<MapCoordinate> b) {
    final result = Clipper.intersect(
      subject: [toClipperPath(a)],
      clip: [toClipperPath(b)],
      fillRule: _fillRule,
    );
    return result.isNotEmpty;
  }

  /// Unions [drawn] into [parts]. Every pre-existing part the drawn ring
  /// overlaps is merged into the result; parts it doesn't touch are left
  /// completely untouched (byte-for-byte, not round-tripped through
  /// clipper) so unrelated undo history keeps working. A drawn ring that
  /// touches nothing is simply appended as a new disconnected part.
  static GeometryParts union(GeometryParts parts, List<MapCoordinate> drawn) {
    return _applyBooleanOp(parts, [drawn], ClipType.union);
  }

  /// Subtracts [drawn] from [parts] — producing a hole where the cut is
  /// fully interior to a part, or splitting a part into two where the cut
  /// crosses it end-to-end. Parts the drawn ring doesn't touch are left
  /// untouched. A drawn ring that touches nothing is a no-op.
  static GeometryParts difference(
    GeometryParts parts,
    List<MapCoordinate> drawn,
  ) {
    return _applyBooleanOp(parts, [drawn], ClipType.difference);
  }

  /// Subtracts a full, possibly-holed shape (a neighbor's own
  /// exterior-plus-holes rings) from [parts] — the auto-clip-to-neighbor
  /// behind live "boundary snapping": passing every ring (not just the
  /// exterior) means a neighbor's own hole still leaves room for this
  /// territory to extend into it, rather than being carved out too.
  static GeometryParts subtractShape(
    GeometryParts parts,
    List<List<MapCoordinate>> clipRings,
  ) {
    return _applyBooleanOp(parts, clipRings, ClipType.difference);
  }

  static GeometryParts _applyBooleanOp(
    GeometryParts parts,
    List<List<MapCoordinate>> clipRings,
    ClipType clipType,
  ) {
    final clipPaths = clipRings.map(toClipperPath).toList();
    final untouched = <List<List<MapCoordinate>>>[];
    final affectedSubject = <Path64>[];
    var anyAffected = false;

    for (final part in parts) {
      final exterior = toClipperPath(part.first);
      final overlaps = Clipper.intersect(
        subject: [exterior],
        clip: clipPaths,
        fillRule: _fillRule,
      ).isNotEmpty;
      if (overlaps) {
        anyAffected = true;
        affectedSubject.addAll(part.map(toClipperPath));
      } else {
        untouched.add(part);
      }
    }

    if (!anyAffected) {
      if (clipType == ClipType.union) {
        return [
          ...untouched,
          [List<MapCoordinate>.of(clipRings.first)],
        ];
      }
      return untouched;
    }

    final tree = Clipper.booleanOpPolyTree(
      clipType: clipType,
      subject: affectedSubject,
      clip: clipPaths,
      fillRule: _fillRule,
    );

    return [...untouched, ..._treeToParts(tree)];
  }

  /// Flattens a [PolyTree64] into this editor's part/ring shape: every
  /// non-hole node becomes a part (its exterior ring); every hole
  /// directly nested under it becomes one of that part's extra rings. An
  /// "island" nested inside a hole (a rare case for territory data) is
  /// promoted to its own top-level part, since [GeometryParts] has no
  /// third nesting level to model it directly.
  static GeometryParts _treeToParts(PolyTree64 tree) {
    final parts = <List<List<MapCoordinate>>>[];
    for (final child in tree.children) {
      _collectPart(child, parts);
    }
    return parts;
  }

  static void _collectPart(
    PolyPath64 node,
    List<List<List<MapCoordinate>>> parts,
  ) {
    final polygon = node.polygon;
    if (polygon == null) return;
    final rings = [_normalizeExteriorWinding(fromClipperPath(polygon))];
    for (final hole in node.children) {
      final holePolygon = hole.polygon;
      if (holePolygon != null) {
        rings.add(_normalizeHoleWinding(fromClipperPath(holePolygon)));
      }
      for (final island in hole.children) {
        _collectPart(island, parts);
      }
    }
    parts.add(rings);
  }

  /// clipper2 was built assuming a y-axis-down display convention; fed
  /// (longitude, latitude) directly, its "positive"/outer orientation
  /// comes out flipped relative to GeoJSON's y-up (north-up) convention.
  /// The boolean op itself doesn't care (see [_fillRule]) but Mapbox's
  /// polygon renderer does — it only paints a nested ring as a hole
  /// (rather than as more filled area) when the exterior is
  /// counter-clockwise and holes are clockwise. Force that here so every
  /// hole created by Add/Remove area or auto-clip-to-neighbor actually
  /// renders as a hole instead of silently looking like nothing changed.
  static List<MapCoordinate> _normalizeExteriorWinding(
    List<MapCoordinate> ring,
  ) => GeometryMath.isClockwise(ring) ? ring.reversed.toList() : ring;

  static List<MapCoordinate> _normalizeHoleWinding(List<MapCoordinate> ring) =>
      GeometryMath.isClockwise(ring) ? ring : ring.reversed.toList();
}
