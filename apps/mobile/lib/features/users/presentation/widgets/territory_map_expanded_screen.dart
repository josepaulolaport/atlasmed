import 'dart:async';
import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_assignments.dart';
import 'package:flutter/material.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Full-screen, freely interactive view of a single assigned territory's
/// map — opened by tapping a [TerritoryMapCard]. Unlike the card preview,
/// panning/zooming/rotating is enabled here. The user closes it (X button
/// or system back gesture) to return to the screen they came from.
class TerritoryMapExpandedScreen extends StatefulWidget {
  const TerritoryMapExpandedScreen({super.key, required this.assignment});

  final TerritoryAssignment assignment;

  /// Pushes the expanded map as a full-screen dialog route.
  static Future<void> show(
    BuildContext context,
    TerritoryAssignment assignment,
  ) {
    return Navigator.of(context).push(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => TerritoryMapExpandedScreen(assignment: assignment),
      ),
    );
  }

  @override
  State<TerritoryMapExpandedScreen> createState() =>
      _TerritoryMapExpandedScreenState();
}

class _TerritoryMapExpandedScreenState
    extends State<TerritoryMapExpandedScreen> {
  static const _sourceId = 'territorio-usuario-expandido';
  static const _fillLayerId = 'territorio-usuario-expandido-preenchimento';
  static const _lineLayerId = 'territorio-usuario-expandido-contorno';

  MapboxMap? _mapboxMap;
  bool _mapUnavailable = false;

  // See the identical field in `TerritoryMapCard`: `CameraViewportState` has
  // no value equality, so [MapWidget] would reset the camera — discarding
  // whatever the user just panned/zoomed to — on every rebuild unless the
  // same instance is reused across builds.
  late final ViewportState? _initialViewport = _buildInitialViewport();

  ViewportState? _buildInitialViewport() {
    final centroid = widget.assignment.centroid;
    if (centroid == null) return null;
    return CameraViewportState(center: _point(centroid), zoom: 12.4);
  }

  @override
  Widget build(BuildContext context) {
    final token = AppConfig.mapboxAccessToken;
    final centroid = widget.assignment.centroid;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          if (token.isEmpty || centroid == null || _mapUnavailable)
            const _ExpandedMapPlaceholder()
          else
            MapWidget(
              key: ValueKey('mapa-expandido-${widget.assignment.territoryId}'),
              styleUri: MapboxStyles.STANDARD,
              viewport: _initialViewport,
              onMapCreated: _onMapCreated,
              onStyleLoadedListener: (_) => _configureMap(),
              onMapLoadErrorListener: (_) =>
                  setState(() => _mapUnavailable = true),
            ),
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            child: SafeArea(
              bottom: false,
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 12, 12, 32),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Color(0xCC0f1729), Color(0x000f1729)],
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            widget.assignment.territoryName,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                              height: 1.2,
                            ),
                          ),
                          if (widget.assignment.verticalName != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              widget.assignment.verticalName!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: AppColors.gray200,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    _CloseButton(onTap: () => Navigator.of(context).maybePop()),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _onMapCreated(MapboxMap mapboxMap) {
    _mapboxMap = mapboxMap;
    MapboxOptions.setAccessToken(AppConfig.mapboxAccessToken);
    // Unlike the card preview, gestures are left at their default (enabled)
    // settings so the user can freely pan, zoom, rotate and pitch.
  }

  Future<void> _configureMap() async {
    final mapboxMap = _mapboxMap;
    final boundary = widget.assignment.boundary;
    if (mapboxMap == null || boundary == null || !mounted) return;

    try {
      await mapboxMap.style.addSource(
        GeoJsonSource(
          id: _sourceId,
          data: jsonEncode(boundary.toFeatureCollection()),
        ),
      );
      await mapboxMap.style.addLayer(
        FillLayer(
          id: _fillLayerId,
          sourceId: _sourceId,
          fillColor: AppColors.blue600.toARGB32(),
          fillOpacity: 0.18,
        ),
      );
      await mapboxMap.style.addLayer(
        LineLayer(
          id: _lineLayerId,
          sourceId: _sourceId,
          lineColor: AppColors.blueDark.toARGB32(),
          lineWidth: 2,
          lineOpacity: 0.9,
          lineJoin: LineJoin.ROUND,
        ),
      );

      final bounds = boundary.bounds;
      if (bounds != null) {
        final coordinateBounds = CoordinateBounds(
          southwest: _point(bounds.southwest),
          northeast: _point(bounds.northeast),
          infiniteBounds: false,
        );
        final camera = await mapboxMap.cameraForCoordinateBounds(
          coordinateBounds,
          MbxEdgeInsets(top: 120, left: 32, bottom: 48, right: 32),
          null,
          null,
          null,
          null,
        );
        await mapboxMap.setCamera(camera);
      }
    } catch (_) {
      if (mounted) setState(() => _mapUnavailable = true);
    }
  }

  Point _point(MapCoordinate coordinate) =>
      Point(coordinates: Position(coordinate.longitude, coordinate.latitude));
}

class _CloseButton extends StatelessWidget {
  const _CloseButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.16),
      shape: const CircleBorder(),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: const Padding(
          padding: EdgeInsets.all(8),
          child: Icon(Icons.close_rounded, size: 20, color: Colors.white),
        ),
      ),
    );
  }
}

class _ExpandedMapPlaceholder extends StatelessWidget {
  const _ExpandedMapPlaceholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFdfe5f0), AppColors.gray300],
        ),
      ),
      child: const Center(
        child: Icon(Icons.map_outlined, size: 48, color: AppColors.gray400),
      ),
    );
  }
}
