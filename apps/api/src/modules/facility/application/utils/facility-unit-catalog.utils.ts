import { ValidationError } from "../../../../shared/errors";

export interface UnitSubtypeCatalogRow {
  id: number;
  unitTypeId: number;
}

/**
 * Ensures facilities.unit_subtype_id belongs to facilities.unit_type_id.
 * When subtype is set and type is omitted, derives unitTypeId from the subtype.
 * No-op when unitSubtypeId is null/undefined.
 *
 * Not wired to public facility create/update yet (those routes do not accept
 * unit catalog ids). Call from CNES import / future write paths.
 */
export async function resolveFacilityUnitCatalogIds(input: {
  unitTypeId?: number | null;
  unitSubtypeId?: number | null;
  findUnitSubtypeById: (id: number) => Promise<UnitSubtypeCatalogRow | null>;
}): Promise<{ unitTypeId: number | null; unitSubtypeId: number | null }> {
  const unitSubtypeId = input.unitSubtypeId ?? null;
  let unitTypeId = input.unitTypeId ?? null;

  if (unitSubtypeId == null) {
    return { unitTypeId, unitSubtypeId: null };
  }

  const subtype = await input.findUnitSubtypeById(unitSubtypeId);
  if (!subtype) {
    throw new ValidationError([
      { field: "unitSubtypeId", message: "Unit subtype not found" },
    ]);
  }

  if (unitTypeId == null) {
    unitTypeId = subtype.unitTypeId;
  } else if (unitTypeId !== subtype.unitTypeId) {
    throw new ValidationError([
      {
        field: "unitSubtypeId",
        message: "unitSubtypeId does not belong to unitTypeId",
      },
    ]);
  }

  return { unitTypeId, unitSubtypeId };
}
