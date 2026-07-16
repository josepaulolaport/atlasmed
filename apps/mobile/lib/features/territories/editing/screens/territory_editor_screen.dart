import 'dart:async';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_type.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/geometry/geometry_math.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/geometry/territory_geometry_editor.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/models/editor_mode.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/models/editor_refs.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/providers/territory_editor_controller.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/providers/territory_editor_state.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/widgets/editor_contextual_bar.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/widgets/editor_save_bar.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/widgets/editor_toolbar.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/widgets/editor_validation_banner.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart' hide Size;

class TerritoryEditorScreen extends ConsumerStatefulWidget {
  final String territoryId;

  const TerritoryEditorScreen({super.key, required this.territoryId});

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
  static const _drawColor = 0xFFF59E0B;
  static const _addColor = 0xFF10B981;
  static const _removeColor = 0xFFEF4444;
  static const _snapThresholdPixels = 24.0;
  static const _vertexSnapThresholdPixels = 16.0;
  static const _snapIndicatorColor = 0xFF7C3AED;

  static bool _isDrawingMode(EditorMode mode) =>
      mode == EditorMode.drawArea ||
      mode == EditorMode.addArea ||
      mode == EditorMode.removeArea;

  static int _drawingColorFor(EditorMode mode) => switch (mode) {
    EditorMode.addArea => _addColor,
    EditorMode.removeArea => _removeColor,
    _ => _drawColor,
  };

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
  PolylineAnnotationManager? _drawPreviewManager;
  CircleAnnotationManager? _handleManager;
  CircleAnnotationManager? _snapIndicatorManager;

  bool _mapReady = false;
  bool _mapUnavailable = false;
  bool _viewportApplied = false;
  bool _initialFitDone = false;
  bool _dragging = false;
  bool _suppressNextMapTapDeselect = false;

  final Map<String, VertexRef> _vertexByAnnotationId = {};
  final Map<String, EdgeRef> _midpointByAnnotationId = {};
  String? _moveHandleAnnotationId;
  int? _moveHandlePartIndex;
  MapCoordinate? _lastDragPosition;

  /// Magnetic snap targets for the vertex currently being dragged — screen
  /// pixel positions are cached once at drag-begin (see
  /// `_prepareSnapCandidates`) so each drag-changed frame only needs a
  /// single `pixelForCoordinate` call (for the finger's own position),
  /// not one per candidate.
  List<_SnapCandidate> _snapCandidates = const [];
  String? _snapIndicatorAnnotationId;
  int _dragSession = 0;

  @override
  void initState() {
    super.initState();
    final token = AppConfig.mapboxAccessToken;
    if (token.isNotEmpty) MapboxOptions.setAccessToken(token);
  }

  @override
  Widget build(BuildContext context) {
    final provider = territoryEditorControllerProvider(widget.territoryId);
    final state = ref.watch(provider);

    ref.listen(provider, (previous, next) {
      if (next.loading || next.original == null) return;
      _render(next, includeHandles: !_dragging);
    });

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
            if (AppConfig.mapboxAccessToken.isEmpty || _mapUnavailable)
              const _CenteredMessage(
                icon: Icons.map_outlined,
                title: 'Mapa indisponível',
                message: 'Não foi possível carregar o mapa agora.',
              )
            else if (state.original != null)
              Positioned.fill(child: _buildMap(state)),
            if (state.loading) const _CenteredMessage(loading: true),
            if (state.loadError != null)
              _CenteredMessage(
                icon: Icons.error_outline,
                title: 'Não foi possível abrir o editor',
                message: state.loadError!,
              ),
            if (!state.loading && state.loadError == null)
              SafeArea(child: _buildChrome(context, state)),
          ],
        ),
      ),
    );
  }

  Widget _buildMap(TerritoryEditorState state) {
    final centroid = state.original!.centroid;
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
      onStyleLoadedListener: (_) => _configureMap(),
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
      _handleManager!.dragEvents(
        onBegin: _handleDragBegin,
        onChanged: _handleDragChanged,
        onEnd: _handleDragEnd,
      );

      _mapReady = true;
      final state = ref.read(
        territoryEditorControllerProvider(widget.territoryId),
      );
      await _applyGestureLock();
      await _render(state);
      if (!_initialFitDone) {
        _initialFitDone = true;
        await _fitToTerritory(state);
      }
    } catch (_) {
      if (mounted) setState(() => _mapUnavailable = true);
    }
  }

  /// Panning stays enabled in every editor mode (not just Navigate): a
  /// one-finger drag that starts exactly on a draggable handle is
  /// captured by that handle's own annotation-drag gesture regardless, so
  /// letting the map itself pan doesn't interfere with vertex/edge/
  /// polygon editing — it just means the user isn't forced to switch back
  /// to Navigate every time they want to reposition the map mid-edit.
  Future<void> _applyGestureLock() async {
    final mapboxMap = _mapboxMap;
    if (mapboxMap == null) return;
    try {
      await mapboxMap.gestures.updateSettings(
        GesturesSettings(scrollEnabled: true),
      );
    } catch (_) {
      // Best-effort — editing still works even if this fails to apply.
    }
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

  // ---- rendering -----------------------------------------------------------

  Future<void> _render(
    TerritoryEditorState state, {
    bool includeHandles = true,
  }) async {
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
            geometry: Polygon.fromPoints(points: part.map(_ringToPoints).toList()),
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
    await neighborFillManager.deleteAll();
    await neighborBorderManager.deleteAll();
    await neighborFillManager.createMulti(neighborFillOptions);
    await neighborBorderManager.createMulti(neighborBorderOptions);

    final fillOptions = <PolygonAnnotationOptions>[];
    final haloOptions = <PolylineAnnotationOptions>[];
    final borderOptions = <PolylineAnnotationOptions>[];

    final kindColor = state.original?.kind == TerritoryKind.managerZone
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
          geometry: Polygon.fromPoints(points: part.map(_ringToPoints).toList()),
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
    await borderManager.deleteAll();
    await fillManager.createMulti(fillOptions);
    await borderManager.createMulti([...haloOptions, ...borderOptions]);

    await _renderDrawPreview(state);

    if (includeHandles) await _renderHandles(state);
  }

  Future<void> _renderDrawPreview(TerritoryEditorState state) async {
    final previewManager = _drawPreviewManager;
    if (previewManager == null) return;
    await previewManager.deleteAll();
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

  Future<void> _renderHandles(TerritoryEditorState state) async {
    final handleManager = _handleManager;
    if (handleManager == null) return;

    await handleManager.deleteAll();
    _vertexByAnnotationId.clear();
    _midpointByAnnotationId.clear();
    _moveHandleAnnotationId = null;
    _moveHandlePartIndex = null;

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

    if (state.selectionAction == SelectionAction.move) {
      final centroid = _averagePoint(working[partIndex].first);
      final created = await handleManager.create(
        CircleAnnotationOptions(
          geometry: _point(centroid),
          circleRadius: 13,
          circleColor: _moveHandleColor,
          circleStrokeColor: _haloColor,
          circleStrokeWidth: 2.5,
          isDraggable: true,
        ),
      );
      _moveHandleAnnotationId = created.id;
      _moveHandlePartIndex = partIndex;
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
          isDraggable: true,
        ),
      );
      vertexRefs.add(VertexRef(partIndex: partIndex, ringIndex: 0, pointIndex: i));

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
          isDraggable: true,
        ),
      );
      midpointRefs.add(EdgeRef(partIndex: partIndex, ringIndex: 0, startIndex: i));
    }

    final createdVertices = await handleManager.createMulti(vertexOptions);
    for (var i = 0; i < createdVertices.length; i++) {
      final annotation = createdVertices[i];
      if (annotation != null) _vertexByAnnotationId[annotation.id] = vertexRefs[i];
    }
    final createdMidpoints = await handleManager.createMulti(midpointOptions);
    for (var i = 0; i < createdMidpoints.length; i++) {
      final annotation = createdMidpoints[i];
      if (annotation != null) {
        _midpointByAnnotationId[annotation.id] = midpointRefs[i];
      }
    }
  }

  // ---- gestures --------------------------------------------------------

  TerritoryEditorController get _controller =>
      ref.read(territoryEditorControllerProvider(widget.territoryId).notifier);

  TerritoryEditorState get _state =>
      ref.read(territoryEditorControllerProvider(widget.territoryId));

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

  void _handleMapTap(MapContentGestureContext context) {
    if (_suppressNextMapTapDeselect) {
      _suppressNextMapTapDeselect = false;
      return;
    }

    if (_isDrawingMode(_state.mode)) {
      _handleDrawTap(_fromPoint(context.point));
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

  void _handleDragBegin(CircleAnnotation annotation) {
    _dragging = true;

    if (annotation.id == _moveHandleAnnotationId && _moveHandlePartIndex != null) {
      _controller.beginPolygonMove(_moveHandlePartIndex!);
      _lastDragPosition = _fromPoint(annotation.geometry);
      return;
    }

    final vertexRef = _vertexByAnnotationId[annotation.id];
    if (vertexRef != null) {
      _controller.beginVertexDrag(vertexRef);
      _snapCandidates = const [];
      final session = ++_dragSession;
      unawaited(_prepareSnapCandidates(vertexRef, session));
      return;
    }

    final edgeRef = _midpointByAnnotationId[annotation.id];
    if (edgeRef == null) return;

    if (_state.selectedEdge == edgeRef) {
      _controller.beginEdgeDrag(edgeRef);
      _lastDragPosition = _fromPoint(annotation.geometry);
    } else {
      final promoted = _controller.beginMidpointDrag(
        edgeRef,
        _fromPoint(annotation.geometry),
      );
      if (promoted != null) {
        _midpointByAnnotationId.remove(annotation.id);
        _vertexByAnnotationId[annotation.id] = promoted;
        _snapCandidates = const [];
        final session = ++_dragSession;
        unawaited(_prepareSnapCandidates(promoted, session));
      }
    }
  }

  void _handleDragChanged(CircleAnnotation annotation) {
    final position = _fromPoint(annotation.geometry);

    if (annotation.id == _moveHandleAnnotationId && _moveHandlePartIndex != null) {
      final last = _lastDragPosition;
      if (last != null) {
        _controller.updatePolygonMove(
          _moveHandlePartIndex!,
          position.longitude - last.longitude,
          position.latitude - last.latitude,
        );
      }
      _lastDragPosition = position;
      return;
    }

    final vertexRef = _vertexByAnnotationId[annotation.id];
    if (vertexRef != null) {
      unawaited(_applyVertexDrag(vertexRef, position));
      return;
    }

    final edgeRef = _midpointByAnnotationId[annotation.id];
    if (edgeRef != null) {
      final last = _lastDragPosition;
      if (last != null) {
        _controller.updateEdgeDrag(
          edgeRef,
          position.longitude - last.longitude,
          position.latitude - last.latitude,
        );
      }
      _lastDragPosition = position;
    }
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

  void _handleDragEnd(CircleAnnotation annotation) {
    if (annotation.id == _moveHandleAnnotationId) {
      _controller.endPolygonMove();
    } else if (_vertexByAnnotationId.containsKey(annotation.id)) {
      _controller.endVertexDrag();
    } else if (_midpointByAnnotationId.containsKey(annotation.id)) {
      _controller.endEdgeDrag();
      _controller.clearEdgeSelection();
    }

    _lastDragPosition = null;
    _dragging = false;
    _snapCandidates = const [];
    _dragSession++;
    unawaited(_updateSnapIndicator(null));
    _render(_state);
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
              _RoundIconButton(
                icon: Icons.arrow_back_rounded,
                onTap: () => _requestExit(context, state),
              ),
              EditorToolbar(
                mode: state.mode,
                canUndo: state.canUndo,
                canRedo: state.canRedo,
                onModeChanged: notifier.setMode,
                onUndo: notifier.undo,
                onRedo: notifier.redo,
              ),
            ],
          ),
          if (!state.validation.isValid && state.validation.message != null) ...[
            const SizedBox(height: 10),
            EditorValidationBanner(message: state.validation.message!),
          ],
          const Spacer(),
          if (_isDrawingMode(state.mode)) ...[
            Center(
              child: _DrawAreaBar(
                hint: switch (state.mode) {
                  EditorMode.addArea => 'Desenhe a área a adicionar',
                  EditorMode.removeArea => 'Desenhe a área a remover',
                  _ => 'Toque no mapa para começar',
                },
                finishLabel: switch (state.mode) {
                  EditorMode.addArea => 'Adicionar área',
                  EditorMode.removeArea => 'Remover área',
                  _ => 'Finalizar área',
                },
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
          if (state.mode == EditorMode.select && state.selectedPart != null) ...[
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
    final ok = await notifier.save();
    if (!context.mounted) return;
    if (ok) {
      Navigator.of(context).pop();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Não foi possível salvar. Tente novamente.'),
        ),
      );
    }
  }

  // ---- geometry <-> Mapbox helpers ---------------------------------------

  MapCoordinate _averagePoint(List<MapCoordinate> ring) {
    var lng = 0.0;
    var lat = 0.0;
    for (final point in ring) {
      lng += point.longitude;
      lat += point.latitude;
    }
    return MapCoordinate(longitude: lng / ring.length, latitude: lat / ring.length);
  }

  List<Point> _ringToPoints(List<MapCoordinate> ring) => ring.map(_point).toList();

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
                color: Color(0xFF6B7280),
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
          child: Icon(icon, size: 18, color: const Color(0xFF374151)),
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
      color: const Color(0xFFF7F8FB),
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
                Icon(icon, size: 42, color: const Color(0xFF6B7280)),
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
                  style: const TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
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
