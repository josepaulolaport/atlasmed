/// Top-level editing tool.
///
/// There's no separate "draw a new area" tool: a territory being edited
/// here always already has a boundary (you can't open the editor on one
/// that doesn't), and — since rep patches / manager zones must stay a
/// single connected polygon — any shape drawn while editing has to touch
/// and merge into that existing boundary anyway. That's exactly what
/// [addArea] does, so it's the only "extend the shape" tool.
enum EditorMode { navigate, select, addArea, removeArea }

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
