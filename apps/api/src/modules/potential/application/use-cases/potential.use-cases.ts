import {
  assertResourceInScope,
  type ScopeContext,
} from "@atlasmed/access";
import {
  ForbiddenError,
  ResourceNotFoundError,
  ValidationError,
} from "../../../../shared/errors";
import {
  addMonths,
  averageMonthly,
  deriveShare,
  monthBounds,
  monthKeyAt,
  trailingMonths,
  type MonthKey,
} from "@atlasmed/facility-insights";
import type { PotentialRepository } from "../interfaces/potential.repository.interface";

/**
 * How many calendar months the displayed monthly figure averages over.
 *
 * A **read-side** constant (spec 0013 §4.3): snapshots store the facts of one
 * month, and the window is applied when they are presented. Changing it is a
 * query change, not a data migration.
 *
 * It replaced a rolling 90-day sum divided by 3 — which had no upper bound, so
 * future-dated orders counted, and which depended on the clock, so the same
 * month could never be recomputed to the same number.
 */
const MONTHS_IN_WINDOW = 3;

function assertVerticalAccess(scope: ScopeContext, verticalId: number) {
  const assigned = scope.assignedVerticalIds ?? [];
  if (scope.isGlobal && assigned.length === 0) return;
  if (!assigned.includes(verticalId)) {
    throw new ForbiddenError();
  }
}

/**
 * The months one edit invalidates.
 *
 * An edit belongs to a single month, but the displayed figure averages a
 * trailing window — so the months after it change too. Recomputing only the
 * edited month would leave the visible number stale.
 */
function windowFor(month: MonthKey): MonthKey[] {
  return trailingMonths(addMonths(month, MONTHS_IN_WINDOW - 1), MONTHS_IN_WINDOW);
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
    facilityId: number;
    verticalId: number;
    scope: ScopeContext;
    /** Injectable so the window under test does not depend on the wall clock. */
    now?: Date;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    assertVerticalAccess(input.scope, input.verticalId);

    const currentMonth = monthKeyAt(input.now ?? new Date());
    const months = trailingMonths(currentMonth, MONTHS_IN_WINDOW);
    const windowStart = monthBounds(months[0]!).start;
    const windowEnd = monthBounds(currentMonth).end;

    const definitions = await this.deps.potentialRepository.listDefinitions({
      verticalId: input.verticalId,
    });
    const definitionIds = definitions.map((d) => d.id);
    const profileId = await this.deps.potentialRepository.findProfileId({
      facilityId: input.facilityId,
      verticalId: input.verticalId,
    });

    // Snapshots are the stored answer (spec 0013 §4.4). They are a *cache*,
    // though, and one that starts empty: §4.4 also rules out backfilling
    // history, so on the day this ships no profile has a row yet.
    //
    // So this reads through rather than switching outright — on a miss it
    // computes from the inputs, exactly as before. It deliberately does **not**
    // populate on read: a write on the read path turns every clinic screen into
    // a writer, and the sweep fills the gap within the hour anyway.
    const snapshots =
      profileId == null
        ? []
        : await this.deps.potentialRepository.listMetricSnapshots({ profileId, months });

    const [usage, qtySums] = await Promise.all([
      profileId == null
        ? Promise.resolve([])
        : this.deps.potentialRepository.listUsage({ profileId, definitionIds, months }),
      snapshots.length > 0
        ? Promise.resolve([])
        : this.deps.potentialRepository.sumAtlasmedQtyByDefinitionAndMonth({
            facilityId: input.facilityId,
            verticalId: input.verticalId,
            definitionIds,
            rangeStart: windowStart,
            rangeEnd: windowEnd,
          }),
    ]);

    // Ours: sum each month in the window, then divide by the window — months
    // with no orders are real zeros, not missing data.
    const oursByDef = new Map<number, number>();
    for (const row of snapshots.length > 0 ? snapshots : qtySums) {
      const qty = "oursQty" in row ? row.oursQty : row.totalQty;
      oursByDef.set(row.definitionId, (oursByDef.get(row.definitionId) ?? 0) + qty);
    }
    const servedFromSnapshots = snapshots.length > 0;

    const usageByDef = new Map<number, typeof usage>();
    for (const row of usage) {
      const list = usageByDef.get(row.definitionId) ?? [];
      list.push(row);
      usageByDef.set(row.definitionId, list);
    }

    return {
      verticalId: input.verticalId,
      items: definitions.map((def) => {
        const monthlyRows = usageByDef.get(def.id) ?? [];

        // Both sides average over the same window, or the ratio compares a
        // three-month total against a one-month figure.
        const ours = averageMonthly([oursByDef.get(def.id) ?? 0], MONTHS_IN_WINDOW);
        // From the snapshot when we have one, so ours and theirs come from the
        // same computation rather than one stored and one recomputed.
        const theirs = averageMonthly(
          servedFromSnapshots
            ? snapshots.filter((row) => row.definitionId === def.id).map((row) => row.theirsQty)
            : monthlyRows.map((row) => row.metricQuantity),
          MONTHS_IN_WINDOW,
        );
        const { totalQty, share } = deriveShare(ours, theirs);

        // The list names who supplies this clinic *now*; the averages above are
        // the window. Showing three months of rows would double-count a product
        // the rep recorded in each of them.
        const currentMonthRows = monthlyRows.filter((row) => row.month === currentMonth);

        return {
          definitionId: def.id,
          key: def.key,
          label: def.label,
          /** Ours, from orders — monthly average over the window. */
          atlasmedMonthlyAvgQty: ours,
          /** Theirs, as recorded by the rep — monthly average over the window. */
          competitorMonthlyQty: theirs,
          /** The observed market: ours + theirs. */
          totalMarketQty: totalQty,
          /**
           * Our share of the observed market, 0–1.
           *
           * Null — never 0 — when nothing is known (spec 0013 §4.3). "We sell
           * nothing here" and "we have no information" must stay
           * distinguishable, and a 0 would read as the first while meaning the
           * second. A clinic with orders and no competitor data is genuinely
           * 100%: everything we can see of that market is ours.
           */
          share,
          /** The month the competitor rows below belong to. */
          month: currentMonth,
          competitors: currentMonthRows.map((c) => ({
            productId: c.productId,
            productName: c.productName,
            quantity: c.quantity,
            metricQuantity: c.metricQuantity,
            updatedAt: c.updatedAt.toISOString(),
          })),
        };
      }),
    };
  }
}

/**
 * Records what a clinic uses of one competitor product, for one metric.
 *
 * The rep supplies only a number. Which product comes from the picker, and the
 * linha comes from the definition — never from the caller — so a usage row
 * cannot pair a profile in one linha with a metric in another.
 */
export class SetFacilityProductUsageUseCase {
  constructor(
    private readonly deps: {
      potentialRepository: PotentialRepository;
      /** Optional so existing callers and tests are unaffected. */
      recomputeSnapshots?: (input: { profileId: number; months: MonthKey[] }) => Promise<unknown>;
    },
  ) {}

  async execute(input: {
    facilityId: number;
    verticalId: number;
    definitionId: number;
    productId: number;
    quantity: number;
    /** The month observed. Defaults to the current month in São Paulo. */
    month?: MonthKey;
    userId: number;
    scope: ScopeContext;
    now?: Date;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    assertVerticalAccess(input.scope, input.verticalId);

    if (!Number.isFinite(input.quantity) || input.quantity < 0) {
      throw new ValidationError([
        { field: "quantity", message: "quantity must be a non-negative number" },
      ]);
    }

    const currentMonth = monthKeyAt(input.now ?? new Date());
    const month = input.month ?? currentMonth;
    // A rep can correct an earlier month, but not record the future — there is
    // nothing to observe yet, and a future row would silently enter the window
    // as soon as the calendar caught up.
    if (month > currentMonth) {
      throw new ValidationError([
        { field: "month", message: "cannot record usage for a future month" },
      ]);
    }

    const definition = await this.deps.potentialRepository.findDefinitionById(
      input.definitionId,
    );
    if (!definition || definition.deletedAt) {
      throw new ResourceNotFoundError("PotentialDefinition", input.definitionId);
    }
    if (definition.verticalId !== input.verticalId) {
      throw new ValidationError([
        {
          field: "definitionId",
          message: "definition does not belong to this Linha",
        },
      ]);
    }

    const profileId = await this.deps.potentialRepository.findProfileId({
      facilityId: input.facilityId,
      verticalId: input.verticalId,
    });
    if (profileId == null) {
      throw new ResourceNotFoundError(
        "FacilityVerticalProfile",
        `${input.facilityId}:${input.verticalId}`,
      );
    }

    // A non-competitor product is refused by the composite foreign key, but
    // failing here names the reason instead of surfacing a constraint error.
    await this.deps.potentialRepository.upsertUsage({
      profileId,
      definitionId: input.definitionId,
      verticalId: definition.verticalId,
      productId: input.productId,
      month,
      quantity: input.quantity,
      updatedByUserId: input.userId,
    });

    // Synchronous, not enqueued (spec 0013 §4.4): the rep is looking at the
    // number they just changed, so it must be right when the screen redraws.
    // Order writes enqueue instead — an importer upserting tens of orders would
    // otherwise recompute the same profile dozens of times.
    await this.deps.recomputeSnapshots?.({ profileId, months: windowFor(month) });

    return new ListFacilityPotentialsUseCase(this.deps).execute({
      facilityId: input.facilityId,
      verticalId: input.verticalId,
      scope: input.scope,
      now: input.now,
    });
  }
}

export class RemoveFacilityProductUsageUseCase {
  constructor(
    private readonly deps: {
      potentialRepository: PotentialRepository;
      recomputeSnapshots?: (input: { profileId: number; months: MonthKey[] }) => Promise<unknown>;
    },
  ) {}

  async execute(input: {
    facilityId: number;
    verticalId: number;
    definitionId: number;
    productId: number;
    /** The month to clear. Defaults to the current month in São Paulo. */
    month?: MonthKey;
    scope: ScopeContext;
    now?: Date;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    assertVerticalAccess(input.scope, input.verticalId);

    const month = input.month ?? monthKeyAt(input.now ?? new Date());

    const profileId = await this.deps.potentialRepository.findProfileId({
      facilityId: input.facilityId,
      verticalId: input.verticalId,
    });
    if (profileId == null) {
      throw new ResourceNotFoundError(
        "FacilityVerticalProfile",
        `${input.facilityId}:${input.verticalId}`,
      );
    }

    // Deletes one month, never the product's whole history — removing what the
    // rep sees today must not silently erase what was true in March.
    const removed = await this.deps.potentialRepository.deleteUsage({
      profileId,
      definitionId: input.definitionId,
      productId: input.productId,
      month,
    });
    if (!removed) {
      throw new ResourceNotFoundError(
        "FacilityProductUsage",
        `${input.definitionId}:${input.productId}:${month}`,
      );
    }

    // Removing a competitor changes the denominator, so the snapshot is stale
    // the instant the row goes. Same reasoning as the write above.
    await this.deps.recomputeSnapshots?.({ profileId, months: windowFor(month) });

    return new ListFacilityPotentialsUseCase(this.deps).execute({
      facilityId: input.facilityId,
      verticalId: input.verticalId,
      scope: input.scope,
      now: input.now,
    });
  }
}

export class ListPotentialDefinitionsUseCase {
  constructor(private readonly deps: { potentialRepository: PotentialRepository }) {}

  async execute(input: { verticalId: number; scope: ScopeContext }) {
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
      })),
    };
  }
}

export class CreatePotentialDefinitionUseCase {
  constructor(private readonly deps: { potentialRepository: PotentialRepository }) {}

  async execute(input: {
    verticalId: number;
    key?: string;
    label: string;
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
      });
      return {
        id: created.id,
        verticalId: created.verticalId,
        key: created.key,
        label: created.label,
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
    id: number;
    label?: string;
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
    });
    if (!updated) throw new ResourceNotFoundError("PotentialDefinition", input.id);
    return {
      id: updated.id,
      verticalId: updated.verticalId,
      key: updated.key,
      label: updated.label,
    };
  }
}

export class SoftDeletePotentialDefinitionUseCase {
  constructor(private readonly deps: { potentialRepository: PotentialRepository }) {}

  async execute(input: { id: number; scope: ScopeContext }) {
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
    productId: number;
    definitionId: number;
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
    // The definition's vertical is the link's vertical — it is never supplied by
    // the caller. The composite FK would reject a disagreement anyway; passing
    // it from here means the two can never disagree in the first place.
    await this.deps.potentialRepository.linkProduct({
      productId: input.productId,
      definitionId: input.definitionId,
      verticalId: definition.verticalId,
    });
    return {
      productId: input.productId,
      definitionId: input.definitionId,
      verticalId: definition.verticalId,
    };
  }
}

export class UnlinkProductPotentialUseCase {
  constructor(private readonly deps: { potentialRepository: PotentialRepository }) {}

  async execute(input: {
    productId: number;
    definitionId: number;
    scope: ScopeContext;
  }) {
    const link = await this.deps.potentialRepository.findLink({
      productId: input.productId,
      definitionId: input.definitionId,
    });
    if (!link) {
      throw new ResourceNotFoundError(
        "ProductPotentialLink",
        `${input.productId}:${input.definitionId}`,
      );
    }
    const definition = await this.deps.potentialRepository.findDefinitionById(
      link.definitionId,
    );
    if (!definition) {
      throw new ResourceNotFoundError("PotentialDefinition", link.definitionId);
    }
    assertVerticalAccess(input.scope, definition.verticalId);
    await this.deps.potentialRepository.unlinkProduct({
      productId: input.productId,
      definitionId: input.definitionId,
    });
    return { ok: true };
  }
}

export class ListDefinitionProductsUseCase {
  constructor(private readonly deps: { potentialRepository: PotentialRepository }) {}

  async execute(input: { definitionId: number; scope: ScopeContext }) {
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
