import {
  assertResourceInScope,
  type ScopeContext,
} from "@atlasmed/access";
import {
  ForbiddenError,
  ResourceNotFoundError,
  ValidationError,
} from "../../../../shared/errors";
import type { PotentialRepository } from "../interfaces/potential.repository.interface";

const ROLLING_DAYS = 90;
const MONTHS_IN_WINDOW = 3;

function assertVerticalAccess(scope: ScopeContext, verticalId: string) {
  const assigned = scope.assignedVerticalIds ?? [];
  if (scope.isGlobal && assigned.length === 0) return;
  if (assigned.length > 0 && !assigned.includes(verticalId)) {
    throw new ForbiddenError();
  }
}

function slugKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export class ListFacilityPotentialsUseCase {
  constructor(private readonly deps: { potentialRepository: PotentialRepository }) {}

  async execute(input: {
    facilityId: string;
    verticalId: string;
    scope: ScopeContext;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    assertVerticalAccess(input.scope, input.verticalId);

    const definitions = await this.deps.potentialRepository.listDefinitions({
      verticalId: input.verticalId,
    });
    const definitionIds = definitions.map((d) => d.id);
    const [values, qtySums] = await Promise.all([
      this.deps.potentialRepository.listFacilityValues({
        facilityId: input.facilityId,
        definitionIds,
      }),
      this.deps.potentialRepository.sumAtlasmedQtyByDefinition({
        facilityId: input.facilityId,
        definitionIds,
        since: new Date(Date.now() - ROLLING_DAYS * 86_400_000),
      }),
    ]);

    const valueByDef = new Map(values.map((v) => [v.definitionId, v.quantity]));
    const qtyByDef = new Map(qtySums.map((q) => [q.definitionId, q.totalQty]));

    return {
      verticalId: input.verticalId,
      items: definitions.map((def) => {
        const potentialQuantity = valueByDef.get(def.id) ?? null;
        const sumQty = qtyByDef.get(def.id) ?? 0;
        const atlasmedMonthlyAvgQty = sumQty / MONTHS_IN_WINDOW;
        const penetration =
          potentialQuantity != null && potentialQuantity > 0
            ? atlasmedMonthlyAvgQty / potentialQuantity
            : null;
        return {
          definitionId: def.id,
          key: def.key,
          label: def.label,
          sortOrder: def.sortOrder,
          potentialQuantity,
          atlasmedMonthlyAvgQty,
          /** Fraction 0–1+ (e.g. 0.3 = 30%). Null when potential missing. */
          penetration,
        };
      }),
    };
  }
}

export class PatchFacilityPotentialsUseCase {
  constructor(private readonly deps: { potentialRepository: PotentialRepository }) {}

  async execute(input: {
    facilityId: string;
    verticalId: string;
    userId: string;
    scope: ScopeContext;
    values: Array<{ definitionId: string; quantity: number | null }>;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    assertVerticalAccess(input.scope, input.verticalId);

    if (!input.values.length) {
      throw new ValidationError([
        { field: "values", message: "values must not be empty" },
      ]);
    }

    const definitions = await this.deps.potentialRepository.listDefinitions({
      verticalId: input.verticalId,
    });
    const allowed = new Set(definitions.map((d) => d.id));

    for (const row of input.values) {
      if (!allowed.has(row.definitionId)) {
        throw new ValidationError([
          {
            field: "definitionId",
            message: `definition ${row.definitionId} not in vertical`,
          },
        ]);
      }
      if (row.quantity === null) {
        await this.deps.potentialRepository.deleteFacilityValue({
          facilityId: input.facilityId,
          definitionId: row.definitionId,
        });
        continue;
      }
      if (!Number.isFinite(row.quantity) || row.quantity < 0) {
        throw new ValidationError([
          { field: "quantity", message: "quantity must be a non-negative number" },
        ]);
      }
      await this.deps.potentialRepository.upsertFacilityValue({
        facilityId: input.facilityId,
        definitionId: row.definitionId,
        quantity: row.quantity,
        updatedByUserId: input.userId,
      });
    }

    return new ListFacilityPotentialsUseCase(this.deps).execute({
      facilityId: input.facilityId,
      verticalId: input.verticalId,
      scope: input.scope,
    });
  }
}

export class ListPotentialDefinitionsUseCase {
  constructor(private readonly deps: { potentialRepository: PotentialRepository }) {}

  async execute(input: { verticalId: string; scope: ScopeContext }) {
    assertVerticalAccess(input.scope, input.verticalId);
    const definitions = await this.deps.potentialRepository.listDefinitions({
      verticalId: input.verticalId,
    });
    return {
      data: definitions.map((d) => ({
        id: d.id,
        verticalId: d.verticalId,
        key: d.key,
        label: d.label,
        sortOrder: d.sortOrder,
      })),
    };
  }
}

export class CreatePotentialDefinitionUseCase {
  constructor(private readonly deps: { potentialRepository: PotentialRepository }) {}

  async execute(input: {
    verticalId: string;
    key?: string;
    label: string;
    sortOrder?: number;
    scope: ScopeContext;
  }) {
    assertVerticalAccess(input.scope, input.verticalId);
    const key = input.key?.trim() ? slugKey(input.key) : slugKey(input.label);
    if (!key) {
      throw new ValidationError([{ field: "key", message: "key is required" }]);
    }
    if (!input.label.trim()) {
      throw new ValidationError([{ field: "label", message: "label is required" }]);
    }
    try {
      const created = await this.deps.potentialRepository.createDefinition({
        verticalId: input.verticalId,
        key,
        label: input.label.trim(),
        sortOrder: input.sortOrder ?? 0,
      });
      return {
        id: created.id,
        verticalId: created.verticalId,
        key: created.key,
        label: created.label,
        sortOrder: created.sortOrder,
      };
    } catch {
      throw new ValidationError([
        { field: "key", message: "key already exists for this vertical" },
      ]);
    }
  }
}

export class UpdatePotentialDefinitionUseCase {
  constructor(private readonly deps: { potentialRepository: PotentialRepository }) {}

  async execute(input: {
    id: string;
    label?: string;
    sortOrder?: number;
    scope: ScopeContext;
  }) {
    const existing = await this.deps.potentialRepository.findDefinitionById(input.id);
    if (!existing || existing.deletedAt) {
      throw new ResourceNotFoundError("PotentialDefinition", input.id);
    }
    assertVerticalAccess(input.scope, existing.verticalId);
    const updated = await this.deps.potentialRepository.updateDefinition({
      id: input.id,
      label: input.label?.trim(),
      sortOrder: input.sortOrder,
    });
    if (!updated) throw new ResourceNotFoundError("PotentialDefinition", input.id);
    return {
      id: updated.id,
      verticalId: updated.verticalId,
      key: updated.key,
      label: updated.label,
      sortOrder: updated.sortOrder,
    };
  }
}

export class SoftDeletePotentialDefinitionUseCase {
  constructor(private readonly deps: { potentialRepository: PotentialRepository }) {}

  async execute(input: { id: string; scope: ScopeContext }) {
    const existing = await this.deps.potentialRepository.findDefinitionById(input.id);
    if (!existing || existing.deletedAt) {
      throw new ResourceNotFoundError("PotentialDefinition", input.id);
    }
    assertVerticalAccess(input.scope, existing.verticalId);
    await this.deps.potentialRepository.softDeleteDefinition(input.id);
    return { ok: true };
  }
}

export class LinkProductPotentialUseCase {
  constructor(private readonly deps: { potentialRepository: PotentialRepository }) {}

  async execute(input: {
    productId: string;
    definitionId: string;
    scope: ScopeContext;
  }) {
    const definition = await this.deps.potentialRepository.findDefinitionById(
      input.definitionId,
    );
    if (!definition || definition.deletedAt) {
      throw new ResourceNotFoundError("PotentialDefinition", input.definitionId);
    }
    assertVerticalAccess(input.scope, definition.verticalId);
    const belongs = await this.deps.potentialRepository.productBelongsToVertical({
      productId: input.productId,
      verticalId: definition.verticalId,
    });
    if (!belongs) {
      throw new ValidationError([
        {
          field: "productId",
          message: "product must belong to the definition's Linha (vertical)",
        },
      ]);
    }
    await this.deps.potentialRepository.linkProduct({
      productId: input.productId,
      definitionId: input.definitionId,
    });
    return { productId: input.productId, definitionId: input.definitionId };
  }
}

export class UnlinkProductPotentialUseCase {
  constructor(private readonly deps: { potentialRepository: PotentialRepository }) {}

  async execute(input: { productId: string; scope: ScopeContext }) {
    const link = await this.deps.potentialRepository.findLinkByProductId(
      input.productId,
    );
    if (!link) {
      throw new ResourceNotFoundError("ProductPotentialLink", input.productId);
    }
    const definition = await this.deps.potentialRepository.findDefinitionById(
      link.definitionId,
    );
    if (definition) assertVerticalAccess(input.scope, definition.verticalId);
    await this.deps.potentialRepository.unlinkProduct(input.productId);
    return { ok: true };
  }
}

export class ListDefinitionProductsUseCase {
  constructor(private readonly deps: { potentialRepository: PotentialRepository }) {}

  async execute(input: { definitionId: string; scope: ScopeContext }) {
    const definition = await this.deps.potentialRepository.findDefinitionById(
      input.definitionId,
    );
    if (!definition || definition.deletedAt) {
      throw new ResourceNotFoundError("PotentialDefinition", input.definitionId);
    }
    assertVerticalAccess(input.scope, definition.verticalId);
    const products = await this.deps.potentialRepository.listProductsForDefinition(
      input.definitionId,
    );
    return {
      data: products.map((p) => ({
        productId: p.productId,
        definitionId: p.definitionId,
        name: p.productName,
        code: p.productCode,
      })),
    };
  }
}
