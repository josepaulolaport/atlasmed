/**
 * Same-vertical sibling overlap above this absolute area is blocked (spec 0009
 * R3, invariant I3). Touching borders never reach it: the repository already
 * excludes `ST_Touches` pairs, so this judges genuine slivers only.
 *
 * Replaces a 5% ratio of the proposed polygon's area, which permitted square
 * *kilometres* on a large zone — 12 km² on Sao Paulo — and had never rejected
 * anything, because the only same-vertical neighbours in production touch
 * exactly and are excluded before the ratio is consulted.
 *
 * Why 1 m² is safe rather than merely small: the editor's auto-clip runs on
 * `package:clipper2`, which is integer-coordinate — every vertex is snapped to a
 * 1e-7 degree lattice (~1.1 cm) going in and out
 * (`geometry_ops.dart:16`). All 5259 boundary vertices stored in production sit
 * exactly on that lattice, so a drawn shape is clipped against a lattice-aligned
 * neighbour in exact integer arithmetic: the shared edge is identical and the
 * residue is 0.000 m², not a small number. The epsilon exists for geometry that
 * did *not* come through the editor, and 1 m² is far below any overlap a human
 * could draw deliberately.
 */
export const GEO_SIBLING_OVERLAP_EPSILON_SQ_M = 1;
