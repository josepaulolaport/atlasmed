import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/models/editor_mode.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/models/editor_refs.dart';

class GeometryValidation {
  final bool tooFewPoints;
  final bool selfIntersects;
  final bool overlapsNeighbor;
  final String? message;

  const GeometryValidation({
    this.tooFewPoints = false,
    this.selfIntersects = false,
    this.overlapsNeighbor = false,
    this.message,
  });

  static const valid = GeometryValidation();

  bool get isValid => !tooFewPoints && !selfIntersects && !overlapsNeighbor;
}

/// Sentinel used by [TerritoryEditorState.copyWith] so nullable fields can
/// be explicitly reset to `null` (vs. "leave unchanged", the default).
class _Unset {
  const _Unset();
}

const _unset = _Unset();

class TerritoryEditorState {
  final bool loading;
  final String? loadError;
  final Territory? original;

  /// Other territories of the same kind + sector, target excluded — the
  /// set that overlap checks and (in stage 3) auto-clip-snapping run
  /// against.
  final List<Territory> neighbors;

  final GeometryParts? working;
  final List<GeometryParts> undoStack;
  final List<GeometryParts> redoStack;

  final EditorMode mode;
  final int? selectedPart;
  final SelectionAction selectionAction;
  final EdgeRef? selectedEdge;

  /// Points placed so far by the draw-new-area tool — not yet committed
  /// to [working]. Cleared whenever the mode changes away from
  /// [EditorMode.drawArea].
  final List<MapCoordinate> drawingPoints;

  final GeometryValidation validation;
  final bool saving;
  final bool saved;

  const TerritoryEditorState({
    this.loading = true,
    this.loadError,
    this.original,
    this.neighbors = const [],
    this.working,
    this.undoStack = const [],
    this.redoStack = const [],
    this.mode = EditorMode.navigate,
    this.selectedPart,
    this.selectionAction = SelectionAction.none,
    this.selectedEdge,
    this.drawingPoints = const [],
    this.validation = GeometryValidation.valid,
    this.saving = false,
    this.saved = false,
  });

  /// One committed action (drag-begin, insert, delete, ...) pushes exactly
  /// one snapshot — so "changed since opening the editor" is just "is
  /// there anything to undo".
  bool get isDirty => undoStack.isNotEmpty;

  bool get canSave => !loading && !saving && isDirty && validation.isValid;
  bool get canUndo => undoStack.isNotEmpty;
  bool get canRedo => redoStack.isNotEmpty;
  bool get canDeleteSelectedPart =>
      working != null && working!.length > 1 && selectedPart != null;
  bool get canFinishDrawing => drawingPoints.length >= 3;

  TerritoryEditorState copyWith({
    bool? loading,
    Object? loadError = _unset,
    Territory? original,
    List<Territory>? neighbors,
    Object? working = _unset,
    List<GeometryParts>? undoStack,
    List<GeometryParts>? redoStack,
    EditorMode? mode,
    Object? selectedPart = _unset,
    SelectionAction? selectionAction,
    Object? selectedEdge = _unset,
    List<MapCoordinate>? drawingPoints,
    GeometryValidation? validation,
    bool? saving,
    bool? saved,
  }) {
    return TerritoryEditorState(
      loading: loading ?? this.loading,
      loadError: identical(loadError, _unset)
          ? this.loadError
          : loadError as String?,
      original: original ?? this.original,
      neighbors: neighbors ?? this.neighbors,
      working: identical(working, _unset)
          ? this.working
          : working as GeometryParts?,
      undoStack: undoStack ?? this.undoStack,
      redoStack: redoStack ?? this.redoStack,
      mode: mode ?? this.mode,
      selectedPart: identical(selectedPart, _unset)
          ? this.selectedPart
          : selectedPart as int?,
      selectionAction: selectionAction ?? this.selectionAction,
      selectedEdge: identical(selectedEdge, _unset)
          ? this.selectedEdge
          : selectedEdge as EdgeRef?,
      drawingPoints: drawingPoints ?? this.drawingPoints,
      validation: validation ?? this.validation,
      saving: saving ?? this.saving,
      saved: saved ?? this.saved,
    );
  }
}
