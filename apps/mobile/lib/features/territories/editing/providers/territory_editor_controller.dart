import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/geometry/geometry_math.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/geometry/geometry_ops.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/geometry/territory_geometry_editor.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/models/editor_mode.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/models/editor_refs.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/providers/territory_editor_state.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/providers/territories_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final territoryEditorControllerProvider =
    StateNotifierProvider.autoDispose
        .family<TerritoryEditorController, TerritoryEditorState, String>((
          ref,
          territoryId,
        ) {
          return TerritoryEditorController(ref, territoryId);
        });

class TerritoryEditorController extends StateNotifier<TerritoryEditorState> {
  TerritoryEditorController(this._ref, this.territoryId)
    : super(const TerritoryEditorState()) {
    _load();
  }

  final Ref _ref;
  final String territoryId;

  Future<void> _load() async {
    state = state.copyWith(loading: true, loadError: null);
    try {
      final repository = _ref.read(territoryRepositoryProvider);
      final territory = await repository.getTerritoryById(territoryId);
      if (territory == null) {
        state = state.copyWith(
          loading: false,
          loadError: 'Território não encontrado.',
        );
        return;
      }
      final sameKindAndSector = await repository.getTerritories(
        territoryTypeSlug: territory.territoryType.slug,
        sectorId: territory.sectorId,
      );
      final neighbors = sameKindAndSector
          .where((candidate) => candidate.id != territory.id)
          .toList();
      final working = TerritoryGeometryEditor.fromGeometry(territory.boundary);
      state = state.copyWith(
        loading: false,
        original: territory,
        neighbors: neighbors,
        working: working,
        validation: _validate(working, neighbors),
      );
    } catch (_) {
      state = state.copyWith(
        loading: false,
        loadError: 'Não foi possível carregar o território.',
      );
    }
  }

  // ---- modes / selection ----------------------------------------------

  void setMode(EditorMode mode) {
    if (state.mode == mode) return;
    state = state.copyWith(
      mode: mode,
      selectedPart: null,
      selectedEdge: null,
      selectionAction: SelectionAction.none,
      drawingPoints: const [],
    );
  }

  void selectPart(int partIndex) {
    if (state.mode != EditorMode.select) return;
    state = state.copyWith(
      selectedPart: partIndex,
      selectedEdge: null,
      selectionAction: SelectionAction.none,
    );
  }

  void clearSelection() {
    state = state.copyWith(
      selectedPart: null,
      selectedEdge: null,
      selectionAction: SelectionAction.none,
    );
  }

  void chooseSelectionAction(SelectionAction action) {
    if (state.selectedPart == null) return;
    state = state.copyWith(selectionAction: action, selectedEdge: null);
  }

  void selectEdge(EdgeRef edge) {
    state = state.copyWith(selectedEdge: edge);
  }

  void clearEdgeSelection() {
    if (state.selectedEdge == null) return;
    state = state.copyWith(selectedEdge: null);
  }

  // ---- vertex / midpoint --------------------------------------------

  void beginVertexDrag(VertexRef ref) => _pushUndo();

  void updateVertexDrag(VertexRef ref, MapCoordinate position) {
    final working = state.working;
    if (working == null) return;
    _applyWorking(TerritoryGeometryEditor.moveVertex(working, ref, position));
  }

  void endVertexDrag() {}

  /// Promotes a midpoint into a real vertex and immediately starts
  /// dragging it — the caller (the map screen) keeps the same live
  /// gesture going against the returned [VertexRef].
  VertexRef? beginMidpointDrag(EdgeRef edge, MapCoordinate at) {
    final working = state.working;
    if (working == null) return null;
    _pushUndo();
    final result = TerritoryGeometryEditor.insertVertex(working, edge, at);
    _applyWorking(result.parts);
    return result.ref;
  }

  /// Tap-to-delete — no confirmation, per spec. No-ops (and surfaces a
  /// validation message) if the ring would drop below a valid triangle.
  void deleteVertexAt(VertexRef ref) {
    final working = state.working;
    if (working == null) return;
    final next = TerritoryGeometryEditor.deleteVertex(working, ref);
    if (next == null) {
      state = state.copyWith(
        validation: const GeometryValidation(
          tooFewPoints: true,
          message: 'Um território precisa de pelo menos três pontos.',
        ),
      );
      return;
    }
    _pushUndo();
    _applyWorking(next);
  }

  // ---- edges -----------------------------------------------------------

  void beginEdgeDrag(EdgeRef edge) => _pushUndo();

  void updateEdgeDrag(EdgeRef edge, double deltaLng, double deltaLat) {
    final working = state.working;
    if (working == null) return;
    _applyWorking(
      TerritoryGeometryEditor.moveEdge(working, edge, deltaLng, deltaLat),
    );
  }

  void endEdgeDrag() {}

  // ---- whole polygon -----------------------------------------------------

  void beginPolygonMove(int partIndex) => _pushUndo();

  void updatePolygonMove(int partIndex, double deltaLng, double deltaLat) {
    final working = state.working;
    if (working == null) return;
    _applyWorking(
      TerritoryGeometryEditor.movePolygon(
        working,
        partIndex,
        deltaLng,
        deltaLat,
      ),
    );
  }

  void endPolygonMove() {}

  void deleteSelectedPart() {
    final working = state.working;
    final partIndex = state.selectedPart;
    if (working == null || partIndex == null || !state.canDeleteSelectedPart) {
      return;
    }
    _pushUndo();
    final next = TerritoryGeometryEditor.deletePart(working, partIndex);
    state = state.copyWith(
      working: next,
      selectedPart: null,
      selectionAction: SelectionAction.none,
      validation: _validate(next, state.neighbors),
    );
  }

  // ---- draw new area / add area / remove area (stage 2 + 3) --------------
  //
  // All three tools share the same tap-to-place-points + auto-close
  // interaction; they only differ in what happens to [state.working] once
  // the ring is finished (see [finishDrawing]).

  static bool _isDrawingMode(EditorMode mode) =>
      mode == EditorMode.drawArea ||
      mode == EditorMode.addArea ||
      mode == EditorMode.removeArea;

  /// Adds a point to the in-progress ring. Rejects (returns `false`)
  /// points whose new segment would cross an existing one, so an invalid
  /// self-intersecting shape can never even be drawn in the first place.
  bool addDrawingPoint(MapCoordinate point) {
    if (!_isDrawingMode(state.mode)) return false;
    final points = state.drawingPoints;
    if (points.length >= 2) {
      final last = points.last;
      // Stop one edge short of the end: the segment right before `last`
      // shares that exact point with the new segment by construction, so
      // testing it would always look like a "touching" intersection.
      for (var i = 0; i < points.length - 2; i++) {
        if (GeometryMath.segmentsIntersect(points[i], points[i + 1], last, point)) {
          return false;
        }
      }
    }
    state = state.copyWith(drawingPoints: [...points, point]);
    return true;
  }

  /// Undo/redo's meaning while a shape is being drawn: pull back the last
  /// placed point instead of touching the committed geometry stack.
  void removeLastDrawingPoint() {
    final points = state.drawingPoints;
    if (points.isEmpty) return;
    state = state.copyWith(drawingPoints: points.sublist(0, points.length - 1));
  }

  void cancelDrawing() {
    if (state.drawingPoints.isEmpty) return;
    state = state.copyWith(drawingPoints: const []);
  }

  /// Commits the in-progress ring — as a new disconnected part (Draw), a
  /// union into whatever it overlaps (Add area), or a subtraction from
  /// whatever it overlaps (Remove area) — and selects the result. Returns
  /// `false` (and leaves the drawing untouched) if the shape isn't valid
  /// yet, or if a Remove area cut would eliminate the whole territory.
  bool finishDrawing() {
    final working = state.working;
    if (working == null || !state.canFinishDrawing) return false;
    if (GeometryMath.ringSelfIntersects(state.drawingPoints)) return false;

    if (!_isDrawingMode(state.mode)) return false;
    final next = switch (state.mode) {
      EditorMode.drawArea =>
        TerritoryGeometryEditor.appendPart(working, state.drawingPoints),
      EditorMode.addArea => GeometryOps.union(working, state.drawingPoints),
      EditorMode.removeArea =>
        GeometryOps.difference(working, state.drawingPoints),
      EditorMode.navigate || EditorMode.select => const <List<List<MapCoordinate>>>[],
    };

    if (next.isEmpty) {
      state = state.copyWith(
        drawingPoints: const [],
        validation: const GeometryValidation(
          tooFewPoints: true,
          message: 'Essa remoção eliminaria todo o território.',
        ),
      );
      return false;
    }

    _pushUndo();
    state = state.copyWith(
      working: next,
      drawingPoints: const [],
      mode: EditorMode.select,
      selectedPart: next.length - 1,
      validation: _validate(next, state.neighbors),
    );
    return true;
  }

  // ---- undo / redo -------------------------------------------------------

  void undo() {
    if (_isDrawingMode(state.mode) && state.drawingPoints.isNotEmpty) {
      removeLastDrawingPoint();
      return;
    }
    final working = state.working;
    if (working == null || state.undoStack.isEmpty) return;
    final previous = state.undoStack.last;
    state = state.copyWith(
      working: previous,
      undoStack: state.undoStack.sublist(0, state.undoStack.length - 1),
      redoStack: [...state.redoStack, working],
      validation: _validate(previous, state.neighbors),
      selectedEdge: null,
    );
  }

  void redo() {
    final working = state.working;
    if (working == null || state.redoStack.isEmpty) return;
    final next = state.redoStack.last;
    state = state.copyWith(
      working: next,
      redoStack: state.redoStack.sublist(0, state.redoStack.length - 1),
      undoStack: [...state.undoStack, working],
      validation: _validate(next, state.neighbors),
      selectedEdge: null,
    );
  }

  // ---- cancel / save -----------------------------------------------------

  void cancel() {
    final original = state.original;
    if (original == null) return;
    final working = TerritoryGeometryEditor.fromGeometry(original.boundary);
    state = state.copyWith(
      working: working,
      undoStack: const [],
      redoStack: const [],
      mode: EditorMode.navigate,
      selectedPart: null,
      selectedEdge: null,
      selectionAction: SelectionAction.none,
      drawingPoints: const [],
      validation: _validate(working, state.neighbors),
    );
  }

  Future<bool> save() async {
    final original = state.original;
    final working = state.working;
    if (original == null || working == null || !state.canSave) return false;

    state = state.copyWith(saving: true);
    try {
      final geometry = TerritoryGeometryEditor.toGeometry(working);
      await _ref
          .read(territoryRepositoryProvider)
          .updateTerritoryGeometry(original.id, geometry);
      _ref.invalidate(territoriesProvider);
      _ref.invalidate(territoryByIdProvider(original.id));
      state = state.copyWith(saving: false, saved: true, undoStack: const []);
      return true;
    } catch (_) {
      state = state.copyWith(saving: false);
      return false;
    }
  }

  // ---- internals ---------------------------------------------------------

  void _pushUndo() {
    final working = state.working;
    if (working == null) return;
    state = state.copyWith(
      undoStack: [...state.undoStack, working],
      redoStack: const [],
    );
  }

  void _applyWorking(GeometryParts working) {
    state = state.copyWith(
      working: working,
      validation: _validate(working, state.neighbors),
    );
  }

  GeometryValidation _validate(GeometryParts working, List<Territory> neighbors) {
    for (final part in working) {
      for (final ring in part) {
        if (ring.length < 3) {
          return const GeometryValidation(
            tooFewPoints: true,
            message: 'Um território precisa de pelo menos três pontos.',
          );
        }
      }
      final exterior = part.first;
      if (GeometryMath.ringSelfIntersects(exterior)) {
        return const GeometryValidation(
          selfIntersects: true,
          message: 'O contorno cruza sobre si mesmo.',
        );
      }
      for (final neighbor in neighbors) {
        for (final neighborPart in neighbor.boundary.coordinates) {
          if (neighborPart.isEmpty) continue;
          if (GeometryMath.ringsOverlap(exterior, neighborPart.first)) {
            return GeometryValidation(
              overlapsNeighbor: true,
              message: 'Essa área sobrepõe o território "${neighbor.name}".',
            );
          }
        }
      }
    }
    return GeometryValidation.valid;
  }
}
