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

  MapboxMap? _mapboxMap;
  PolygonAnnotationManager? _fillManager;
  PolylineAnnotationManager? _borderManager;
  CircleAnnotationManager? _handleManager;

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
      if (previous?.mode != next.mode) _applyGestureLock(next.mode);
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
      _fillManager = await mapboxMap.annotations
          .createPolygonAnnotationManager();
      _borderManager = await mapboxMap.annotations
          .createPolylineAnnotationManager();
      _handleManager = await mapboxMap.annotations
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
      await _applyGestureLock(state.mode);
      await _render(state);
      if (!_initialFitDone) {
        _initialFitDone = true;
        await _fitToTerritory(state);
      }
    } catch (_) {
      if (mounted) setState(() => _mapUnavailable = true);
    }
  }

  Future<void> _applyGestureLock(EditorMode mode) async {
    final mapboxMap = _mapboxMap;
    if (mapboxMap == null) return;
    try {
      await mapboxMap.gestures.updateSettings(
        GesturesSettings(scrollEnabled: mode == EditorMode.navigate),
      );
    } catch (_) {
      // Best-effort — editing still works even if the lock fails to apply.
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
    final working = state.working;
    if (fillManager == null || borderManager == null || !_mapReady || working == null) {
      return;
    }

    final fillOptions = <PolygonAnnotationOptions>[];
    final haloOptions = <PolylineAnnotationOptions>[];
    final borderOptions = <PolylineAnnotationOptions>[];

    for (final neighbor in state.neighbors) {
      for (final part in neighbor.boundary.coordinates) {
        if (part.isEmpty) continue;
        fillOptions.add(
          PolygonAnnotationOptions(
            geometry: Polygon.fromPoints(points: part.map(_ringToPoints).toList()),
            fillColor: _neighborColor,
            fillOpacity: 0.32,
          ),
        );
        for (final ring in part) {
          borderOptions.add(
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
      if (selected && selectedEdge != null && selectedEdge.partIndex == partIndex) {
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

    if (includeHandles) await _renderHandles(state);
  }

  Future<void> _renderHandles(TerritoryEditorState state) async {
    final handleManager = _handleManager;
    if (handleManager == null) return;

    await handleManager.deleteAll();
    _vertexByAnnotationId.clear();
    _midpointByAnnotationId.clear();
    _moveHandleAnnotationId = null;
    _moveHandlePartIndex = null;

    final working = state.working;
    final partIndex = state.selectedPart;
    if (working == null || partIndex == null) return;

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

  void _handleFillTap(PolygonAnnotation annotation) {
    if (_state.mode != EditorMode.select) return;
    final partIndex = annotation.customData?['partIndex'] as int?;
    if (partIndex == null) return;
    _suppressNextMapTapDeselect = true;
    _controller.selectPart(partIndex);
  }

  void _handleMapTap(MapContentGestureContext context) {
    if (_suppressNextMapTapDeselect) {
      _suppressNextMapTapDeselect = false;
      return;
    }
    if (_state.mode == EditorMode.select && _state.selectedPart != null) {
      _controller.clearSelection();
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
      _controller.updateVertexDrag(vertexRef, position);
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
    _render(_state);
  }

  // ---- chrome ------------------------------------------------------------

  Widget _buildChrome(BuildContext context, TerritoryEditorState state) {
    final notifier = _controller;
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _RoundIconButton(
                icon: Icons.arrow_back_rounded,
                onTap: () => _requestExit(context, state),
              ),
              const Spacer(),
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
