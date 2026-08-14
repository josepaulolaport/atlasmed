import type { ScopeContext } from "@atlasmed/access";
import { Role } from "@atlasmed/access";
import { ForbiddenError } from "../../../shared/errors";
import { resolveVerticalIds } from "../../access/application/services/vertical-access.service";
import type {
  DashboardTerritoryFeature,
  DrizzleDashboardRepository,
  PurchaseStatusBuckets,
} from "../infrastructure/repositories/drizzle-dashboard.repository";

export type DashboardSummary = {
  verticalId: number | null;
  purchaseStatus: PurchaseStatusBuckets & {
    coveragePercent: number;
  };
  territory: {
    mode: "overview" | "assigned" | "empty";
    label: string | null;
    clinicCount: number;
    doctorCount: number;
    coveragePercent: number;
    features: DashboardTerritoryFeature[];
  };
};

export class GetDashboardSummaryUseCase {
  constructor(private readonly repo: DrizzleDashboardRepository) {}

  async execute(input: {
    userId: number;
    role: string;
    scope: ScopeContext;
    verticalId?: number | null;
  }): Promise<DashboardSummary> {
    const filterVerticalId = input.verticalId ?? null;
    const resolved = resolveVerticalIds({
      role: input.role,
      assignedVerticalIds: input.scope.assignedVerticalIds ?? [],
      queryVerticalId: filterVerticalId,
    });

    if (resolved.length === 0) {
      throw new ForbiddenError("Nenhuma vertical acessível");
    }

    const isAdmin = input.role === Role.ADMIN;
    const facilityIds: number[] | null = isAdmin
      ? null
      : (input.scope.facilityIds ?? []);

    const [purchaseStatus, doctorCount, features] = await Promise.all([
      this.repo.countPurchaseBuckets({ verticalIds: resolved, facilityIds }),
      this.repo.countDoctors({ verticalIds: resolved, facilityIds }),
      isAdmin
        ? Promise.resolve([] as DashboardTerritoryFeature[])
        : this.repo.listAssignedTerritoryFeatures({
            userId: input.userId,
            verticalIds: resolved,
          }),
    ]);

    /**
     * Share of profiled clinics that have ever bought.
     *
     * This was `(active + inactive) / total` over the old three buckets, which
     * silently excluded the INACTIVE stage — a clinic that bought for two years
     * and then lapsed counted as never having bought, and coverage read lower
     * than reality. Stated over stages, the intent is plain: everything that is
     * not NEVER_PURCHASED, and not a profile the funnel has yet to calculate.
     */
    const everPurchased =
      purchaseStatus.total -
      purchaseStatus.stages.NEVER_PURCHASED -
      purchaseStatus.stages.UNKNOWN;
    const coveragePercent =
      purchaseStatus.total > 0
        ? Math.round((everPurchased / purchaseStatus.total) * 100)
        : 0;

    let mode: "overview" | "assigned" | "empty";
    let label: string | null;
    if (isAdmin) {
      mode = "overview";
      label = "Brasil · visão geral";
    } else if (features.length > 0) {
      mode = "assigned";
      label =
        features.length === 1
          ? features[0]!.name
          : `${features.length} territórios`;
    } else {
      mode = "empty";
      label = null;
    }

    return {
      verticalId: filterVerticalId,
      purchaseStatus: {
        ...purchaseStatus,
        coveragePercent,
      },
      territory: {
        mode,
        label,
        clinicCount: purchaseStatus.total,
        doctorCount,
        coveragePercent,
        features: features.filter((f) => f.boundary != null),
      },
    };
  }
}
