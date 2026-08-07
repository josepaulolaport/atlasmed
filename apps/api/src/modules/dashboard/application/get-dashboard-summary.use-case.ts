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
  /** Narrowing filter when set; `null` = union of all assigned verticals. */
  verticalId: number | null;
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
      // Admins get Brazil overview stats only — no territory polygons on the
      // Desempenho minimap (same rule as the live Mapa tab).
      isAdmin
        ? Promise.resolve([] as DashboardTerritoryFeature[])
        : this.repo.listAssignedTerritoryFeatures({
            userId: input.userId,
            verticalIds: resolved,
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
      // Echo explicit filter only; omit means token-scoped union.
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
