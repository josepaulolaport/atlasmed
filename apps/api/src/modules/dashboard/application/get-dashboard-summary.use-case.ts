import type { ScopeContext } from "@atlasmed/access";
import { Role } from "@atlasmed/access";
import { ForbiddenError, ValidationError } from "../../../shared/errors";
import { resolveVerticalIds } from "../../access/application/services/vertical-access.service";
import type {
  DashboardTerritoryFeature,
  DrizzleDashboardRepository,
  PurchaseStatusBuckets,
} from "../infrastructure/repositories/drizzle-dashboard.repository";

export type DashboardSummary = {
  verticalId: string;
  purchaseStatus: PurchaseStatusBuckets & {
    /** (active + inactive) / total * 100 */
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
    userId: string;
    role: string;
    scope: ScopeContext;
    verticalId?: string | null;
  }): Promise<DashboardSummary> {
    const resolved = resolveVerticalIds({
      role: input.role,
      assignedVerticalIds: input.scope.assignedVerticalIds ?? [],
      queryVerticalId: input.verticalId,
    });

    if (resolved.length === 0) {
      throw new ForbiddenError("Nenhuma vertical acessível");
    }

    // Dashboard is single-vertical: require an explicit id when multi-assigned.
    const verticalId = input.verticalId?.trim() || resolved[0]!;
    if (!resolved.includes(verticalId)) {
      throw new ForbiddenError();
    }
    if (!verticalId) {
      throw new ValidationError([
        { field: "verticalId", message: "verticalId is required" },
      ]);
    }

    const isAdmin = input.role === Role.ADMIN;
    const facilityIds: string[] | null = isAdmin
      ? null
      : (input.scope.facilityIds ?? []);

    const [purchaseStatus, doctorCount, features] = await Promise.all([
      this.repo.countPurchaseBuckets({ verticalId, facilityIds }),
      this.repo.countDoctors({ verticalId, facilityIds }),
      isAdmin
        ? this.repo.listVerticalTerritoryFeatures(verticalId)
        : this.repo.listAssignedTerritoryFeatures({
            userId: input.userId,
            verticalId,
          }),
    ]);

    const coveragePercent =
      purchaseStatus.total > 0
        ? Math.round(
            ((purchaseStatus.active + purchaseStatus.inactive) /
              purchaseStatus.total) *
              100,
          )
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
      verticalId,
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
