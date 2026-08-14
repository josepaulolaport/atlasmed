import { describe, expect, it } from "bun:test";
import { resolveImportVerticalIds } from "./cnes-facility-import.use-cases";
import { ForbiddenError, ValidationError } from "../../../../shared/errors";

/**
 * Which verticals an import may create profiles for (spec 0015 §6.3).
 *
 * Pure, and worth testing separately because the interesting case is the one
 * the access rule makes impossible everywhere else: §6.0 restricts this surface
 * to managers and admins, and `canAccessVertical` refuses an empty assignment
 * set for *every* role, ADMIN included. Both of our admins hold zero verticals,
 * so deriving the profile's vertical from the caller's own would leave the
 * feature unusable by exactly the people allowed to use it.
 */
describe("resolveImportVerticalIds", () => {
  const listActiveVerticalIds = async () => [1, 2];

  it("uses the only vertical a user holds, unasked", async () => {
    const result = await resolveImportVerticalIds({
      role: "MANAGER",
      assignedVerticalIds: [7],
      requestedVerticalIds: [],
      listActiveVerticalIds,
    });
    expect(result).toEqual([7]);
  });

  it("requires a choice when the user holds several", async () => {
    await expect(
      resolveImportVerticalIds({
        role: "MANAGER",
        assignedVerticalIds: [7, 8],
        requestedVerticalIds: [],
        listActiveVerticalIds,
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("accepts several of the user's own", async () => {
    const result = await resolveImportVerticalIds({
      role: "MANAGER",
      assignedVerticalIds: [7, 8],
      requestedVerticalIds: [8, 7],
      listActiveVerticalIds,
    });
    expect(result.sort()).toEqual([7, 8]);
  });

  it("refuses a vertical the user does not hold", async () => {
    await expect(
      resolveImportVerticalIds({
        role: "MANAGER",
        assignedVerticalIds: [7],
        requestedVerticalIds: [9],
        listActiveVerticalIds,
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  /**
   * The case §6.3 exists for. An admin holds nothing of their own, so they must
   * name the vertical — and it is checked against the verticals that exist
   * rather than against their (empty) assignments.
   */
  it("lets an admin with no verticals choose any that exists", async () => {
    const result = await resolveImportVerticalIds({
      role: "ADMIN",
      assignedVerticalIds: [],
      requestedVerticalIds: [2],
      listActiveVerticalIds,
    });
    expect(result).toEqual([2]);
  });

  it("makes an admin name one rather than guessing", async () => {
    await expect(
      resolveImportVerticalIds({
        role: "ADMIN",
        assignedVerticalIds: [],
        requestedVerticalIds: [],
        listActiveVerticalIds,
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses an admin a vertical that does not exist", async () => {
    await expect(
      resolveImportVerticalIds({
        role: "ADMIN",
        assignedVerticalIds: [],
        requestedVerticalIds: [99],
        listActiveVerticalIds,
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  /**
   * The exception is scoped to admins on purpose. A rep with no vertical is a
   * misconfigured account, not a case to accommodate — silently letting them
   * pick any vertical would widen access well past what §6.0 decided.
   */
  it("does not extend the exception to a rep with no verticals", async () => {
    await expect(
      resolveImportVerticalIds({
        role: "REP",
        assignedVerticalIds: [],
        requestedVerticalIds: [1],
        listActiveVerticalIds,
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
