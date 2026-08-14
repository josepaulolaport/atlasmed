import 'dart:convert';
import 'dart:math' as math;

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/member_territory_map.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/bounds.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart';
import 'package:atlasmed_mobile_app/shared/widgets/mapbox/sized_map_host.dart';
import 'package:flutter/material.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';

/// The member's territory, drawn the same way at both sizes (spec 0015 §6).
///
/// One widget for the minimap and the fullscreen view, so the small version is
/// literally the big one — a preview that styled its polygons differently would
/// teach the wrong thing about what you are about to open.
///
/// Four layers, in the order they must sit:
///   1. **mask**   — the world, with the enclosing zone punched out of it, so
///                   ground the viewer has no authority over recedes.
///   2. **taken**  — other managers' zones, shaded. I3 forbids overlap, so this
///                   is where a zone may *not* grow.
///   3. **subject**— what this person holds, filled and outlined.
///   4. **context**— the enclosing zone's edge, drawn last so it survives.
class MemberTerritoryView extends StatefulWidget {
  const MemberTerritoryView({
    super.key,
    required this.map,
    this.height = 170,
    this.interactive = false,
  });

  final MemberTerritoryMap map;
  final double height;
  final bool interactive;

  @override
  State<MemberTerritoryView> createState() => _MemberTerritoryViewState();
}

class _MemberTerritoryViewState extends State<MemberTerritoryView> {
  static const _maskSource = 'member-mask';
  static const _takenSource = 'member-taken';
  static const _subjectSource = 'member-subject';
  static const _contextSource = 'member-context';

  MapboxMap? _map;
  bool _unavailable = false;
  late final ViewportState? _viewport = _buildViewport();

  List<TerritoryGeometry> _geometries(List<TerritoryMapFeature> features) =>
      features
          .map((f) => f.geometry)
          .whereType<TerritoryGeometry>()
          .toList(growable: false);

  ViewportState? _buildViewport() {
    // Framed on what the person holds when they hold anything; otherwise on the
    // ground they sit in, which is the useful view for "draw them a patch".
    final focus = widget.map.subject.isNotEmpty
        ? _geometries(widget.map.subject)
        : _geometries(widget.map.context);
    final bounds = _combinedBounds(focus);
    if (bounds == null) {
      return CameraViewportState(
        center: Point(coordinates: Position(-51.9, -14.2)),
        zoom: 3.2,
      );
    }
    final fit = _fit(bounds, widget.height);
    return CameraViewportState(
      center: Point(
        coordinates: Position(fit.center.longitude, fit.center.latitude),
      ),
      zoom: fit.zoom,
    );
  }

  @override
  Widget build(BuildContext context) {
    final token = AppConfig.mapboxAccessToken;
    if (token.isEmpty || _unavailable) {
      return SizedBox(
        height: widget.height,
        child: Container(
          color: const Color(0xFFe9eef1),
          alignment: Alignment.center,
          child: const Icon(
            Icons.map_outlined,
            color: Color(0xFFc8cdd5),
            size: 34,
          ),
        ),
      );
    }

    final map = SizedMapHost(
      builder: (context, width, height) => MapWidget(
        key: ValueKey(
          'member-map-${widget.map.subject.map((f) => f.id).join(',')}'
          '-${widget.map.context.map((f) => f.id).join(',')}'
          '-${widget.interactive}',
        ),
        styleUri: MapboxStyles.STANDARD,
        viewport: _viewport,
        onMapCreated: (created) => _map = created,
        onStyleLoadedListener: (_) => _configure(),
        onMapLoadErrorListener: (_) {
          if (mounted) setState(() => _unavailable = true);
        },
      ),
    );

    return SizedBox(
      height: widget.height,
      // The preview does not pan: it is a picture of the territory, and a map
      // that moves under a scrolling list fights the list.
      child: widget.interactive ? map : IgnorePointer(child: map),
    );
  }

  Future<void> _configure() async {
    final mapboxMap = _map;
    if (mapboxMap == null) return;

    try {
      // 1. Everything outside the enclosing zone, dimmed.
      final mask = _maskOutside(_geometries(widget.map.context));
      if (mask != null) {
        await mapboxMap.style.addSource(
          GeoJsonSource(id: _maskSource, data: jsonEncode(mask)),
        );
        await mapboxMap.style.addLayer(
          FillLayer(
            id: '$_maskSource-fill',
            sourceId: _maskSource,
            fillColor: const Color(0xFF0B1220).toARGB32(),
            fillOpacity: 0.35,
          ),
        );
      }

      // 2. Ground another manager already owns.
      await _addPolygons(
        mapboxMap,
        source: _takenSource,
        geometries: _geometries(widget.map.taken),
        fill: const Color(0xFF6B7280),
        fillOpacity: 0.30,
        line: const Color(0xFF4B5563),
        lineWidth: 1,
      );

      // 3. What this person holds.
      await _addPolygons(
        mapboxMap,
        source: _subjectSource,
        geometries: _geometries(widget.map.subject),
        fill: const Color(0xFF2563EB),
        fillOpacity: 0.30,
        line: const Color(0xFF1D4ED8),
        lineWidth: 2,
      );

      // 4. The enclosing zone's edge, on top so it is never covered.
      await _addPolygons(
        mapboxMap,
        source: _contextSource,
        geometries: _geometries(widget.map.context),
        fill: null,
        fillOpacity: 0,
        line: const Color(0xFF0F172A),
        lineWidth: 2,
      );
    } catch (_) {
      if (mounted) setState(() => _unavailable = true);
    }
  }

  Future<void> _addPolygons(
    MapboxMap mapboxMap, {
    required String source,
    required List<TerritoryGeometry> geometries,
    required Color? fill,
    required double fillOpacity,
    required Color line,
    required double lineWidth,
  }) async {
    if (geometries.isEmpty) return;

    await mapboxMap.style.addSource(
      GeoJsonSource(
        id: source,
        data: jsonEncode({
          'type': 'FeatureCollection',
          'features': [
            for (final g in geometries)
              {
                'type': 'Feature',
                'properties': <String, Object?>{},
                'geometry': g.toGeoJson(),
              },
          ],
        }),
      ),
    );

    if (fill != null) {
      await mapboxMap.style.addLayer(
        FillLayer(
          id: '$source-fill',
          sourceId: source,
          fillColor: fill.toARGB32(),
          fillOpacity: fillOpacity,
        ),
      );
    }
    await mapboxMap.style.addLayer(
      LineLayer(
        id: '$source-line',
        sourceId: source,
        lineColor: line.toARGB32(),
        lineWidth: lineWidth,
        lineOpacity: 0.95,
        lineJoin: LineJoin.ROUND,
      ),
    );
  }
}

/// The world with the given territories punched out of it.
///
/// Mapbox has no "dim everything except" primitive, so the mask is one polygon
/// whose outer ring is the whole world and whose holes are the zone's exterior
/// rings. Interior rings of the zone are ignored on purpose: a hole inside the
/// zone is ground the zone does not cover, and it should stay dimmed.
Map<String, Object?>? _maskOutside(List<TerritoryGeometry> geometries) {
  final holes = <List<List<double>>>[];
  for (final geometry in geometries) {
    for (final polygon in geometry.coordinates) {
      if (polygon.isEmpty) continue;
      final exterior = polygon.first;
      if (exterior.length < 4) continue;
      holes.add([
        for (final point in exterior) [point.longitude, point.latitude],
      ]);
    }
  }
  if (holes.isEmpty) return null;

  return {
    'type': 'Feature',
    'properties': <String, Object?>{},
    'geometry': {
      'type': 'Polygon',
      'coordinates': [
        const [
          [-180.0, -85.0],
          [180.0, -85.0],
          [180.0, 85.0],
          [-180.0, 85.0],
          [-180.0, -85.0],
        ],
        ...holes,
      ],
    },
  };
}

class _CameraFit {
  const _CameraFit(this.center, this.zoom);
  final MapCoordinate center;
  final double zoom;
}

_CameraFit _fit(MapBounds bounds, double boxHeight) {
  final centre = MapCoordinate(
    longitude: (bounds.southwest.longitude + bounds.northeast.longitude) / 2,
    latitude: (bounds.southwest.latitude + bounds.northeast.latitude) / 2,
  );
  final spanLng = (bounds.northeast.longitude - bounds.southwest.longitude)
      .abs();
  final spanLat = (bounds.northeast.latitude - bounds.southwest.latitude).abs();
  final span = math.max(spanLng, spanLat);
  if (span <= 0) return _CameraFit(centre, 11);

  // 360° of longitude at zoom 0; each zoom level halves the span. The 0.75
  // leaves a margin so the outline is not flush against the frame.
  final zoom = (math.log(360 / span) / math.ln2) * 0.95;
  return _CameraFit(centre, zoom.clamp(2.0, 12.0));
}

MapBounds? _combinedBounds(List<TerritoryGeometry> geometries) {
  MapBounds? bounds;
  for (final geometry in geometries) {
    final b = geometry.bounds;
    if (b == null) continue;
    bounds = bounds == null
        ? b
        : MapBounds(
            southwest: MapCoordinate(
              longitude: math.min(
                bounds.southwest.longitude,
                b.southwest.longitude,
              ),
              latitude: math.min(
                bounds.southwest.latitude,
                b.southwest.latitude,
              ),
            ),
            northeast: MapCoordinate(
              longitude: math.max(
                bounds.northeast.longitude,
                b.northeast.longitude,
              ),
              latitude: math.max(
                bounds.northeast.latitude,
                b.northeast.latitude,
              ),
            ),
          );
  }
  return bounds;
}
