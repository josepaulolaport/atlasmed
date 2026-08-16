import 'dart:async';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_draft.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_type.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/geometry/geometry_math.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/geometry/territory_geometry_editor.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/models/editor_mode.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/models/editor_refs.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/models/editor_target.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/models/territory_invite_draft.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/providers/territory_editor_controller.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/providers/territory_editor_state.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/widgets/boundary_impact_sheet.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/widgets/editor_contextual_bar.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/widgets/editor_save_bar.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/widgets/editor_toolbar.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/widgets/editor_validation_banner.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/widgets/invite_patch_name_form.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/widgets/territory_metadata_form.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart' hide Size;
import 'package:atlasmed_mobile_app/shared/map/map_projection.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class TerritoryEditorScreen extends ConsumerStatefulWidget {
  final TerritoryEditorTarget target;

  const TerritoryEditorScreen({super.key, required this.target});

  @override
  ConsumerState<TerritoryEditorScreen> createState() =>
      _TerritoryEditorScreenState();
}

class _TerritoryEditorScreenState extends ConsumerState<TerritoryEditorScreen> {
  static const _managerZoneColor = 0xFF2563EB;
  static const _repPatchColor = 0xFF059669;
  static const _selectedColor = 0xFFF59E0B;
  static const _neighborColor = 0xFF9CA3AF;
  static const _haloColor = 0xFFFFFFFF;
  static const _vertexFill = 0xFFFFFFFF;
  static const _handleStroke = 0xFFF59E0B;
  static const _midpointFill = 0xFFFDE68A;
  static const _edgeSelectedColor = 0xFFEF4444;
  static const _moveHandleColor = 0xFF0A2F7F;
  static const _addColor = 0xFF10B981;
  static const _removeColor = 0xFFEF4444;
  static const _snapThresholdPixels = 24.0;
  static const _vertexSnapThresholdPixels = 16.0;
  static const _snapIndicatorColor = 0xFF7C3AED;
  static const _fenceColor = 0xFF7C3AED;
  // Fallback map center for a brand-new territory with no neighbors yet
  // to average a position from — same reference point the viewer screen
  // starts its own camera at.
  static const _defaultCenter = MapCoordinate(
    longitude: -46.6333,
    latitude: -23.5505,
  );
  // Generous tap target for grabbing a handle — bigger than the 5-7px
  // circle it's drawn as, since a fingertip is much wider than that.
  static const _handleHitRadiusPixels = 28.0;
  // A touch has to move at least this many logical pixels from where it
  // landed on a handle before it's treated as a drag rather than a tap —
  // see `_handlePointerMove`'s "arming" step for why.
  static const _dragArmDistancePixels = 6.0;

  static bool _isDrawingMode(EditorMode mode) =>
      mode == EditorMode.addArea || mode == EditorMode.removeArea;

  static int _drawingColorFor(EditorMode mode) =>
      mode == EditorMode.removeArea ? _removeColor : _addColor;

  MapboxMap? _mapboxMap;
  PolygonAnnotationManager? _fillManager;
  PolylineAnnotationManager? _borderManager;
  // Neighbor territories are purely decorative context — greyed-out shapes
  // that exist only so overlap/snap can be seen while editing. They live
  // on their own managers, with no tap/drag listeners attached at all, so
  // they never intercept a tap meant for drawing or selecting the
  // territory actually being edited (e.g. a Remove-area cut that has to
  // pass over a neighbor's shape to close its loop).
  PolygonAnnotationManager? _neighborFillManager;
  PolylineAnnotationManager? _neighborBorderManager;
  // The manager zone a rep patch is being fenced to — a dashed outline
  // with no fill, so it never gets mistaken for a real neighbor shape.
  PolylineAnnotationManager? _fenceBorderManager;
  PolylineAnnotationManager? _drawPreviewManager;
  CircleAnnotationManager? _handleManager;
  CircleAnnotationManager? _snapIndicatorManager;

  bool _mapReady = false;
  bool _mapUnavailable = false;
  bool _viewportApplied = false;
  bool _initialFitDone = false;
  bool _suppressNextMapTapDeselect = false;
  // The metadata form is pushed as its own route (not built inline) so it
  // gets its own back-swipe/keyboard behavior — this just makes sure it's
  // only launched once per creating session, right after the first frame.
  bool _metadataFormLaunched = false;

  // `_render` is fired off (unawaited) from `ref.listen` on every state
  // change, so a burst of quick changes — e.g. placing several drawing
  // points, or a point placement immediately followed by `finishDrawing`
  // — can have multiple overlapping `_render` calls in flight at once,
  // all mutating the same annotation managers. Without this, whichever
  // call's `deleteAll`/`create` awaits happen to resolve *last* wins,
  // which is not necessarily the most recent one — leaving stale
  // annotations (e.g. a mid-drawing preview) on screen until some later
  // render happens to land in the right order. Every `_render` call grabs
  // its own token and checks it's still current before each manager
  // mutation, so a call superseded by a newer one bails out instead of
  // overwriting that newer call's result.
  int _renderToken = 0;

  // Tap-to-act (delete a vertex, toggle an edge's selection) stays on
  // Mapbox's own native tap recognizer — these two maps are only used to
  // turn a tapped annotation's id back into the ref it represents.
  final Map<String, VertexRef> _vertexByAnnotationId = {};
  final Map<String, EdgeRef> _midpointByAnnotationId = {};

  // Dragging (moving a vertex/edge/whole polygon) and placing a drawing
  // point (Add/Remove area) are both driven entirely by hand here — see
  // the "gestures: pointer handling" section below for why Mapbox's own
  // annotation-drag and map-tap listeners aren't used for either.
  _DragKind _dragKind = _DragKind.none;
  VertexRef? _draggingVertex;
  EdgeRef? _draggingEdge;
  int? _draggingPartIndex;
  MapCoordinate? _lastDragPosition;
  _PendingHandleHit? _pendingHit;
  Offset? _pointerDownPosition;
  // Only ever the *first* finger currently on the map is tracked above —
  // a second, concurrent touch (e.g. the other finger of a pinch-zoom)
  // is ignored outright rather than clobbering it.
  int? _activePointerId;

  /// Magnetic snap targets for the vertex currently being dragged — screen
  /// pixel positions are cached once a drag arms (see
  /// `_prepareSnapCandidates`) so each move only needs a single
  /// `pixelForCoordinate` call (for the finger's own position), not one
  /// per candidate.
  List<_SnapCandidate> _snapCandidates = const [];
  String? _snapIndicatorAnnotationId;
  int _dragSession = 0;

  @override
  void initState() {
    super.initState();
    final token = AppConfig.mapboxAccessToken;
    if (token.isNotEmpty) MapboxOptions.setAccessToken(token);
  }

  /// The map (and everything drawn on it) only ever gets built once
  /// there's real geometry context to show — an existing territory's own
  /// boundary, or (for a new one) the draft the metadata form produced.
  static bool _readyForMap(TerritoryEditorState state) =>
      !state.loading &&
      (state.original != null || (state.isCreating && state.draft != null));

  @override
  Widget build(BuildContext context) {
    final provider = territoryEditorControllerProvider(widget.target);
    final state = ref.watch(provider);

    ref.listen(provider, (previous, next) {
      if (!_readyForMap(next)) return;
      _render(next);
      if (next.fenceZone?.id != previous?.fenceZone?.id &&
          next.fenceZone != null) {
        unawaited(_frameOnFence(next.fenceZone!));
      }
    });

    if (state.isCreating && state.draft == null && !_metadataFormLaunched) {
      _metadataFormLaunched = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _showMetadataForm(context);
      });
    }

    return PopScope(
      canPop: !state.isDirty,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        await _requestExit(context, state);
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        body: Stack(
          children: [
            if (state.isCreating && state.draft == null)
              const _CenteredMessage(loading: true)
            else if (AppConfig.mapboxAccessToken.isEmpty || _mapUnavailable)
              const _CenteredMessage(
                icon: Icons.map_outlined,
                title: 'Mapa indisponível',
                message: 'Não foi possível carregar o mapa agora.',
              )
            else if (_readyForMap(state))
              Positioned.fill(
                // A plain `Listener` — it only observes pointer events
                // (it never claims/consumes the gesture), so the map
                // widget underneath still receives every touch normally.
                // This is what drives dragging a handle by hand — see
                // `_handlePointerDown`.
                child: Listener(
                  onPointerDown: _handlePointerDown,
                  onPointerMove: _handlePointerMove,
                  onPointerUp: _handlePointerUp,
                  onPointerCancel: _handlePointerUp,
                  child: _buildMap(state),
                ),
              ),
            if (state.loading) const _CenteredMessage(loading: true),
            if (state.loadError != null)
              _CenteredMessage(
                icon: Icons.error_outline,
                title: 'Não foi possível abrir o editor',
                message: state.loadError!,
              ),
            if (!state.loading &&
                state.loadError == null &&
                _readyForMap(state))
              SafeArea(child: _buildChrome(context, state)),
          ],
        ),
      ),
    );
  }

  Future<void> _showMetadataForm(
    BuildContext context, {
    TerritoryDraft? initial,
  }) async {
    final target = widget.target;
    final TerritoryDraft? draft;
    if (target.inviteContextLocked) {
      draft = await InvitePatchNameForm.show(
        context,
        initialName: initial?.name,
        verticalId: target.initialVerticalId!,
        verticalName: target.initialVerticalName ?? 'Linha comercial',
        managerTerritoryId: target.initialManagerTerritoryId!,
        managerTerritoryName: target.initialManagerTerritoryName ?? 'Zona',
      );
    } else {
      draft = await TerritoryMetadataForm.show(
        context,
        initial: initial,
        initialKind:
            initial?.kind ?? target.initialKind ?? TerritoryKind.managerZone,
        initialVerticalId: initial?.verticalId ?? target.initialVerticalId,
        initialManagerTerritoryId: target.initialManagerTerritoryId,
      );
    }
    if (!mounted) return;
    if (draft == null) {
      // Backing out of the very first form leaves nothing to edit — close
      // the editor entirely instead of leaving it stuck on a blank state.
      if (initial == null && context.mounted) Navigator.of(context).pop();
      return;
    }
    await _controller.setDraft(draft);
  }

  Widget _buildMap(TerritoryEditorState state) {
    final centroid = _initialMapCenter(state);
    return MapWidget(
      key: const ValueKey('mapa-editor-territorio'),
      styleUri: MapboxStyles.STANDARD,
      viewport: _viewportApplied
          ? null
          : CameraViewportState(center: _point(centroid), zoom: 14),
      onMapCreated: (mapboxMap) {
        _mapboxMap = mapboxMap;
        _viewportApplied = true;
        mapboxMap.scaleBar.updateSettings(ScaleBarSettings(enabled: false));
      },
      onStyleLoadedListener: (_) async {
        await useFlatProjection(_mapboxMap);
        await _configureMap();
      },
      onMapLoadErrorListener: (_) => setState(() => _mapUnavailable = true),
      // ignore: deprecated_member_use
      onTapListener: _handleMapTap,
    );
  }

  Future<void> _configureMap() async {
    final mapboxMap = _mapboxMap;
    if (mapboxMap == null || !mounted) return;
    try {
      // Created first so their map layers sit *below* the target's own
      // fill/border layers created next — neighbors are background
      // context, the target territory is always drawn on top of them.
      _neighborFillManager = await mapboxMap.annotations
          .createPolygonAnnotationManager();
      _neighborBorderManager = await mapboxMap.annotations
          .createPolylineAnnotationManager();
      _fenceBorderManager = await mapboxMap.annotations
          .createPolylineAnnotationManager();
      await _fenceBorderManager!.setLineDasharray([3, 2]);
      _fillManager = await mapboxMap.annotations
          .createPolygonAnnotationManager();
      _borderManager = await mapboxMap.annotations
          .createPolylineAnnotationManager();
      _drawPreviewManager = await mapboxMap.annotations
          .createPolylineAnnotationManager();
      await _drawPreviewManager!.setLineDasharray([2, 2]);
      _handleManager = await mapboxMap.annotations
          .createCircleAnnotationManager();
      _snapIndicatorManager = await mapboxMap.annotations
          .createCircleAnnotationManager();

      _fillManager!.tapEvents(onTap: _handleFillTap);
      _handleManager!.tapEvents(onTap: _handleHandleTap);

      _mapReady = true;
      final state = ref.read(territoryEditorControllerProvider(widget.target));
      await _render(state);
      if (!_initialFitDone) {
        _initialFitDone = true;
        await _fitToTerritory(state);
      }
    } catch (_) {
      if (mounted) setState(() => _mapUnavailable = true);
    }
  }

  /// A new territory has no boundary of its own to center on yet — this
  /// falls back to the average of same-kind/sector neighbors (so the map
  /// opens somewhere relevant to the sector being drawn in), and finally
  /// to a fixed default if there's no other context at all.
  MapCoordinate _initialMapCenter(TerritoryEditorState state) {
    final original = state.original;
    if (original != null) return original.centroid;
    final neighbors = state.neighbors;
    if (neighbors.isEmpty) return _defaultCenter;
    var lng = 0.0;
    var lat = 0.0;
    for (final neighbor in neighbors) {
      lng += neighbor.centroid.longitude;
      lat += neighbor.centroid.latitude;
    }
    return MapCoordinate(
      longitude: lng / neighbors.length,
      latitude: lat / neighbors.length,
    );
  }

  Future<void> _fitToTerritory(TerritoryEditorState state) async {
    final mapboxMap = _mapboxMap;
    final original = state.original;
    if (mapboxMap == null || original == null) return;
    final bounds = original.boundary.bounds;
    if (bounds == null) return;
    try {
      final coordinateBounds = CoordinateBounds(
        southwest: _point(bounds.southwest),
        northeast: _point(bounds.northeast),
        infiniteBounds: false,
      );
      final camera = await mapboxMap.cameraForCoordinateBounds(
        coordinateBounds,
        MbxEdgeInsets(top: 130, left: 40, bottom: 190, right: 40),
        null,
        null,
        null,
        null,
      );
      await mapboxMap.easeTo(camera, MapAnimationOptions(duration: 500));
    } catch (_) {
      // Best-effort camera fit.
    }
  }

  /// Frames the camera on a manager zone right as it's picked for a rep
  /// patch being drawn/edited — drawing guidance, since every commit is
  /// already clipped to stay inside it regardless of what's on screen.
  Future<void> _frameOnFence(Territory fenceZone) async {
    final mapboxMap = _mapboxMap;
    final bounds = fenceZone.boundary.bounds;
    if (mapboxMap == null || bounds == null) return;
    try {
      final coordinateBounds = CoordinateBounds(
        southwest: _point(bounds.southwest),
        northeast: _point(bounds.northeast),
        infiniteBounds: false,
      );
      final camera = await mapboxMap.cameraForCoordinateBounds(
        coordinateBounds,
        MbxEdgeInsets(top: 130, left: 40, bottom: 190, right: 40),
        null,
        null,
        null,
        null,
      );
      await mapboxMap.easeTo(camera, MapAnimationOptions(duration: 550));
    } catch (_) {
      // Best-effort camera fit.
    }
  }

  // ---- rendering -----------------------------------------------------------

  Future<void> _render(TerritoryEditorState state) async {
    final token = ++_renderToken;
    final fillManager = _fillManager;
    final borderManager = _borderManager;
    final neighborFillManager = _neighborFillManager;
    final neighborBorderManager = _neighborBorderManager;
    final working = state.working;
    if (fillManager == null ||
        borderManager == null ||
        neighborFillManager == null ||
        neighborBorderManager == null ||
        !_mapReady ||
        working == null) {
      return;
    }

    final neighborFillOptions = <PolygonAnnotationOptions>[];
    final neighborBorderOptions = <PolylineAnnotationOptions>[];
    for (final neighbor in state.neighbors) {
      for (final part in neighbor.boundary.coordinates) {
        if (part.isEmpty) continue;
        neighborFillOptions.add(
          PolygonAnnotationOptions(
            geometry: Polygon.fromPoints(
              points: part.map(_ringToPoints).toList(),
            ),
            fillColor: _neighborColor,
            fillOpacity: 0.32,
          ),
        );
        for (final ring in part) {
          neighborBorderOptions.add(
            PolylineAnnotationOptions(
              geometry: LineString.fromPoints(points: _ringToPoints(ring)),
              lineColor: _neighborColor,
              lineWidth: 1.3,
              lineJoin: LineJoin.ROUND,
            ),
          );
        }
      }
    }
    if (token != _renderToken) return;
    await neighborFillManager.deleteAll();
    if (token != _renderToken) return;
    await neighborBorderManager.deleteAll();
    if (token != _renderToken) return;
    await neighborFillManager.createMulti(neighborFillOptions);
    if (token != _renderToken) return;
    await neighborBorderManager.createMulti(neighborBorderOptions);
    if (token != _renderToken) return;

    await _renderFence(state, token);
    if (token != _renderToken) return;

    final fillOptions = <PolygonAnnotationOptions>[];
    final haloOptions = <PolylineAnnotationOptions>[];
    final borderOptions = <PolylineAnnotationOptions>[];

    final kind = state.original?.kind ?? state.draft?.kind;
    final kindColor = kind == TerritoryKind.managerZone
        ? _managerZoneColor
        : _repPatchColor;

    for (var partIndex = 0; partIndex < working.length; partIndex++) {
      final selected = state.selectedPart == partIndex;
      final part = working[partIndex]
          .map(TerritoryGeometryEditor.closeRing)
          .toList();
      final lineColor = selected ? _selectedColor : kindColor;

      fillOptions.add(
        PolygonAnnotationOptions(
          geometry: Polygon.fromPoints(
            points: part.map(_ringToPoints).toList(),
          ),
          fillColor: kindColor,
          fillOpacity: selected ? 0.40 : 0.22,
          fillOutlineColor: lineColor,
          customData: {'partIndex': partIndex},
        ),
      );

      for (final ring in part) {
        final points = _ringToPoints(ring);
        haloOptions.add(
          PolylineAnnotationOptions(
            geometry: LineString.fromPoints(points: points),
            lineColor: _haloColor,
            lineWidth: selected ? 5.0 : 3.4,
            lineJoin: LineJoin.ROUND,
          ),
        );
        borderOptions.add(
          PolylineAnnotationOptions(
            geometry: LineString.fromPoints(points: points),
            lineColor: lineColor,
            lineWidth: selected ? 3.0 : 1.8,
            lineJoin: LineJoin.ROUND,
          ),
        );
      }

      final selectedEdge = state.selectedEdge;
      final openRings = working[partIndex];
      if (selected &&
          selectedEdge != null &&
          selectedEdge.partIndex == partIndex &&
          selectedEdge.ringIndex < openRings.length &&
          selectedEdge.startIndex < openRings[selectedEdge.ringIndex].length) {
        final ring = working[partIndex][selectedEdge.ringIndex];
        final a = ring[selectedEdge.startIndex];
        final b = ring[(selectedEdge.startIndex + 1) % ring.length];
        borderOptions.add(
          PolylineAnnotationOptions(
            geometry: LineString.fromPoints(points: [_point(a), _point(b)]),
            lineColor: _edgeSelectedColor,
            lineWidth: 4.5,
            lineJoin: LineJoin.ROUND,
          ),
        );
      }
    }

    await fillManager.deleteAll();
    if (token != _renderToken) return;
    await borderManager.deleteAll();
    if (token != _renderToken) return;
    await fillManager.createMulti(fillOptions);
    if (token != _renderToken) return;
    await borderManager.createMulti([...haloOptions, ...borderOptions]);
    if (token != _renderToken) return;

    await _renderDrawPreview(state, token);
    if (token != _renderToken) return;
    await _renderHandles(state, token);
  }

  Future<void> _renderFence(TerritoryEditorState state, int token) async {
    final fenceManager = _fenceBorderManager;
    if (fenceManager == null) return;
    await fenceManager.deleteAll();
    if (token != _renderToken) return;

    final fenceZone = state.fenceZone;
    if (fenceZone == null) return;

    final options = <PolylineAnnotationOptions>[
      for (final part in fenceZone.boundary.coordinates)
        for (final ring in part)
          PolylineAnnotationOptions(
            geometry: LineString.fromPoints(
              points: _ringToPoints(TerritoryGeometryEditor.closeRing(ring)),
            ),
            lineColor: _fenceColor,
            lineWidth: 2.4,
            lineJoin: LineJoin.ROUND,
          ),
    ];
    await fenceManager.createMulti(options);
  }

  Future<void> _renderDrawPreview(TerritoryEditorState state, int token) async {
    final previewManager = _drawPreviewManager;
    if (previewManager == null) return;
    await previewManager.deleteAll();
    if (token != _renderToken) return;
    if (!_isDrawingMode(state.mode) || state.drawingPoints.length < 2) {
      return;
    }
    await previewManager.create(
      PolylineAnnotationOptions(
        geometry: LineString.fromPoints(
          points: _ringToPoints(state.drawingPoints),
        ),
        lineColor: _drawingColorFor(state.mode),
        lineWidth: 2.6,
        lineJoin: LineJoin.ROUND,
      ),
    );
  }

  Future<void> _renderHandles(TerritoryEditorState state, int token) async {
    final handleManager = _handleManager;
    if (handleManager == null) return;

    await handleManager.deleteAll();
    if (token != _renderToken) return;
    _vertexByAnnotationId.clear();
    _midpointByAnnotationId.clear();

    if (_isDrawingMode(state.mode)) {
      if (state.drawingPoints.isEmpty) return;
      final color = _drawingColorFor(state.mode);
      await handleManager.createMulti([
        for (var i = 0; i < state.drawingPoints.length; i++)
          CircleAnnotationOptions(
            geometry: _point(state.drawingPoints[i]),
            circleRadius: i == 0 ? 7 : 5,
            circleColor: color,
            circleStrokeColor: _haloColor,
            circleStrokeWidth: 2,
          ),
      ]);
      return;
    }

    final working = state.working;
    final partIndex = state.selectedPart;
    if (working == null || partIndex == null || partIndex >= working.length) {
      return;
    }

    if (token != _renderToken) return;

    if (state.selectionAction == SelectionAction.move) {
      final centroid = _averagePoint(working[partIndex].first);
      await handleManager.create(
        CircleAnnotationOptions(
          geometry: _point(centroid),
          circleRadius: 13,
          circleColor: _moveHandleColor,
          circleStrokeColor: _haloColor,
          circleStrokeWidth: 2.5,
        ),
      );
      return;
    }

    if (state.selectionAction != SelectionAction.boundary) return;

    // Stage 1 edits the exterior ring only — holes arrive with Remove area.
    final ring = working[partIndex].first;
    final ringLength = ring.length;

    final vertexOptions = <CircleAnnotationOptions>[];
    final vertexRefs = <VertexRef>[];
    final midpointOptions = <CircleAnnotationOptions>[];
    final midpointRefs = <EdgeRef>[];

    for (var i = 0; i < ringLength; i++) {
      vertexOptions.add(
        CircleAnnotationOptions(
          geometry: _point(ring[i]),
          circleRadius: 7,
          circleColor: _vertexFill,
          circleStrokeColor: _handleStroke,
          circleStrokeWidth: 2.5,
        ),
      );
      vertexRefs.add(
        VertexRef(partIndex: partIndex, ringIndex: 0, pointIndex: i),
      );

      final next = ring[(i + 1) % ringLength];
      final isEdgeSelected =
          state.selectedEdge ==
          EdgeRef(partIndex: partIndex, ringIndex: 0, startIndex: i);
      midpointOptions.add(
        CircleAnnotationOptions(
          geometry: _point(GeometryMath.midpoint(ring[i], next)),
          circleRadius: isEdgeSelected ? 7 : 5,
          circleColor: isEdgeSelected ? _edgeSelectedColor : _midpointFill,
          circleStrokeColor: _handleStroke,
          circleStrokeWidth: 1.5,
        ),
      );
      midpointRefs.add(
        EdgeRef(partIndex: partIndex, ringIndex: 0, startIndex: i),
      );
    }

    final createdVertices = await handleManager.createMulti(vertexOptions);
    if (token != _renderToken) return;
    for (var i = 0; i < createdVertices.length; i++) {
      final annotation = createdVertices[i];
      if (annotation != null) {
        _vertexByAnnotationId[annotation.id] = vertexRefs[i];
      }
    }
    final createdMidpoints = await handleManager.createMulti(midpointOptions);
    if (token != _renderToken) return;
    for (var i = 0; i < createdMidpoints.length; i++) {
      final annotation = createdMidpoints[i];
      if (annotation != null) {
        _midpointByAnnotationId[annotation.id] = midpointRefs[i];
      }
    }
  }

  // ---- gestures --------------------------------------------------------

  TerritoryEditorController get _controller =>
      ref.read(territoryEditorControllerProvider(widget.target).notifier);

  TerritoryEditorState get _state =>
      ref.read(territoryEditorControllerProvider(widget.target));

  // Only the target territory's own parts are ever on `_fillManager` (see
  // `_neighborFillManager`), so a tap here always belongs to the
  // territory actually being edited.
  void _handleFillTap(PolygonAnnotation annotation) {
    if (_state.mode != EditorMode.select) return;
    // `customData` round-trips through a platform channel that encodes
    // numbers as `double`, not `int` — cast through `num` rather than
    // straight to `int` or this throws at runtime.
    final partIndex = (annotation.customData?['partIndex'] as num?)?.toInt();
    if (partIndex == null) return;
    _suppressNextMapTapDeselect = true;
    _controller.selectPart(partIndex);
  }

  // Placing a drawing point is handled entirely from raw pointer events
  // (see `_handlePointerUp`) rather than from this native tap listener —
  // a tap landing on the target territory's own fill gets claimed by
  // `_handleFillTap`'s annotation-click listener first, so it would
  // never even reach here. That matters a lot for Add/Remove area: a
  // Remove cut is almost always mostly *inside* the existing shape, so
  // this listener alone would make it near-impossible to draw one.
  void _handleMapTap(MapContentGestureContext context) {
    if (_suppressNextMapTapDeselect) {
      _suppressNextMapTapDeselect = false;
      return;
    }

    if (_state.mode == EditorMode.select && _state.selectedPart != null) {
      _controller.clearSelection();
    }
  }

  Future<void> _handleDrawTap(MapCoordinate tapped) async {
    final points = _state.drawingPoints;
    if (points.length >= 3 && await _isNearScreen(tapped, points.first)) {
      final finished = _controller.finishDrawing();
      if (finished) {
        HapticFeedback.mediumImpact();
      } else {
        HapticFeedback.vibrate();
      }
      return;
    }

    final added = _controller.addDrawingPoint(tapped);
    if (added) {
      HapticFeedback.selectionClick();
    } else {
      HapticFeedback.vibrate();
    }
  }

  Future<bool> _isNearScreen(MapCoordinate a, MapCoordinate b) async {
    final mapboxMap = _mapboxMap;
    if (mapboxMap == null) return false;
    try {
      final pixelA = await mapboxMap.pixelForCoordinate(_point(a));
      final pixelB = await mapboxMap.pixelForCoordinate(_point(b));
      final dx = pixelA.x - pixelB.x;
      final dy = pixelA.y - pixelB.y;
      return (dx * dx + dy * dy) <= _snapThresholdPixels * _snapThresholdPixels;
    } catch (_) {
      return false;
    }
  }

  void _handleHandleTap(CircleAnnotation annotation) {
    _suppressNextMapTapDeselect = true;

    final vertexRef = _vertexByAnnotationId[annotation.id];
    if (vertexRef != null) {
      _controller.deleteVertexAt(vertexRef);
      return;
    }

    final edgeRef = _midpointByAnnotationId[annotation.id];
    if (edgeRef != null) {
      if (_state.selectedEdge == edgeRef) {
        _controller.clearEdgeSelection();
      } else {
        _controller.selectEdge(edgeRef);
      }
    }
  }

  // ---- gestures: pointer handling ----------------------------------------
  //
  // Two things are driven entirely by hand here, from raw `Listener`
  // pointer events, rather than through Mapbox's own tap/drag listeners:
  //
  // 1. Dragging a handle, instead of `CircleAnnotationManager.dragEvents`.
  //    On iOS, an annotation only starts dragging after a deliberate
  //    press-and-hold (mapbox/mapbox-maps-flutter#1003, "intentional"),
  //    which always loses the race against the map's own pan gesture on
  //    a normal quick drag — and there's no supported way to disable
  //    *just* the map's pan *only* while a touch is actually on a
  //    handle, short of doing the hit test ourselves anyway.
  //
  // 2. Placing an Add/Remove area drawing point, instead of the map's
  //    generic tap listener (`_handleMapTap`). A tap landing on the
  //    target territory's own fill gets claimed by `_handleFillTap`'s
  //    annotation-click listener first and never reaches the generic
  //    one — and a Remove cut in particular is almost always mostly
  //    *inside* the existing shape, so relying on it would make Remove
  //    near-unusable.
  //
  // Both convert the pointer's position to a map coordinate by hand and
  // feed it to the same controller methods the native paths used to
  // call. Neither "commits" on pointer-down, though: a handle drag would
  // otherwise push an undo snapshot for a plain tap meant for
  // `_handleHandleTap` (delete-vertex / select-edge), and a drawing tap
  // would place a point even when the touch turns out to be a pan. Both
  // are instead kept "pending" until released — armed as a drag only
  // once the touch has moved past `_dragArmDistancePixels`; otherwise,
  // on release, treated as the tap it was.

  Future<void> _handlePointerDown(PointerDownEvent event) async {
    if (_activePointerId != null) {
      return; // a different finger is already tracked
    }
    final state = _state;

    if (_isDrawingMode(state.mode)) {
      _activePointerId = event.pointer;
      _pointerDownPosition = event.localPosition;
      return;
    }

    final mapboxMap = _mapboxMap;
    if (mapboxMap == null || state.mode != EditorMode.select) return;
    final working = state.working;
    final partIndex = state.selectedPart;
    if (working == null || partIndex == null || partIndex >= working.length) {
      return;
    }

    final hit = await _hitTestHandle(
      mapboxMap,
      state,
      working,
      partIndex,
      event.localPosition,
    );
    if (hit == null) return;
    // The touch may already have ended (or a new one begun) by the time
    // the hit test above resolves.
    if (!mounted || _activePointerId != null || _dragKind != _DragKind.none) {
      return;
    }
    _activePointerId = event.pointer;
    _pendingHit = hit;
    _pointerDownPosition = event.localPosition;
  }

  Future<_PendingHandleHit?> _hitTestHandle(
    MapboxMap mapboxMap,
    TerritoryEditorState state,
    GeometryParts working,
    int partIndex,
    Offset touch,
  ) async {
    if (state.selectionAction == SelectionAction.move) {
      final centroid = _averagePoint(working[partIndex].first);
      final pixels = await mapboxMap.pixelsForCoordinates([_point(centroid)]);
      final pixel = pixels.isEmpty ? null : pixels.first;
      if (pixel == null ||
          _distSq(pixel, touch) >
              _handleHitRadiusPixels * _handleHitRadiusPixels) {
        return null;
      }
      return _PendingHandleHit.move(partIndex: partIndex, at: centroid);
    }

    if (state.selectionAction != SelectionAction.boundary) return null;

    final ring = working[partIndex].first;
    final n = ring.length;
    if (n == 0) return null;
    final midpoints = [
      for (var i = 0; i < n; i++)
        GeometryMath.midpoint(ring[i], ring[(i + 1) % n]),
    ];
    final pixels = await mapboxMap.pixelsForCoordinates([
      ...ring.map(_point),
      ...midpoints.map(_point),
    ]);

    var bestDistSq = _handleHitRadiusPixels * _handleHitRadiusPixels;
    int? bestVertex;
    int? bestMidpoint;
    for (var i = 0; i < n; i++) {
      final pixel = pixels[i];
      if (pixel == null) continue;
      final d = _distSq(pixel, touch);
      if (d <= bestDistSq) {
        bestDistSq = d;
        bestVertex = i;
        bestMidpoint = null;
      }
    }
    for (var i = 0; i < n; i++) {
      final pixel = pixels[n + i];
      if (pixel == null) continue;
      final d = _distSq(pixel, touch);
      if (d <= bestDistSq) {
        bestDistSq = d;
        bestMidpoint = i;
        bestVertex = null;
      }
    }

    if (bestVertex != null) {
      return _PendingHandleHit.vertex(
        VertexRef(partIndex: partIndex, ringIndex: 0, pointIndex: bestVertex),
      );
    }
    if (bestMidpoint != null) {
      final edgeRef = EdgeRef(
        partIndex: partIndex,
        ringIndex: 0,
        startIndex: bestMidpoint,
      );
      return state.selectedEdge == edgeRef
          ? _PendingHandleHit.edge(edgeRef, at: midpoints[bestMidpoint])
          : _PendingHandleHit.midpoint(edgeRef, at: midpoints[bestMidpoint]);
    }
    return null;
  }

  double _distSq(ScreenCoordinate pixel, Offset touch) {
    final dx = pixel.x - touch.dx;
    final dy = pixel.y - touch.dy;
    return dx * dx + dy * dy;
  }

  Future<void> _handlePointerMove(PointerMoveEvent event) async {
    if (event.pointer != _activePointerId) return;
    // Drawing-mode taps aren't "armed" mid-move — see `_handlePointerUp`,
    // which decides tap-vs-pan once the touch is released.
    if (_pendingHit == null && _dragKind == _DragKind.none) return;

    if (_dragKind == _DragKind.none) {
      await _maybeArmPendingDrag(event.localPosition);
      if (_dragKind == _DragKind.none) return;
    }

    final mapboxMap = _mapboxMap;
    if (mapboxMap == null) return;
    MapCoordinate position;
    try {
      final point = await mapboxMap.coordinateForPixel(
        ScreenCoordinate(x: event.localPosition.dx, y: event.localPosition.dy),
      );
      position = _fromPoint(point);
    } catch (_) {
      return;
    }

    switch (_dragKind) {
      case _DragKind.vertex:
        await _applyVertexDrag(_draggingVertex!, position);
      case _DragKind.edge:
        final last = _lastDragPosition;
        if (last != null) {
          _controller.updateEdgeDrag(
            _draggingEdge!,
            position.longitude - last.longitude,
            position.latitude - last.latitude,
          );
        }
        _lastDragPosition = position;
      case _DragKind.move:
        final last = _lastDragPosition;
        if (last != null) {
          _controller.updatePolygonMove(
            _draggingPartIndex!,
            position.longitude - last.longitude,
            position.latitude - last.latitude,
          );
        }
        _lastDragPosition = position;
      case _DragKind.none:
        break;
    }
  }

  /// Turns a pending hit into an active drag once the touch has moved far
  /// enough from where it landed — see the section doc comment above for
  /// why this can't just happen on pointer-down.
  Future<void> _maybeArmPendingDrag(Offset current) async {
    final pending = _pendingHit;
    final downAt = _pointerDownPosition;
    if (pending == null || downAt == null) return;
    final dx = current.dx - downAt.dx;
    final dy = current.dy - downAt.dy;
    if (dx * dx + dy * dy < _dragArmDistancePixels * _dragArmDistancePixels) {
      return;
    }

    _pendingHit = null;
    _pointerDownPosition = null;

    switch (pending.kind) {
      case _PendingKind.vertex:
        _controller.beginVertexDrag(pending.vertexRef!);
        _armVertexDrag(pending.vertexRef!);
      case _PendingKind.edgeSelected:
        _controller.beginEdgeDrag(pending.edgeRef!);
        _dragKind = _DragKind.edge;
        _draggingEdge = pending.edgeRef;
        _lastDragPosition = pending.at;
        await _lockScroll(true);
      case _PendingKind.midpointUnselected:
        final promoted = _controller.beginMidpointDrag(
          pending.edgeRef!,
          pending.at!,
        );
        if (promoted != null) _armVertexDrag(promoted);
      case _PendingKind.move:
        _controller.beginPolygonMove(pending.partIndex!);
        _dragKind = _DragKind.move;
        _draggingPartIndex = pending.partIndex;
        _lastDragPosition = pending.at;
        await _lockScroll(true);
    }
  }

  void _armVertexDrag(VertexRef ref) {
    _dragKind = _DragKind.vertex;
    _draggingVertex = ref;
    _snapCandidates = const [];
    final session = ++_dragSession;
    unawaited(_prepareSnapCandidates(ref, session));
    unawaited(_lockScroll(true));
  }

  /// Feeds a vertex drag through the magnetic snap check before handing
  /// the position to the controller — see [_prepareSnapCandidates] for
  /// why only one `pixelForCoordinate` call is needed per frame here.
  Future<void> _applyVertexDrag(
    VertexRef vertexRef,
    MapCoordinate rawPosition,
  ) async {
    final mapboxMap = _mapboxMap;
    if (mapboxMap == null || _snapCandidates.isEmpty) {
      _controller.updateVertexDrag(vertexRef, rawPosition);
      return;
    }
    try {
      final pixel = await mapboxMap.pixelForCoordinate(_point(rawPosition));
      final snapped = _findSnap(pixel.x, pixel.y);
      _controller.updateVertexDrag(vertexRef, snapped ?? rawPosition);
      await _updateSnapIndicator(snapped);
    } catch (_) {
      _controller.updateVertexDrag(vertexRef, rawPosition);
    }
  }

  Future<void> _handlePointerUp(PointerEvent event) async {
    if (event.pointer != _activePointerId) return;
    _activePointerId = null;

    if (_isDrawingMode(_state.mode) && _dragKind == _DragKind.none) {
      final downAt = _pointerDownPosition;
      _pointerDownPosition = null;
      // Moved too far to be a tap — it was a pan instead, leave it alone.
      if (downAt == null ||
          (event.localPosition - downAt).distanceSquared >
              _dragArmDistancePixels * _dragArmDistancePixels) {
        return;
      }
      final mapboxMap = _mapboxMap;
      if (mapboxMap == null) return;
      try {
        final point = await mapboxMap.coordinateForPixel(
          ScreenCoordinate(
            x: event.localPosition.dx,
            y: event.localPosition.dy,
          ),
        );
        await _handleDrawTap(_fromPoint(point));
      } catch (_) {
        // Best-effort — worst case this one tap is silently dropped.
      }
      return;
    }

    // Never armed — this was just a tap; leave it for `_handleHandleTap`.
    _pendingHit = null;
    _pointerDownPosition = null;

    switch (_dragKind) {
      case _DragKind.vertex:
        _controller.endVertexDrag();
      case _DragKind.edge:
        _controller.endEdgeDrag();
        _controller.clearEdgeSelection();
      case _DragKind.move:
        _controller.endPolygonMove();
      case _DragKind.none:
        return;
    }

    _dragKind = _DragKind.none;
    _draggingVertex = null;
    _draggingEdge = null;
    _draggingPartIndex = null;
    _lastDragPosition = null;
    _snapCandidates = const [];
    _dragSession++;
    unawaited(_updateSnapIndicator(null));
    await _lockScroll(false);
  }

  Future<void> _lockScroll(bool locked) async {
    final mapboxMap = _mapboxMap;
    if (mapboxMap == null) return;
    try {
      await mapboxMap.gestures.updateSettings(
        GesturesSettings(scrollEnabled: !locked),
      );
    } catch (_) {
      // Best-effort — worst case this one drag fights the map's own pan.
    }
  }

  // ---- boundary snapping -------------------------------------------------

  /// Caches every candidate snap target — every other vertex/edge of this
  /// territory's own working geometry, plus every vertex/edge of same-
  /// kind/sector neighbors — as *screen pixels*, once, right as a vertex
  /// drag starts. Each drag-changed frame then only has to convert the
  /// dragged position itself, keeping the live magnetic feel cheap.
  Future<void> _prepareSnapCandidates(VertexRef dragging, int session) async {
    final mapboxMap = _mapboxMap;
    final state = _state;
    final working = state.working;
    if (mapboxMap == null || working == null) return;

    final candidates = <_SnapCandidate>[];
    try {
      for (var p = 0; p < working.length; p++) {
        final isDraggedPart = p == dragging.partIndex;
        for (var r = 0; r < working[p].length; r++) {
          final isDraggedRing = isDraggedPart && r == dragging.ringIndex;
          await _addRingSnapCandidates(
            mapboxMap,
            candidates,
            working[p][r],
            skipIndex: isDraggedRing ? dragging.pointIndex : null,
          );
        }
      }
      for (final neighbor in state.neighbors) {
        for (final part in neighbor.boundary.coordinates) {
          for (final ring in part) {
            await _addRingSnapCandidates(mapboxMap, candidates, ring);
          }
        }
      }
    } catch (_) {
      // Best-effort — dragging still works without magnetic snapping.
    }

    // The drag this was building candidates for may have already ended
    // (or a new one begun) by the time every `pixelForCoordinate` call
    // above resolves — don't clobber whatever is current in that case.
    if (!mounted || session != _dragSession) return;
    _snapCandidates = candidates;
  }

  /// Adds every vertex of [ring] (skipping [skipIndex], the vertex
  /// actually being dragged) and every edge whose both endpoints aren't
  /// that same vertex (an edge touching the dragged point collapses
  /// towards the finger and isn't a meaningful snap target).
  Future<void> _addRingSnapCandidates(
    MapboxMap mapboxMap,
    List<_SnapCandidate> candidates,
    List<MapCoordinate> ring, {
    int? skipIndex,
  }) async {
    final n = ring.length;
    if (n < 2) return;
    final pixels = <ScreenCoordinate>[];
    for (final point in ring) {
      pixels.add(await mapboxMap.pixelForCoordinate(_point(point)));
    }
    for (var i = 0; i < n; i++) {
      if (i != skipIndex) {
        candidates.add(_SnapCandidate.vertex(ring[i], pixels[i]));
      }
      final next = (i + 1) % n;
      final touchesDragged = i == skipIndex || next == skipIndex;
      if (!touchesDragged) {
        candidates.add(
          _SnapCandidate.edge(ring[i], ring[next], pixels[i], pixels[next]),
        );
      }
    }
  }

  /// Nearest candidate within [_vertexSnapThresholdPixels] of ([px], [py]),
  /// or `null` if nothing is close enough.
  MapCoordinate? _findSnap(double px, double py) {
    MapCoordinate? best;
    var bestDistSq = _vertexSnapThresholdPixels * _vertexSnapThresholdPixels;
    for (final candidate in _snapCandidates) {
      final result = candidate.nearestTo(px, py);
      if (result.distSq <= bestDistSq) {
        bestDistSq = result.distSq;
        best = result.coordinate;
      }
    }
    return best;
  }

  /// Shows, moves, or hides the small ring that indicates a live magnetic
  /// snap — the visual feedback for boundary snapping while dragging.
  Future<void> _updateSnapIndicator(MapCoordinate? at) async {
    final manager = _snapIndicatorManager;
    if (manager == null) return;
    final existingId = _snapIndicatorAnnotationId;

    if (at == null) {
      if (existingId != null) {
        await manager.deleteAll();
        _snapIndicatorAnnotationId = null;
      }
      return;
    }

    if (existingId == null) {
      final created = await manager.create(
        CircleAnnotationOptions(
          geometry: _point(at),
          circleRadius: 12,
          circleColor: _snapIndicatorColor,
          circleOpacity: 0.16,
          circleStrokeColor: _snapIndicatorColor,
          circleStrokeWidth: 2.5,
        ),
      );
      _snapIndicatorAnnotationId = created.id;
    } else {
      await manager.update(
        CircleAnnotation(
          id: existingId,
          geometry: _point(at),
          circleRadius: 12,
          circleColor: _snapIndicatorColor,
          circleOpacity: 0.16,
          circleStrokeColor: _snapIndicatorColor,
          circleStrokeWidth: 2.5,
        ),
      );
    }
  }

  // ---- chrome ------------------------------------------------------------

  Widget _buildChrome(BuildContext context, TerritoryEditorState state) {
    final notifier = _controller;
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // `Wrap`, not `Row`: on most screens the back button sits at the
          // start and the toolbar at the end of a single line, but if the
          // toolbar (five modes + undo/redo) doesn't fit next to it on a
          // narrow phone, it drops to its own line below instead of
          // overflowing.
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 8,
            runSpacing: 8,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _RoundIconButton(
                    icon: Icons.arrow_back_rounded,
                    onTap: () => _requestExit(context, state),
                  ),
                  if (state.isCreating) ...[
                    const SizedBox(width: 8),
                    _RoundIconButton(
                      icon: Icons.edit_note_rounded,
                      onTap: () =>
                          _showMetadataForm(context, initial: state.draft),
                    ),
                  ],
                ],
              ),
              EditorToolbar(
                mode: state.mode,
                canUndo: state.canUndo,
                canRedo: state.canRedo,
                hasArea: state.working?.isNotEmpty ?? false,
                onModeChanged: notifier.setMode,
                onUndo: notifier.undo,
                onRedo: notifier.redo,
              ),
            ],
          ),
          if (!state.validation.isValid &&
              state.validation.message != null) ...[
            const SizedBox(height: 10),
            EditorValidationBanner(message: state.validation.message!),
          ],
          const Spacer(),
          if (_isDrawingMode(state.mode)) ...[
            Center(
              child: _DrawAreaBar(
                hint: state.mode == EditorMode.removeArea
                    ? 'Desenhe a área a remover'
                    : 'Desenhe a área a adicionar',
                finishLabel: state.mode == EditorMode.removeArea
                    ? 'Remover área'
                    : 'Adicionar área',
                color: Color(_drawingColorFor(state.mode)),
                pointCount: state.drawingPoints.length,
                canFinish: state.canFinishDrawing,
                onFinish: () {
                  if (notifier.finishDrawing()) {
                    HapticFeedback.mediumImpact();
                    return;
                  }
                  HapticFeedback.vibrate();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        _state.validation.message ??
                            'O contorno fechado cruza sobre si mesmo.',
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 10),
          ],
          if (state.mode == EditorMode.select &&
              state.selectedPart != null) ...[
            Center(
              child: EditorContextualBar(
                action: state.selectionAction,
                canDelete: state.canDeleteSelectedPart,
                onEditBoundary: () =>
                    notifier.chooseSelectionAction(SelectionAction.boundary),
                onMoveArea: () =>
                    notifier.chooseSelectionAction(SelectionAction.move),
                onDeleteArea: () => _confirmDeletePart(context, notifier),
              ),
            ),
            const SizedBox(height: 10),
          ],
          EditorSaveBar(
            canSave: state.canSave,
            saving: state.saving,
            onCancel: () => _requestExit(context, state),
            onSave: () => _handleSave(context, notifier),
            saveLabel: widget.target.confirmAsDraftOnly
                ? 'Confirmar área'
                : 'Salvar alterações',
          ),
        ],
      ),
    );
  }

  Future<void> _requestExit(
    BuildContext context,
    TerritoryEditorState state,
  ) async {
    if (state.isDirty) {
      final confirmed = await _confirmDiscard(context);
      if (!confirmed) return;
    }
    _controller.cancel();
    if (context.mounted) Navigator.of(context).pop();
  }

  Future<bool> _confirmDiscard(BuildContext context) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Descartar alterações?'),
        content: const Text(
          'As alterações feitas neste território serão perdidas.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Continuar editando'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            // The irreversible half of the choice, painted like the safe half.
            style: TextButton.styleFrom(foregroundColor: AppColors.red),
            child: const Text('Descartar'),
          ),
        ],
      ),
    );
    return result ?? false;
  }

  Future<void> _confirmDeletePart(
    BuildContext context,
    TerritoryEditorController notifier,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Excluir esta área?'),
        content: const Text(
          'Essa parte do território será removida. Você pode desfazer com "Desfazer".',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.red),
            child: const Text('Excluir'),
          ),
        ],
      ),
    );
    if (confirmed == true) notifier.deleteSelectedPart();
  }

  Future<void> _handleSave(
    BuildContext context,
    TerritoryEditorController notifier,
  ) async {
    if (widget.target.confirmAsDraftOnly) {
      await _confirmInviteDraft(context);
      return;
    }

    final ok = await notifier.save(
      confirmImpact: (clinics) =>
          BoundaryImpactSheet.confirm(context, clinics: clinics),
    );
    if (!context.mounted) return;
    if (ok) {
      final created = ref
          .read(territoryEditorControllerProvider(widget.target))
          .original;
      if (context.canPop()) {
        context.pop(created);
      } else {
        Navigator.of(context).pop(created);
      }
    } else {
      final message =
          ref
              .read(territoryEditorControllerProvider(widget.target))
              .saveError ??
          'Não foi possível salvar. Tente novamente.';
      // User cancelled impact sheet — no snackbar noise.
      final state = ref.read(territoryEditorControllerProvider(widget.target));
      if (state.saveError == null && !state.saved) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    }
  }

  Future<void> _confirmInviteDraft(BuildContext context) async {
    final state = ref.read(territoryEditorControllerProvider(widget.target));
    if (!state.canSave || state.working == null || state.draft == null) {
      final message =
          state.validation.message ??
          'Complete o desenho dentro da zona do gerente.';
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
      return;
    }

    final draftMeta = state.draft!;
    final zoneId = draftMeta.managerTerritoryId;
    if (zoneId == null || zoneId <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Selecione a zona do gerente.')),
      );
      return;
    }

    final geometry = TerritoryGeometryEditor.toGeometry(state.working!);
    final centroid =
        geometry.labelAnchor ?? const MapCoordinate(longitude: 0, latitude: 0);
    final result = TerritoryInviteDraft(
      name: draftMeta.name,
      verticalId: draftMeta.verticalId,
      managerTerritoryId: zoneId,
      boundary: geometry,
      centroid: centroid,
    );

    // Navigator.pop — invite opens editor via MaterialPageRoute, not go_router.
    Navigator.of(context).pop(result);
  }

  // ---- geometry <-> Mapbox helpers ---------------------------------------

  MapCoordinate _averagePoint(List<MapCoordinate> ring) {
    var lng = 0.0;
    var lat = 0.0;
    for (final point in ring) {
      lng += point.longitude;
      lat += point.latitude;
    }
    return MapCoordinate(
      longitude: lng / ring.length,
      latitude: lat / ring.length,
    );
  }

  List<Point> _ringToPoints(List<MapCoordinate> ring) =>
      ring.map(_point).toList();

  Point _point(MapCoordinate coordinate) =>
      Point(coordinates: Position(coordinate.longitude, coordinate.latitude));

  MapCoordinate _fromPoint(Point point) => MapCoordinate(
    longitude: point.coordinates.lng.toDouble(),
    latitude: point.coordinates.lat.toDouble(),
  );
}

class _DrawAreaBar extends StatelessWidget {
  final String hint;
  final String finishLabel;
  final Color color;
  final int pointCount;
  final bool canFinish;
  final VoidCallback onFinish;

  const _DrawAreaBar({
    required this.hint,
    required this.finishLabel,
    required this.color,
    required this.pointCount,
    required this.canFinish,
    required this.onFinish,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
            color: Color(0x3A111827),
            blurRadius: 18,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Flexible(
            child: Text(
              pointCount == 0
                  ? hint
                  : '$pointCount ponto${pointCount == 1 ? '' : 's'}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: AppColors.gray500,
              ),
            ),
          ),
          const SizedBox(width: 10),
          FilledButton(
            onPressed: canFinish ? onFinish : null,
            style: FilledButton.styleFrom(
              backgroundColor: color,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            child: Text(
              finishLabel,
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 12.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RoundIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _RoundIconButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      elevation: 3,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Icon(icon, size: 18, color: AppColors.gray700),
        ),
      ),
    );
  }
}

class _CenteredMessage extends StatelessWidget {
  final IconData? icon;
  final String? title;
  final String? message;
  final bool loading;

  const _CenteredMessage({
    this.icon,
    this.title,
    this.message,
    this.loading = false,
  });

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AppColors.background,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (loading)
                const SizedBox(
                  width: 32,
                  height: 32,
                  child: CircularProgressIndicator(strokeWidth: 3),
                )
              else if (icon != null)
                Icon(icon, size: 42, color: AppColors.gray500),
              if (title != null) ...[
                const SizedBox(height: 16),
                Text(
                  title!,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
              if (message != null) ...[
                const SizedBox(height: 8),
                Text(
                  message!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 14,
                    color: AppColors.gray500,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// A single magnetic snap target, cached in screen-pixel space at drag
/// begin. A vertex candidate is a single point; an edge candidate is a
/// segment — the snapped map coordinate for an edge is found by linearly
/// interpolating along its original lng/lat endpoints using the same `t`
/// found by projecting onto the *pixel*-space segment, an excellent
/// approximation at the small scale a single territory spans.
/// What's actually being dragged right now — see the "gestures: pointer
/// handling" section of `_TerritoryEditorScreenState` for why dragging is
/// driven by hand instead of Mapbox's own annotation-drag events.
enum _DragKind { none, vertex, edge, move }

enum _PendingKind { vertex, edgeSelected, midpointUnselected, move }

/// A touch landed on a handle, but hasn't moved far enough yet to count
/// as a drag rather than a tap — see `_maybeArmPendingDrag`.
class _PendingHandleHit {
  final _PendingKind kind;
  final VertexRef? vertexRef;
  final EdgeRef? edgeRef;
  final int? partIndex;
  final MapCoordinate? at;

  const _PendingHandleHit._(
    this.kind, {
    this.vertexRef,
    this.edgeRef,
    this.partIndex,
    this.at,
  });

  factory _PendingHandleHit.vertex(VertexRef ref) =>
      _PendingHandleHit._(_PendingKind.vertex, vertexRef: ref);

  factory _PendingHandleHit.edge(EdgeRef ref, {required MapCoordinate at}) =>
      _PendingHandleHit._(_PendingKind.edgeSelected, edgeRef: ref, at: at);

  factory _PendingHandleHit.midpoint(
    EdgeRef ref, {
    required MapCoordinate at,
  }) => _PendingHandleHit._(
    _PendingKind.midpointUnselected,
    edgeRef: ref,
    at: at,
  );

  factory _PendingHandleHit.move({
    required int partIndex,
    required MapCoordinate at,
  }) => _PendingHandleHit._(_PendingKind.move, partIndex: partIndex, at: at);
}

class _SnapCandidate {
  final MapCoordinate a;
  final MapCoordinate b;
  final ScreenCoordinate pixelA;
  final ScreenCoordinate pixelB;
  final bool isVertex;

  _SnapCandidate.vertex(this.a, this.pixelA)
    : b = a,
      pixelB = pixelA,
      isVertex = true;

  _SnapCandidate.edge(this.a, this.b, this.pixelA, this.pixelB)
    : isVertex = false;

  ({double distSq, MapCoordinate coordinate}) nearestTo(double px, double py) {
    if (isVertex) {
      final dx = pixelA.x - px;
      final dy = pixelA.y - py;
      return (distSq: dx * dx + dy * dy, coordinate: a);
    }
    final dx = pixelB.x - pixelA.x;
    final dy = pixelB.y - pixelA.y;
    final lengthSq = dx * dx + dy * dy;
    var t = lengthSq == 0
        ? 0.0
        : ((px - pixelA.x) * dx + (py - pixelA.y) * dy) / lengthSq;
    t = t.clamp(0.0, 1.0);
    final nearestX = pixelA.x + t * dx;
    final nearestY = pixelA.y + t * dy;
    final ddx = nearestX - px;
    final ddy = nearestY - py;
    return (
      distSq: ddx * ddx + ddy * ddy,
      coordinate: MapCoordinate(
        longitude: a.longitude + t * (b.longitude - a.longitude),
        latitude: a.latitude + t * (b.latitude - a.latitude),
      ),
    );
  }
}
