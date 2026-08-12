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
  deriveShare,
  monthlyRateFromDays,
  rollingWindow,
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

function assertVerticalAccess(scope: ScopeContext, verticalId: number) {
  const assigned = scope.assignedVerticalIds ?? [];
  if (scope.isGlobal && assigned.length === 0) return;
  if (!assigned.includes(verticalId)) {
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
    facilityId: number;
    verticalId: number;
    scope: ScopeContext;
    /** Injectable so the window under test does not depend on the wall clock. */
    now?: Date;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    assertVerticalAccess(input.scope, input.verticalId);

    const now = input.now ?? new Date();
    // Ours is a rolling day window (spec 0013 §4.3), which is what stops a
    // partial month from dragging the number down. Theirs no longer names
    // months at all — it is the figure standing per product.
    const window = rollingWindow(now);

    const definitions = await this.deps.potentialRepository.listDefinitions({
      verticalId: input.verticalId,
    });
    const definitionIds = definitions.map((d) => d.id);
    const profileId = await this.deps.potentialRepository.findProfileId({
      facilityId: input.facilityId,
      verticalId: input.verticalId,
    });

    const [usage, claims, qtySums, ourProductSums] = await Promise.all([
      // The standing figure per competitor product, newest row wins. Not the
      // month series: the rep answers "quantas por mês", so what they entered is
      // already a rate and holds until they replace it.
      profileId == null
        ? Promise.resolve([])
        : this.deps.potentialRepository.listUsage({ profileId, definitionIds }),
      profileId == null
        ? Promise.resolve([])
        : this.deps.potentialRepository.listNoOtherBrands({ profileId, definitionIds }),
      // Live from orders, not from snapshots: snapshots are per calendar month
      // and a day window cannot be derived from month facts. They keep serving
      // history and the aggregate views (spec 0013 §4.5).
      this.deps.potentialRepository.sumAtlasmedQtyByDefinition({
        facilityId: input.facilityId,
        verticalId: input.verticalId,
        definitionIds,
        rangeStart: window.start,
        rangeEnd: window.end,
      }),
      // The same window, broken down by product, so the rows on screen explain
      // the total above them instead of merely sitting near it.
      this.deps.potentialRepository.sumAtlasmedQtyByDefinitionAndProduct({
        facilityId: input.facilityId,
        verticalId: input.verticalId,
        definitionIds,
        rangeStart: window.start,
        rangeEnd: window.end,
      }),
    ]);

    const oursByDef = new Map<number, number>();
    for (const row of qtySums) {
      oursByDef.set(row.definitionId, (oursByDef.get(row.definitionId) ?? 0) + row.totalQty);
    }

    const usageByDef = new Map<number, typeof usage>();
    for (const row of usage) {
      const list = usageByDef.get(row.definitionId) ?? [];
      list.push(row);
      usageByDef.set(row.definitionId, list);
    }

    const claimByDef = new Map(claims.map((row) => [row.definitionId, row]));

    const ourProductsByDef = new Map<number, typeof ourProductSums>();
    for (const row of ourProductSums) {
      const list = ourProductsByDef.get(row.definitionId) ?? [];
      list.push(row);
      ourProductsByDef.set(row.definitionId, list);
    }

    return {
      verticalId: input.verticalId,
      items: definitions.map((def) => {
        const standingRows = usageByDef.get(def.id) ?? [];

        // Ours: a quantity observed over the window, normalised to a month.
        const ours = monthlyRateFromDays(oursByDef.get(def.id) ?? 0);
        // Theirs: the sum of what stands recorded for each competitor product.
        //
        // Not an average over the window. A rep who records one product at
        // 100/mês means 100/mês; dividing by three months called the two they
        // never surveyed hard zeros and showed 33 — the "confident, wrong
        // number" §4.4 refuses for this very operand. Different products add;
        // the same product replaces, which is what the newest-row read gives.
        const theirs = standingRows.reduce((sum, row) => sum + row.quantity, 0);
        // A share needs a denominator we actually know. An empty competitor
        // list is only a *known* empty market when a rep has said so — that is
        // what "nenhuma outra marca" asserts (§4.6). That condition is part of
        // the share rule rather than a guard around it, so it lives inside
        // `deriveShare` with the rest of it and is checked against the
        // generated column by `market-share-parity.db.test.ts`.
        const claim = claimByDef.get(def.id);
        const { totalQty, share } = deriveShare(ours, theirs, claim?.noOtherBrands === true);

        // Our own side of the same window, largest first. These sum to
        // `atlasmedMonthlyAvgQty` above, as the competitor rows now sum to
        // `competitorMonthlyQty`.
        const ourProducts = (ourProductsByDef.get(def.id) ?? [])
          .map((row) => ({
            productId: row.productId,
            productName: row.productName,
            quantity: monthlyRateFromDays(row.totalQty),
          }))
          .sort((a, b) => b.quantity - a.quantity);

        return {
          definitionId: def.id,
          key: def.key,
          label: def.label,
          /** Ours, from orders — monthly average over the window. */
          atlasmedMonthlyAvgQty: ours,
          /**
           * Theirs, as recorded by the rep — the sum of the figure standing for
           * each competitor product, not an average over months.
           */
          competitorMonthlyQty: theirs,
          /** The observed market: ours + theirs. */
          totalMarketQty: totalQty,
          /**
           * Our share of the market, 0–1, or null when the market is unknown.
           *
           * Null in two cases, and they are the same principle twice:
           *   - nothing at all is known, so there is no denominator
           *   - we have orders but **no competitor observation**, so the market
           *     size is unknown. Reporting 100% there would claim we own the
           *     whole market on no evidence
           *
           * 0% is reserved for what it actually means: a known market we sell
           * nothing into.
           */
          share,
          /**
           * What stands recorded per competitor product. These sum to
           * `competitorMonthlyQty`; `updatedAt` is the only signal a figure is
           * old, since a stale one still counts (spec 0013 §6).
           */
          competitors: standingRows.map((c) => ({
            productId: c.productId,
            productName: c.productName,
            quantity: c.quantity,
            updatedAt: c.updatedAt.toISOString(),
          })),
          /** Ours, per product, over the same window as `atlasmedMonthlyAvgQty`. */
          ourProducts,
          /**
           * The rep's standing claim that no other brand is sold here, and when
           * it was made — a stale claim still counts, so the date is the only
           * signal that it is old (§6).
           */
          noOtherBrands: claim?.noOtherBrands ?? false,
          noOtherBrandsSetAt: claim?.setAt?.toISOString() ?? null,
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
      recomputeSnapshots?: (input: { profileId: number }) => Promise<unknown>;
    },
  ) {}

  async execute(input: {
    facilityId: number;
    verticalId: number;
    definitionId: number;
    productId: number;
    quantity: number;
    userId: number;
    scope: ScopeContext;
    now?: Date;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    assertVerticalAccess(input.scope, input.verticalId);

    // Strictly positive (§4.6). Zero is not a quantity: "they sell none here" is
    // the `noOtherBrands` claim, which records when it was asserted. A zero row
    // would assert the same thing anonymously and keep the product in a list of
    // what the clinic uses.
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
      throw new ValidationError([
        { field: "quantity", message: "quantity must be greater than zero" },
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

    // The product must be one that counts toward this metric — that is, an
    // equivalent of one of our products linked to it.
    //
    // Nothing in the schema says so: the only product foreign key checks that
    // it is a COMPETITOR product. But the read derives eligibility the same
    // way, so a product outside that set wrote a row and then vanished from the
    // answer — the rep added a brand, the screen redrew unchanged, and their
    // figure sat where nobody would ever see it. A write that succeeds
    // invisibly is worse than one that fails, so this one fails.
    const eligible =
      await this.deps.potentialRepository.listCompetitorProductsForDefinition(
        input.definitionId,
      );
    if (!eligible.some((product) => product.productId === input.productId)) {
      throw new ValidationError([
        {
          field: "productId",
          message: "product does not count toward this potential metric",
        },
      ]);
    }

    await this.deps.potentialRepository.upsertUsage({
      profileId,
      definitionId: input.definitionId,
      verticalId: definition.verticalId,
      productId: input.productId,
      quantity: input.quantity,
      updatedByUserId: input.userId,
    });

    // "No other brand is sold here" and this product cannot both be true, and a
    // database check refuses the pair outright. Clearing it here means the rep
    // is never asked to withdraw a claim before recording what they just saw.
    await this.deps.potentialRepository.setNoOtherBrands({
      profileId,
      definitionId: input.definitionId,
      verticalId: definition.verticalId,
      value: false,
    });

    // Synchronous, not enqueued (spec 0013 §4.4): the rep is looking at the
    // number they just changed, so it must be right when the screen redraws.
    // Order writes enqueue instead — an importer upserting tens of orders would
    // otherwise recompute the same profile dozens of times.
    await this.deps.recomputeSnapshots?.({ profileId });

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
      recomputeSnapshots?: (input: { profileId: number }) => Promise<unknown>;
    },
  ) {}

  async execute(input: {
    facilityId: number;
    verticalId: number;
    definitionId: number;
    productId: number;
    scope: ScopeContext;
    now?: Date;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    assertVerticalAccess(input.scope, input.verticalId);

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

    // Every month the product carries, not just this one. A competitor holds a
    // single standing figure and the months behind it are the dates it changed,
    // so clearing only the newest left the previous one standing and the product
    // reappeared with an older number on the next load.
    const removed = await this.deps.potentialRepository.deleteUsageForProduct({
      profileId,
      definitionId: input.definitionId,
      productId: input.productId,
    });
    if (!removed) {
      throw new ResourceNotFoundError(
        "FacilityProductUsage",
        `${input.definitionId}:${input.productId}`,
      );
    }

    // Removing a competitor changes the denominator, so the stored value is
    // stale the instant the row goes.
    await this.deps.recomputeSnapshots?.({ profileId });

    return new ListFacilityPotentialsUseCase(this.deps).execute({
      facilityId: input.facilityId,
      verticalId: input.verticalId,
      scope: input.scope,
      now: input.now,
    });
  }
}

/**
 * Records or withdraws "nenhuma outra marca" for one metric at one clinic.
 *
 * The claim is what makes a 100% share legitimate (§4.6). Without it an empty
 * competitor list means the market is *unknown*, not that we own it — so this is
 * the difference between "nobody has asked" and "someone looked and there is
 * nothing".
 */
export class SetNoOtherBrandsUseCase {
  constructor(
    private readonly deps: {
      potentialRepository: PotentialRepository;
      recomputeSnapshots?: (input: { profileId: number }) => Promise<unknown>;
    },
  ) {}

  async execute(input: {
    facilityId: number;
    verticalId: number;
    definitionId: number;
    value: boolean;
    userId: number;
    scope: ScopeContext;
    now?: Date;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    assertVerticalAccess(input.scope, input.verticalId);

    const definition = await this.deps.potentialRepository.findDefinitionById(
      input.definitionId,
    );
    if (!definition || definition.deletedAt) {
      throw new ResourceNotFoundError("PotentialDefinition", input.definitionId);
    }
    if (definition.verticalId !== input.verticalId) {
      throw new ValidationError([
        { field: "definitionId", message: "definition does not belong to this Linha" },
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

    // Only claimable about an empty list. Asserting "no other brand" while
    // brands are recorded is a contradiction, and resolving it by deleting the
    // rep's own figures would be the screen throwing away work to satisfy a
    // checkbox.
    if (input.value) {
      const recorded = await this.deps.potentialRepository.listUsage({
        profileId,
        definitionIds: [input.definitionId],
      });
      if (recorded.length > 0) {
        throw new ValidationError([
          {
            field: "value",
            message:
              "remove the recorded competitor products before declaring that none are sold",
          },
        ]);
      }
    }

    await this.deps.potentialRepository.setNoOtherBrands({
      profileId,
      definitionId: input.definitionId,
      verticalId: definition.verticalId,
      value: input.value,
    });

    // The claim is an input to the share, so the stored value is stale until
    // this runs — same reasoning as a quantity edit.
    await this.deps.recomputeSnapshots?.({ profileId });

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

/**
 * The other brands that count toward a metric — the rep's picker.
 *
 * Same set the write validates against, deliberately: a picker that can offer
 * something the write refuses is a picker that produces error messages.
 */
export class ListDefinitionCompetitorProductsUseCase {
  constructor(private readonly deps: { potentialRepository: PotentialRepository }) {}

  async execute(input: { definitionId: number; scope: ScopeContext }) {
    const definition = await this.deps.potentialRepository.findDefinitionById(
      input.definitionId,
    );
    if (!definition || definition.deletedAt) {
      throw new ResourceNotFoundError("PotentialDefinition", input.definitionId);
    }
    assertVerticalAccess(input.scope, definition.verticalId);
    const products =
      await this.deps.potentialRepository.listCompetitorProductsForDefinition(
        input.definitionId,
      );
    return {
      data: products.map((p) => ({
        productId: p.productId,
        definitionId: input.definitionId,
        name: p.productName,
        code: p.productCode,
      })),
    };
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
