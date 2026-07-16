/// Top-level editing tool. `navigate` is the only mode where the map's own
/// pan gesture stays enabled — every other mode hands single-finger drag
/// gestures to editing handles instead (see `TerritoryEditorScreen`'s
/// gesture-lock wiring).
enum EditorMode { navigate, select, drawArea, addArea, removeArea }

/// Once a polygon is selected (in [EditorMode.select]), the contextual bar
/// lets the user choose what a drag on the map should do next.
enum SelectionAction {
  /// Nothing chosen yet — the polygon is highlighted but inert.
  none,

  /// Vertex + midpoint handles are shown; dragging edits the boundary.
  boundary,

  /// A single centroid handle is shown; dragging translates the whole part.
  move,
}
