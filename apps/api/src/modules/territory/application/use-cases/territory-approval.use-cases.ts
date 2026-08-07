import { Role } from "@atlasmed/access";
import type { ScopeContext } from "@atlasmed/access";
import type { TerritoryApprovalType } from "@atlasmed/database";
import type { TerritoryApprovalRepository } from "../interfaces/territory-approval.repository.interface";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import { TerritoryCrudUseCases } from "./territory-crud.use-cases";
import type { IAuditLog } from "../../../access/application/interfaces/audit-log.interface";
import {
  OperationNotAllowedError,
  ResourceConflictError,
  ResourceNotFoundError,
} from "../../../../shared/errors";
import { assertManagerTerritoryApprovalRequest } from "../services/territory-scope-policy.service";

interface Dependencies {
  approvalRepository: TerritoryApprovalRepository;
  territoryRepository: TerritoryRepository;
  territoryCrud: TerritoryCrudUseCases;
  invalidateScopeForTerritories?: (territoryIds: number[]) => Promise<void>;
  enqueueMembershipRecompute?: (territoryId?: number) => Promise<void>;
  auditLog?: IAuditLog;
}

export class TerritoryApprovalUseCases {
  constructor(private readonly deps: Dependencies) {}

  async submitRequest(input: {
    requesterId: number;
    requesterRole: Role;
    scope: ScopeContext;
    type: TerritoryApprovalType;
    entityPayload: Record<string, unknown>;
    targetTerritoryId?: number;
    facilityId?: number;
    toTerritoryId?: number;
    reason?: string;
  }) {
    if (input.requesterRole !== Role.MANAGER) {
      throw new OperationNotAllowedError(
        "submit_approval",
        "Only managers submit territory approval requests"
      );
    }

    await assertManagerTerritoryApprovalRequest({
      scope: input.scope,
      territoryRepository: this.deps.territoryRepository,
      type: input.type,
      targetTerritoryId: input.targetTerritoryId ?? null,
      facilityId: input.facilityId ?? null,
      toTerritoryId: input.toTerritoryId ?? null,
      entityPayload: input.entityPayload,
    });

    const pendingFromOthers = (
      await this.deps.approvalRepository.findPendingByEntity({
        type: input.type,
        targetTerritoryId: input.targetTerritoryId ?? null,
        facilityId: input.facilityId ?? null,
      })
    ).filter((request) => request.requesterId !== input.requesterId);

    if (pendingFromOthers.length > 0) {
      throw new ResourceConflictError(
        "TerritoryApprovalRequest",
        String(pendingFromOthers[0]!.id)
      );
    }

    const ownPending = await this.deps.approvalRepository.findPendingByRequesterAndEntity({
      type: input.type,
      requesterId: input.requesterId,
      targetTerritoryId: input.targetTerritoryId ?? null,
      facilityId: input.facilityId ?? null,
    });

    const created = await this.deps.approvalRepository.create({
      type: input.type,
      requesterId: input.requesterId,
      entityPayload: input.entityPayload,
      targetTerritoryId: input.targetTerritoryId ?? null,
      facilityId: input.facilityId ?? null,
      toTerritoryId: input.toTerritoryId ?? null,
      reason: input.reason ?? null,
    });

    if (ownPending) {
      await this.deps.approvalRepository.supersede(ownPending.id, created.id);
    }

    return created;
  }

  async listRequests(input: { status?: "pending" | "approved" | "rejected" | "superseded"; page?: number; limit?: number }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;
    return this.deps.approvalRepository.list({
      status: input.status,
      page,
      limit,
    });
  }

  async approveRequest(input: { requestId: number; reviewerId: number; note?: string }) {
    const request = await this.deps.approvalRepository.findById(input.requestId);
    if (!request) {
      throw new ResourceNotFoundError("TerritoryApprovalRequest", input.requestId);
    }
    if (request.status !== "pending") {
      throw new OperationNotAllowedError(
        "approve_request",
        "Only pending requests can be approved"
      );
    }

    await this.applyApprovedRequest(request);

    const resolved = await this.deps.approvalRepository.resolve(input.requestId, {
      status: "approved",
      reviewerId: input.reviewerId,
      resolutionNote: input.note ?? null,
    });

    await this.deps.auditLog?.log({
      userId: input.reviewerId,
      eventType: "DATA_ACCESS",
      action: "approve_territory_request",
      resource: "territory_approval",
      resourceId: String(request.id),
      details: { type: request.type },
    });

    return resolved;
  }

  async rejectRequest(input: { requestId: number; reviewerId: number; note?: string }) {
    const request = await this.deps.approvalRepository.findById(input.requestId);
    if (!request) {
      throw new ResourceNotFoundError("TerritoryApprovalRequest", input.requestId);
    }
    if (request.status !== "pending") {
      throw new OperationNotAllowedError(
        "reject_request",
        "Only pending requests can be rejected"
      );
    }

    return this.deps.approvalRepository.resolve(input.requestId, {
      status: "rejected",
      reviewerId: input.reviewerId,
      resolutionNote: input.note ?? null,
    });
  }

  private async applyApprovedRequest(request: {
    type: TerritoryApprovalType;
    entityPayload: Record<string, unknown>;
    targetTerritoryId: number | null;
    facilityId: number | null;
    toTerritoryId: number | null;
  }): Promise<void> {
    switch (request.type) {
      case "deactivate_territory":
        if (!request.targetTerritoryId) {
          throw new OperationNotAllowedError(
            "approve_request",
            "Missing target territory for deactivate request"
          );
        }
        await this.deps.territoryCrud.deactivateTerritory(request.targetTerritoryId);
        await this.deps.invalidateScopeForTerritories?.([request.targetTerritoryId]);
        break;
      default:
        throw new OperationNotAllowedError("approve_request", "Unknown approval type");
    }
  }
}
